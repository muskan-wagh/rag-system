import { getQdrantClient } from './client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { normalizeCandidatePayload } from './normalizePayload';
import { getSupabaseClient } from '@/services/supabase/client';

export async function retrieveCandidateByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  let qdrantResults: Candidate[] = [];

  try {
    const client = getQdrantClient();
    const result = await client.retrieve(config.qdrant.collectionName, {
      ids,
      with_payload: true,
    });

    qdrantResults = result
      .filter((p) => p.payload !== null && p.payload !== undefined)
      .map((p) => normalizeCandidatePayload(p.payload as Record<string, unknown>));
  } catch (err) {
    logger.warn('Qdrant retrieve failed, falling back to Supabase', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const foundIds = new Set(qdrantResults.map((c) => c.id));
  const missingIds = ids.filter((id) => !foundIds.has(id));

  if (missingIds.length === 0) return qdrantResults;

  const supabase = getSupabaseClient();
  const { data: records } = await supabase
    .from('candidates')
    .select('id, full_name, email, phone, total_experience_years, current_title, parsed_json')
    .in('id', missingIds);

  if (!records || records.length === 0) return qdrantResults;

  const fallbackCandidates: Candidate[] = records.map((r) => {
    const parsed = r.parsed_json as Record<string, unknown> | null;
    return {
      id: r.id,
      name: r.full_name || r.current_title || 'Unknown',
      email: r.email || undefined,
      phone: r.phone || undefined,
      skills: (parsed?.skills as string[]) || [],
      experience: r.total_experience_years || 0,
      education: {
        level: (parsed && (parsed as any).education_level) || '',
        field: (parsed && (parsed as any).education_field) || '',
      },
      summary: (parsed?.summary as string) || '',
    };
  });

  return [...qdrantResults, ...fallbackCandidates];
}
