export interface Candidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: number;
  education: {
    level: string;
    field: string;
    details?: string;
  };
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedJD {
  title: string;
  skills: string[];
  experience: {
    min: number;
    max: number;
  };
  education: {
    level: string;
    field: string;
  };
  responsibilities: string[];
  requirements: string[];
  rawText: string;
}

export interface RankingScore {
  skill: number;
  experience: number;
  education: number;
  overall: number;
}

export interface RankingResult {
  candidate: Candidate;
  scores: RankingScore;
  explanation: string;
}

export interface CompareResult {
  candidates: Array<{
    candidate: Candidate;
    scores: RankingScore;
  }>;
  summary: string;
}

export interface SearchFilters {
  minExperience?: number;
  maxExperience?: number;
  skills?: string[];
  educationLevel?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface ParseJDRequest {
  jdText: string;
}

export interface ParseJDResponse {
  parsed: ParsedJD;
}

export interface SearchCandidatesRequest {
  jdText: string;
  limit?: number;
  page?: number;
  filters?: SearchFilters;
}

export interface SearchCandidatesResponse {
  results: RankingResult[];
  query: ParsedJD;
  total: number;
  page: number;
  totalPages: number;
}

export interface CompareCandidatesRequest {
  jdText: string;
  candidateIds: string[];
}

export interface CompareCandidatesResponse {
  comparison: CompareResult;
  query: ParsedJD;
}

export interface CandidateBrief {
  candidate: Candidate;
  record: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    currentCompany?: string;
    currentTitle?: string;
    totalExperienceYears?: number;
    rawResumeText?: string;
    resumeFileUrl?: string;
    flightRisk?: string;
    growthTrajectory?: string;
    currentStatus?: string;
    createdAt?: string;
  };
  parsedResume: Record<string, unknown> | null;
  notes: Array<{ id: string; note_text: string; created_at: string }>;
  timeline: Array<{ id: string; status: string; changed_at: string; changed_by: string; details: Record<string, unknown> | null }>;
  similarCandidates: Candidate[];
  scores: {
    skill: number;
    experience: number;
    education: number;
    overall: number;
  } | null;
}

import { RecruiterRecord } from '@/services/supabase/database';

declare global {
  namespace Express {
    interface Request {
      recruiter?: RecruiterRecord;
    }
  }
}


