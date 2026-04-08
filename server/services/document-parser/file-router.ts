import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

export const UPLOAD_DIR = '/tmp/vantage-doc-uploads';

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
  }
});

export type FileType = 'pdf' | 'xlsx' | 'xls' | 'csv';
export type DocumentClass = 'pl' | 'rent_roll' | 't12' | 'om' | 'unknown';

export function detectFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, FileType> = {
    '.pdf': 'pdf', '.xlsx': 'xlsx', '.xls': 'xls', '.csv': 'csv'
  };
  return map[ext] ?? 'pdf';
}
