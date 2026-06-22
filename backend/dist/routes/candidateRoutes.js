"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const candidateController_1 = require("@/controllers/candidateController");
const router = (0, express_1.Router)();
router.post('/search', candidateController_1.searchCandidatesHandler);
router.post('/compare', candidateController_1.compareCandidatesHandler);
router.post('/batch', candidateController_1.batchCandidatesHandler);
router.get('/:id', candidateController_1.getCandidateHandler);
exports.default = router;
//# sourceMappingURL=candidateRoutes.js.map