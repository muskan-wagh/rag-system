import { Router } from 'express';
import {
  listAssessmentsHandler,
  createAssessmentHandler,
  getAssessmentHandler,
  updateAssessmentHandler,
  publishAssessmentHandler,
  unpublishAssessmentHandler,
  deleteAssessmentHandler,
  addQuestionHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  duplicateQuestionHandler,
  reorderQuestionsHandler,
  eligibleCandidatesHandler,
  listInvitesHandler,
  createInvitesHandler,
  resendInviteHandler,
  revokeInviteHandler,
} from '@/controllers/assessmentController';
import {
  validate,
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentIdParamSchema,
  assessmentQuestionParamSchema,
  questionPayloadSchema,
  reorderQuestionsSchema,
  createInvitesSchema,
} from '@/middleware/validate';

const router = Router();

// Assessments
router.get('/', listAssessmentsHandler);
router.post('/', validate(createAssessmentSchema), createAssessmentHandler);
router.get('/:assessmentId', validate(assessmentIdParamSchema, 'params'), getAssessmentHandler);
// Explicit Save Draft — no autosave (correction #11).
router.patch(
  '/:assessmentId',
  validate(assessmentIdParamSchema, 'params'),
  validate(updateAssessmentSchema),
  updateAssessmentHandler,
);
router.delete('/:assessmentId', validate(assessmentIdParamSchema, 'params'), deleteAssessmentHandler);
router.post('/:assessmentId/publish', validate(assessmentIdParamSchema, 'params'), publishAssessmentHandler);
router.post('/:assessmentId/unpublish', validate(assessmentIdParamSchema, 'params'), unpublishAssessmentHandler);

// Questions (draft-only enforced in the controller)
router.post(
  '/:assessmentId/questions',
  validate(assessmentIdParamSchema, 'params'),
  validate(questionPayloadSchema),
  addQuestionHandler,
);
router.put(
  '/:assessmentId/questions/reorder',
  validate(assessmentIdParamSchema, 'params'),
  validate(reorderQuestionsSchema),
  reorderQuestionsHandler,
);
router.patch(
  '/:assessmentId/questions/:questionId',
  validate(assessmentQuestionParamSchema, 'params'),
  validate(questionPayloadSchema),
  updateQuestionHandler,
);
router.delete(
  '/:assessmentId/questions/:questionId',
  validate(assessmentQuestionParamSchema, 'params'),
  deleteQuestionHandler,
);
router.post(
  '/:assessmentId/questions/:questionId/duplicate',
  validate(assessmentQuestionParamSchema, 'params'),
  duplicateQuestionHandler,
);

// Eligible candidates + invites (Resend only; Gmail untouched)
router.get('/:assessmentId/eligible-candidates', validate(assessmentIdParamSchema, 'params'), eligibleCandidatesHandler);
router.get('/:assessmentId/invites', validate(assessmentIdParamSchema, 'params'), listInvitesHandler);
router.post(
  '/:assessmentId/invites',
  validate(assessmentIdParamSchema, 'params'),
  validate(createInvitesSchema),
  createInvitesHandler,
);
router.post('/:assessmentId/invites/:candidateId/resend', validate(assessmentIdParamSchema, 'params'), resendInviteHandler);
router.post('/:assessmentId/invites/:candidateId/revoke', validate(assessmentIdParamSchema, 'params'), revokeInviteHandler);

export default router;
