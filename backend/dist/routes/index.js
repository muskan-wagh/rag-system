"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jdRoutes_1 = __importDefault(require("./jdRoutes"));
const candidateRoutes_1 = __importDefault(require("./candidateRoutes"));
const chatRoutes_1 = __importDefault(require("./chatRoutes"));
const router = (0, express_1.Router)();
router.use('/jd', jdRoutes_1.default);
router.use('/candidates', candidateRoutes_1.default);
router.use('/chat', chatRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map