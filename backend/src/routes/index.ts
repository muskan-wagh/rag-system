import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';
import chatRoutes from './chatRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);
router.use('/chat', chatRoutes);

export default router;
