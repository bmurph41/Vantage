/**
 * Migrate Existing Files to S3
 * One-time script to move files from local storage to S3
 * 
 * IMPORTANT: Run this during low traffic period!
 */

import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { cddDocuments, vdrDocuments } from '../../shared/schema';
import { uploadToS3 } from './s3-client';
import { getS3Key } from '../security/file-upload-security';
import { eq } from 'drizzle-orm';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'server', 'uploads');
const BACKUP_DIR = path.join(process.cwd(), 'server', 'uploads-backup');

interface MigrationResult {
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;
  errors: Array<{ file: string; error: string }>;
  backupLocation: string;
}

/**
 * Scan local uploads directory
 */
function scanLocalFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...scanLocalFiles(fullPath, baseDir));
    } else {
      // Store relative path from upload dir
      files.push(path.relative(baseDir, fullPath));
    }
  }
  
  return files;
}

/**
 * Migrate a single file to S3
 */
async function migrateFile(
  relativePath: string,
  dryRun: boolean = false
): Promise<{ success: boolean; error?: string; s3Key?: string }> {
  try {
    const localPath = path.join(LOCAL_UPLOAD_DIR, relativePath);
    
    // Read file
    if (!fs.existsSync(localPath)) {
      return { success: false, error: 'File not found' };
    }
    
    const fileBuffer = fs.readFileSync(localPath);
    const stats = fs.statSync(localPath);
    
    // Try to find document metadata in database
    let documentRecord = await db.select()
      .from(cddDocuments)
      .where(eq(cddDocuments.path, relativePath))
      .limit(1);
    
    if (documentRecord.length === 0) {
      // Try VDR documents
      documentRecord = await db.select()
        .from(vdrDocuments)
        .where(eq(vdrDocuments.path, relativePath))
        .limit(1);
    }
    
    if (documentRecord.length === 0) {
      console.warn(`No database record found for: ${relativePath}`);
      // Continue anyway - use default metadata
    }
    
    const doc = documentRecord[0];
    const orgId = doc?.orgId || 1; // Default to org 1 if not found
    
    // Determine content type
    const ext = path.extname(relativePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Generate S3 key
    const filename = path.basename(relativePath);
    const module = relativePath.includes('vdr') ? 'vdr' : 'cdd';
    const s3Key = getS3Key({
      orgId,
      module,
      filename,
      userId: doc?.uploadedBy
    });
    
    if (dryRun) {
      console.log(`[DRY RUN] Would upload: ${relativePath} → s3://${s3Key}`);
      return { success: true, s3Key };
    }
    
    // Upload to S3
    const result = await uploadToS3({
      key: s3Key,
      body: fileBuffer,
      contentType,
      metadata: {
        originalPath: relativePath,
        uploadedAt: stats.mtime.toISOString(),
        fileSize: stats.size.toString()
      }
    });
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    // Update database record
    if (doc) {
      const table = relativePath.includes('vdr') ? vdrDocuments : cddDocuments;
      await db.update(table)
        .set({
          path: s3Key, // Update to S3 key
          s3Url: result.url
        })
        .where(eq(table.id, doc.id));
    }
    
    console.log(`✓ Migrated: ${relativePath} → ${s3Key}`);
    return { success: true, s3Key };
    
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Backup local files before migration
 */
async function backupLocalFiles(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${BACKUP_DIR}-${timestamp}`;
  
  console.log(`Creating backup at: ${backupPath}`);
  
  // Copy entire uploads directory
  await fs.promises.cp(LOCAL_UPLOAD_DIR, backupPath, { recursive: true });
  
  console.log(`✓ Backup created successfully`);
  return backupPath;
}

/**
 * Main migration function
 */
export async function migrateToS3(options: {
  dryRun?: boolean;
  confirm?: boolean;
} = {}): Promise<MigrationResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  S3 File Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  const dryRun = options.dryRun || false;
  const confirm = options.confirm || false;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be uploaded\n');
  }
  
  // Scan local files
  console.log('Scanning local uploads directory...');
  const localFiles = scanLocalFiles(LOCAL_UPLOAD_DIR);
  
  if (localFiles.length === 0) {
    console.log('No files found to migrate');
    return {
      totalFiles: 0,
      successfulUploads: 0,
      failedUploads: 0,
      errors: [],
      backupLocation: ''
    };
  }
  
  // Calculate total size
  const totalSize = localFiles.reduce((sum, file) => {
    const fullPath = path.join(LOCAL_UPLOAD_DIR, file);
    if (fs.existsSync(fullPath)) {
      return sum + fs.statSync(fullPath).size;
    }
    return sum;
  }, 0);
  
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  const estimatedTime = Math.ceil(localFiles.length / 10); // ~10 files per minute
  const estimatedCost = (totalSize / 1024 / 1024 / 1024 * 0.023).toFixed(4); // $0.023 per GB
  
  console.log(`Found ${localFiles.length} file(s) (${sizeMB} MB total)`);
  console.log(`Estimated time: ${estimatedTime} minute(s)`);
  console.log(`Estimated S3 cost: $${estimatedCost}`);
  console.log('');
  
  if (!dryRun && !confirm) {
    console.error('ERROR: --confirm flag required for actual migration');
    console.log('');
    console.log('To proceed:');
    console.log('  node migrate-existing-files.ts --confirm');
    console.log('');
    console.log('Or run dry-run first:');
    console.log('  node migrate-existing-files.ts --dry-run');
    process.exit(1);
  }
  
  let backupLocation = '';
  
  if (!dryRun) {
    // Create backup first
    backupLocation = await backupLocalFiles();
    console.log('');
  }
  
  // Migrate each file
  console.log('Starting migration...\n');
  
  const results: MigrationResult = {
    totalFiles: localFiles.length,
    successfulUploads: 0,
    failedUploads: 0,
    errors: [],
    backupLocation
  };
  
  for (let i = 0; i < localFiles.length; i++) {
    const file = localFiles[i];
    const progress = `[${i + 1}/${localFiles.length}]`;
    
    process.stdout.write(`${progress} ${file}... `);
    
    const result = await migrateFile(file, dryRun);
    
    if (result.success) {
      results.successfulUploads++;
      console.log('✓');
    } else {
      results.failedUploads++;
      results.errors.push({ file, error: result.error || 'Unknown error' });
      console.log(`✗ ${result.error}`);
    }
    
    // Rate limit: 10 files per second max
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migration Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Total files: ${results.totalFiles}`);
  console.log(`✓ Successful: ${results.successfulUploads}`);
  console.log(`✗ Failed: ${results.failedUploads}`);
  
  if (results.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    results.errors.forEach(({ file, error }) => {
      console.log(`  ${file}: ${error}`);
    });
  }
  
  if (!dryRun && backupLocation) {
    console.log('');
    console.log(`Backup location: ${backupLocation}`);
    console.log('');
    console.log('⚠️  Local files have NOT been deleted');
    console.log('   Delete them manually after verifying S3 migration:');
    console.log(`   rm -rf ${LOCAL_UPLOAD_DIR}`);
  }
  
  console.log('');
  
  return results;
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  
  migrateToS3({ dryRun, confirm })
    .then((results) => {
      process.exit(results.failedUploads > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
