import { Express } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global file upload function
export async function uploadFiles(files: Express.Multer.File[], uploadDir: string): Promise<string[]> {
  if (!files || files.length === 0) {
    throw new Error('No files to upload');
  }

  const timestamp = Date.now().toString();
  const uploadedFileNames: string[] = [];

  // Ensure the upload directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    // Generate a unique file name
    const fileName = `${timestamp}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);

    // Save the file to disk
    await fs.writeFile(filePath, file.buffer);

    uploadedFileNames.push(fileName);
  }

  return uploadedFileNames;
}
