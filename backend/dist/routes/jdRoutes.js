"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jdController_1 = require("@/controllers/jdController");
const router = (0, express_1.Router)();
router.post('/parse', jdController_1.parseJdHandler);
exports.default = router;
//# sourceMappingURL=jdRoutes.js.map