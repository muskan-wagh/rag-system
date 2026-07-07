import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import sessionRoutes from './sessionRoutes';
import uploadRoutes from './uploadRoutes';
import searchRoutes from './searchRoutes';
import biasRoutes from './biasRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);
router.use('/', sessionRoutes);
router.use('/', uploadRoutes);
router.use('/', searchRoutes);
router.use('/', biasRoutes);
router.use('/', adminRoutes);

export default router;
