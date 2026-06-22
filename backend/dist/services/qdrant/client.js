"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQdrantClient = getQdrantClient;
exports.healthCheck = healthCheck;
const js_client_rest_1 = require("@qdrant/js-client-rest");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
let client = null;
function getQdrantClient() {
    if (!client) {
        client = new js_client_rest_1.QdrantClient({
            url: config_1.config.qdrant.url,
            apiKey: config_1.config.qdrant.apiKey,
        });
        logger_1.logger.info('Qdrant client initialized');
    }
    return client;
}
async function healthCheck() {
    try {
        const qdrant = getQdrantClient();
        const collections = await qdrant.getCollections();
        return Array.isArray(collections.collections);
    }
    catch (error) {
        logger_1.logger.error('Qdrant health check failed', { error });
        return false;
    }
}
//# sourceMappingURL=client.js.map