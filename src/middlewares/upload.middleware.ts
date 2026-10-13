import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

const CONTENT_UPLOAD_DIR = path.join(process.cwd(), env.UPLOAD_DIR, 'content');

// Ensure the uploads/content directory exists
if (!fs.existsSync(CONTENT_UPLOAD_DIR)) {
  fs.mkdirSync(CONTENT_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CONTENT_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}${ext}`);
  },
});

export const contentUpload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export const CONTENT_UPLOAD_SUBDIR = 'content';

// ─── Documents Upload Storage ──────────────────────────────────────────────────
const DOCUMENTS_UPLOAD_DIR = path.join(process.cwd(), env.UPLOAD_DIR, 'documents');

if (!fs.existsSync(DOCUMENTS_UPLOAD_DIR)) {
  fs.mkdirSync(DOCUMENTS_UPLOAD_DIR, { recursive: true });
}

const DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DOCUMENTS_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}${ext}`);
  },
});

export const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: Math.max(env.MAX_FILE_SIZE, 25 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    if (DOCUMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, Images, Word, Excel, CSV, PPT, TXT.`));
    }
  },
});

export const DOCUMENTS_UPLOAD_SUBDIR = 'documents';
