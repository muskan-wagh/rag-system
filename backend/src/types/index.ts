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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
  filters?: SearchFilters;
}

export interface SearchCandidatesResponse {
  results: RankingResult[];
  query: ParsedJD;
}

export interface CompareCandidatesRequest {
  jdText: string;
  candidateIds: string[];
}

export interface CompareCandidatesResponse {
  comparison: CompareResult;
  query: ParsedJD;
}

export interface ChatRequest {
  message: string;
  context?: {
    jdText?: string;
    candidateIds?: string[];
  };
}

export interface ChatResponse {
  reply: string;
}
