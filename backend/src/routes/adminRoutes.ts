import { Router } from 'express';
import { reprocessHandler } from '@/controllers/adminController';

const router = Router();

router.get('/admin/reprocess', reprocessHandler);

export default router;
