"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const candidateController_1 = require("@/controllers/candidateController");
const validate_1 = require("@/middleware/validate");
const router = (0, express_1.Router)();
router.get('/', candidateController_1.getAllCandidatesHandler);
router.post('/search', (0, validate_1.validate)(validate_1.searchSchema), candidateController_1.searchCandidatesHandler);
router.post('/compare', (0, validate_1.validate)(validate_1.compareSchema), candidateController_1.compareCandidatesHandler);
router.post('/batch', (0, validate_1.validate)(validate_1.batchSchema), candidateController_1.batchCandidatesHandler);
router.get('/:id', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), candidateController_1.getCandidateHandler);
router.patch('/:id/status', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), (0, validate_1.validate)(validate_1.updateStatusSchema), candidateController_1.updateCandidateStatusHandler);
router.post('/:id/notes', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), (0, validate_1.validate)(validate_1.addNoteSchema), candidateController_1.addCandidateNoteHandler);
router.get('/:id/notes', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), candidateController_1.getCandidateNotesHandler);
router.post('/:id/screening-questions', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), candidateController_1.screeningQuestionsHandler);
router.post('/:id/closing-strategy', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), candidateController_1.closingStrategyHandler);
router.get('/:id/similar', (0, validate_1.validate)(validate_1.idParamSchema, 'params'), candidateController_1.getSimilarCandidatesHandler);
exports.default = router;
//# sourceMappingURL=candidateRoutes.js.map