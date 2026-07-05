"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const createCollection_1 = require("./createCollection");
const insertCandidate_1 = require("./insertCandidate");
const logger_1 = require("@/utils/logger");
function deterministicUuid(seed) {
    const hash = crypto_1.default.createHash('md5').update(seed).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
function mapRowToCandidate(row, index) {
    return {
        id: deterministicUuid(row.email || `candidate-${index}`),
        name: row.name || 'Unknown',
        email: row.email,
        phone: row.phone,
        skills: (row.skills || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        experience: parseFloat(row.experience || '0') || 0,
        education: {
            level: (row.education_level || '').toLowerCase(),
            field: row.education_field || '',
            details: row.education_details,
        },
        summary: row.summary || '',
    };
}
async function seedFromCsv(csvPath) {
    const absolutePath = path_1.default.resolve(csvPath);
    if (!fs_1.default.existsSync(absolutePath)) {
        logger_1.logger.error(`CSV file not found: ${absolutePath}`);
        process.exit(1);
    }
    logger_1.logger.info(`Reading candidates from: ${absolutePath}`);
    const rows = await new Promise((resolve, reject) => {
        const results = [];
        fs_1.default.createReadStream(absolutePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
    logger_1.logger.info(`Parsed ${rows.length} rows from CSV`);
    if (rows.length === 0) {
        logger_1.logger.warn('CSV is empty, nothing to seed');
        return;
    }
    const candidates = rows.map(mapRowToCandidate);
    logger_1.logger.info('Sample candidate', {
        first: {
            id: candidates[0].id,
            name: candidates[0].name,
            skills: candidates[0].skills.slice(0, 5),
            experience: candidates[0].experience,
        },
    });
    await (0, createCollection_1.createCollection)();
    await (0, insertCandidate_1.insertCandidates)(candidates);
    logger_1.logger.info(`Seeding complete: ${candidates.length} candidates inserted`);
}
const csvPath = process.argv[2] || './dataset/candidates.csv';
seedFromCsv(csvPath).catch((error) => {
    logger_1.logger.error('Seeding failed', { error });
    process.exit(1);
});
//# sourceMappingURL=seedFromCsv.js.map