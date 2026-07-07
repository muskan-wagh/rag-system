import { Candidate } from '@/types';

export function normalizeCandidatePayload(payload: Record<string, unknown>): Candidate {
  const candidate: Candidate = {
    id: String(payload.id || ''),
    name: String(payload.name || ''),
    email: payload.email ? String(payload.email) : undefined,
    phone: payload.phone ? String(payload.phone) : undefined,
    skills: Array.isArray(payload.skills) ? payload.skills.map(String) : [],
    experience: Number(payload.experience) || 0,
    education: {
      level: String(payload.education_level || ''),
      field: String(payload.education_field || ''),
    },
    summary: String(payload.summary || ''),
  };
  return candidate;
}
