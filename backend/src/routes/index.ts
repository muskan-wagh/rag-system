import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import chatRoutes from './chatRoutes';
import analyticsRoutes from './analyticsRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);
router.use('/chat', chatRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
