"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveCandidateByIds = retrieveCandidateByIds;
const client_1 = require("./client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
const normalizePayload_1 = require("./normalizePayload");
const client_2 = require("@/services/supabase/client");
async function retrieveCandidateByIds(ids) {
    if (ids.length === 0)
        return [];
    let qdrantResults = [];
    try {
        const client = (0, client_1.getQdrantClient)();
        const result = await client.retrieve(config_1.config.qdrant.collectionName, {
            ids,
            with_payload: true,
        });
        qdrantResults = result
            .filter((p) => p.payload !== null && p.payload !== undefined)
            .map((p) => (0, normalizePayload_1.normalizeCandidatePayload)(p.payload));
    }
    catch (err) {
        logger_1.logger.warn('Qdrant retrieve failed, falling back to Supabase', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    const foundIds = new Set(qdrantResults.map((c) => c.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (missingIds.length === 0)
        return qdrantResults;
    const supabase = (0, client_2.getSupabaseClient)();
    const { data: records } = await supabase
        .from('candidates')
        .select('id, full_name, email, phone, total_experience_years, current_title, parsed_json')
        .in('id', missingIds);
    if (!records || records.length === 0)
        return qdrantResults;
    const fallbackCandidates = records.map((r) => {
        const parsed = r.parsed_json;
        return {
            id: r.id,
            name: r.full_name || r.current_title || 'Unknown',
            email: r.email || undefined,
            phone: r.phone || undefined,
            skills: parsed?.skills || [],
            experience: r.total_experience_years || 0,
            education: {
                level: (parsed && parsed.education_level) || '',
                field: (parsed && parsed.education_field) || '',
            },
            summary: parsed?.summary || '',
        };
    });
    return [...qdrantResults, ...fallbackCandidates];
}
//# sourceMappingURL=retrieveCandidates.js.map