"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
const logger_2 = require("@/middleware/logger");
const errorHandler_1 = require("@/middleware/errorHandler");
const createCollection_1 = require("@/services/qdrant/createCollection");
const storage_1 = require("@/services/supabase/storage");
const routes_1 = __importDefault(require("@/routes"));
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : reason });
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || config_1.config.allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use(logger_2.requestLogger);
app.get('/', (_req, res) => {
    res.json({ service: 'RAG System API', status: 'running', endpoints: { health: '/health', api: '/api' } });
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api', routes_1.default);
app.use((err, _req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
            return;
        }
        res.status(400).json({ success: false, error: err.message });
        return;
    }
    if (err.message?.includes('Only PDF and DOCX files are allowed')) {
        res.status(400).json({ success: false, error: err.message });
        return;
    }
    next(err);
});
app.use(errorHandler_1.errorHandler);
const server = app.listen(config_1.config.port, () => {
    logger_1.logger.info(`Server running on port ${config_1.config.port} in ${config_1.config.nodeEnv} mode`);
    logger_1.logger.info(`Health check: http://localhost:${config_1.config.port}/health`);
});
server.timeout = 120000;
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger_1.logger.error(`Port ${config_1.config.port} is already in use`);
    }
    else {
        logger_1.logger.error('Server error', { error: error.message });
    }
    process.exit(1);
});
async function start() {
    try {
        await (0, createCollection_1.createCollection)();
        logger_1.logger.info('Qdrant collection ready');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Qdrant collection', { error });
    }
    try {
        await (0, storage_1.ensureResumeBucket)();
        logger_1.logger.info('Supabase storage ready');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Supabase storage', { error });
    }
}
start();
exports.default = app;
//# sourceMappingURL=server.js.map