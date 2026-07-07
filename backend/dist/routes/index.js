"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jdRoutes_1 = __importDefault(require("./jdRoutes"));
const candidateRoutes_1 = __importDefault(require("./candidateRoutes"));
const sessionRoutes_1 = __importDefault(require("./sessionRoutes"));
const uploadRoutes_1 = __importDefault(require("./uploadRoutes"));
const searchRoutes_1 = __importDefault(require("./searchRoutes"));
const biasRoutes_1 = __importDefault(require("./biasRoutes"));
const adminRoutes_1 = __importDefault(require("./adminRoutes"));
const router = (0, express_1.Router)();
router.use('/jd', jdRoutes_1.default);
router.use('/candidates', candidateRoutes_1.default);
router.use('/', sessionRoutes_1.default);
router.use('/', uploadRoutes_1.default);
router.use('/', searchRoutes_1.default);
router.use('/', biasRoutes_1.default);
router.use('/', adminRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map