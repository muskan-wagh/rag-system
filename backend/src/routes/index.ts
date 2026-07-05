import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import sessionRoutes from './sessionRoutes';
import uploadRoutes from './uploadRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);
router.use('/', sessionRoutes);
router.use('/', uploadRoutes);

export default router;
