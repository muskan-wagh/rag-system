import { Candidate, SearchFilters } from '@/types';
export interface SearchResult {
    candidate: Candidate;
    score: number;
}
export declare function searchByEmbedding(embedding: number[], limit?: number, filters?: SearchFilters): Promise<SearchResult[]>;
//# sourceMappingURL=searchCandidates.d.ts.map