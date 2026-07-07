"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jdController_1 = require("@/controllers/jdController");
const validate_1 = require("@/middleware/validate");
const router = (0, express_1.Router)();
router.post('/parse', (0, validate_1.validate)(validate_1.jdTextSchema), jdController_1.parseJdHandler);
exports.default = router;
//# sourceMappingURL=jdRoutes.js.map