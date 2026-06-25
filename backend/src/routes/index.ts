import { Router } from 'express';
import jdRoutes from './jdRoutes';
import candidateRoutes from './candidateRoutes';

const router = Router();

router.use('/jd', jdRoutes);
router.use('/candidates', candidateRoutes);

export default router;
