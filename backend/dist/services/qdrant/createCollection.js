"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCollection = createCollection;
const client_1 = require("./client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
async function ensurePayloadIndex(collectionName, fieldName, fieldSchema) {
    try {
        await (0, client_1.getQdrantClient)().createPayloadIndex(collectionName, {
            field_name: fieldName,
            field_schema: fieldSchema,
            wait: false,
        });
        logger_1.logger.debug(`Payload index created for "${fieldName}"`);
    }
    catch {
        logger_1.logger.debug(`Payload index already exists for "${fieldName}"`);
    }
}
async function createCollection() {
    const client = (0, client_1.getQdrantClient)();
    const collectionName = config_1.config.qdrant.collectionName;
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);
    if (exists) {
        logger_1.logger.info(`Collection "${collectionName}" already exists`);
    }
    else {
        await client.createCollection(collectionName, {
            vectors: {
                size: config_1.config.qdrant.vectorSize,
                distance: config_1.config.qdrant.distance,
            },
        });
        logger_1.logger.info(`Collection "${collectionName}" created`);
    }
    await Promise.all([
        ensurePayloadIndex(collectionName, 'id', 'keyword'),
        ensurePayloadIndex(collectionName, 'experience', 'integer'),
        ensurePayloadIndex(collectionName, 'skills', 'keyword'),
        ensurePayloadIndex(collectionName, 'education_level', 'keyword'),
    ]);
    logger_1.logger.info(`Payload indexes ensured for "${collectionName}"`, {
        vectorSize: config_1.config.qdrant.vectorSize,
        distance: config_1.config.qdrant.distance,
    });
}
//# sourceMappingURL=createCollection.js.map