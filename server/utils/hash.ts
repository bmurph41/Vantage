import crypto from 'crypto';
import fs from 'fs';

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function sha256String(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
