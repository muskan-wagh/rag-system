"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJdHandler = void 0;
const asyncHandler_1 = require("@/utils/asyncHandler");
const parseJD_1 = require("@/services/llm/parseJD");
const logger_1 = require("@/utils/logger");
exports.parseJdHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText } = req.body;
    logger_1.logger.info('Parse JD request received', { textLength: jdText.length });
    const parsed = await (0, parseJD_1.parseJD)(jdText);
    res.status(200).json({
        success: true,
        data: { parsed },
    });
});
//# sourceMappingURL=jdController.js.map