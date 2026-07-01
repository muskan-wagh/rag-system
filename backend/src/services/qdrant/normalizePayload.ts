import { Candidate } from '@/types';

export function normalizeCandidatePayload(payload: Record<string, unknown>): Candidate {
  const candidate: Candidate = {
    id: String(payload.id || ''),
    name: String(payload.name || ''),
    email: payload.email ? String(payload.email) : undefined,
    phone: payload.phone ? String(payload.phone) : undefined,
    skills: Array.isArray(payload.skills) ? payload.skills.map(String) : [],
    experience: Number(payload.experience) || 0,
    education: normalizeEducation(payload),
    summary: String(payload.summary || ''),
  };
  return candidate;
}

function normalizeEducation(payload: Record<string, unknown>): { level: string; field: string; details?: string } {
  if (payload.education && typeof payload.education === 'object' && payload.education !== null) {
    const edu = payload.education as Record<string, unknown>;
    return {
      level: String(edu.level || ''),
      field: String(edu.field || ''),
      details: edu.details ? String(edu.details) : undefined,
    };
  }
  return {
    level: String(payload.education_level || ''),
    field: String(payload.education_field || ''),
  };
}
