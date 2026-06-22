import { Candidate, SearchFilters } from '@/types';
interface SearchResult {
    candidate: Candidate;
    score: number;
}
export declare function searchCandidates(queryText: string, limit?: number, filters?: SearchFilters): Promise<SearchResult[]>;
export {};
//# sourceMappingURL=searchCandidates.d.ts.map