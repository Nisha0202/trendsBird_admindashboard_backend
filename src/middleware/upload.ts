
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../common/ApiError';

// Allow-list checked against the client-declared mimetype AND re-verified
// against actual file bytes later (see media.service.ts) — never trust
// the extension or content-type header alone.
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(422, `Unsupported file type: ${file.mimetype}`) as any);
    }
    cb(null, true);
  },
});