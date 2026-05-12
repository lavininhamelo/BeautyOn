import multer from 'multer';

const maxBytes = 10 * 1024 * 1024;

const multerConfig: NonNullable<Parameters<typeof multer>[0]> = {
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
};
export default multerConfig;
