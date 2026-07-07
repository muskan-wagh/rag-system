import { Router } from 'express';
import multer from 'multer';
import { uploadResumeHandler } from '@/controllers/uploadController';
import { validate, idParamSchema } from '@/middleware/validate';

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    const isDocx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.endsWith('.docx');
    if (isPdf || isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

const router = Router();

router.post('/upload/:uuid', validate(idParamSchema, 'params'), upload.single('resume'), uploadResumeHandler);

export default router;