import { Router } from 'express';
import {
  getCandidateReportHandler,
  downloadCandidateReportHandler,
} from '@/controllers/reportController';
import { candidateAuthMiddleware } from '@/middleware/candidateAuth';

// Recruiter report endpoints live on candidateRoutes (/:id/reports*,
// /:id/final-decision) alongside the other candidate-scoped handlers —
// see backend/src/routes/candidateRoutes.ts. This module owns ONLY the
// candidate self-service pair (session cookie; candidate-safe ONLY —
// no reportType param is ever accepted here).
export const candidateReportRouter = Router();
candidateReportRouter.get('/report', candidateAuthMiddleware, getCandidateReportHandler);
candidateReportRouter.get('/report/download', candidateAuthMiddleware, downloadCandidateReportHandler);

export default candidateReportRouter;
