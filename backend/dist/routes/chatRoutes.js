"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("@/controllers/chatController");
const router = (0, express_1.Router)();
router.post('/', chatController_1.chatHandler);
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map