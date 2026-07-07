import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import sessionRoutes from './sessionRoutes';
import uploadRoutes from './uploadRoutes';
import biasRoutes from './biasRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);
router.use('/', sessionRoutes);
router.use('/', uploadRoutes);
router.use('/', biasRoutes);

export default router;
