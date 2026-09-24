import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { audit } from '../../utils/audit';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler, ok } from '../../utils/http';
import { ALLOWED_MIME, filesService, MAX_FILE_SIZE } from './files.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME.has(file.mimetype) ? cb(null, true) : cb(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File type is not allowed')),
});

const handleUpload = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return next(new ApiError(tooBig ? 413 : 400, tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', tooBig ? 'File exceeds the 10 MB limit' : err.message));
    }
    next(err);
  });

const idParams = validate(z.object({ id: z.string().uuid() }), 'params');

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.post('/', handleUpload, asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A "file" field is required');
  const file = await filesService.upload(req.user!, req.file);
  await audit(req, { action: 'UPLOAD', resource: 'FILE', resourceId: file.id });
  ok(res, file, 'File uploaded', 201);
}));

filesRouter.get('/:id', idParams, asyncHandler(async (req, res) => {
  const { file, stream } = await filesService.open(req.user!, req.params.id as string);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  stream.pipe(res);
}));

filesRouter.delete('/:id', idParams, asyncHandler(async (req, res) => {
  const file = await filesService.remove(req.user!, req.params.id as string);
  await audit(req, { action: 'DELETE', resource: 'FILE', resourceId: file.id });
  ok(res, null, 'File deleted');
}));
