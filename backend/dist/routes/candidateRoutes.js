"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const candidateController_1 = require("@/controllers/candidateController");
const router = (0, express_1.Router)();
router.post('/search', candidateController_1.searchCandidatesHandler);
router.post('/compare', candidateController_1.compareCandidatesHandler);
router.post('/batch', candidateController_1.batchCandidatesHandler);
router.get('/:id', candidateController_1.getCandidateHandler);
router.patch('/:id/status', candidateController_1.updateCandidateStatusHandler);
router.post('/:id/notes', candidateController_1.addCandidateNoteHandler);
router.get('/:id/notes', candidateController_1.getCandidateNotesHandler);
router.post('/:id/screening-questions', candidateController_1.screeningQuestionsHandler);
router.post('/:id/closing-strategy', candidateController_1.closingStrategyHandler);
router.get('/:id/similar', candidateController_1.getSimilarCandidatesHandler);
exports.default = router;
//# sourceMappingURL=candidateRoutes.js.map