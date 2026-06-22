"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("@/controllers/analyticsController");
const router = (0, express_1.Router)();
router.get('/', analyticsController_1.getAnalyticsHandler);
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map