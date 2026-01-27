import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const BUCKET = process.env.S3_BUCKET_NAME!;

async function migrateFiles() {
  const uploadsDir = 'server/uploads';
  let migrated = 0;
  let failed = 0;

  async function processDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name !== 'temp') {
          await processDir(fullPath);
        }
      } else {
        const relativePath = path.relative(uploadsDir, fullPath);
        const s3Key = relativePath.replace(/\\/g, '/');
        
        try {
          const fileContent = await fs.readFile(fullPath);
          
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            Body: fileContent,
            ContentType: getContentType(entry.name)
          }));
          
          console.log(`✓ ${s3Key}`);
          migrated++;
        } catch (err: any) {
          console.error(`✗ ${s3Key} - ${err.message}`);
          failed++;
        }
      }
    }
  }

  function getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.csv': 'text/csv'
    };
    return types[ext] || 'application/octet-stream';
  }

  console.log('Migrating files to S3...\n');
  await processDir(uploadsDir);
  console.log(`\n✅ Done: ${migrated} migrated, ${failed} failed`);
}

migrateFiles().catch(console.error);
