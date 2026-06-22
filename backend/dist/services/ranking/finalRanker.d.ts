import { Candidate, ParsedJD, RankingResult } from '@/types';
export declare function rankCandidate(candidate: Candidate, jd: ParsedJD): Promise<RankingResult>;
export declare function rankCandidates(candidates: Candidate[], jd: ParsedJD): Promise<RankingResult[]>;
//# sourceMappingURL=finalRanker.d.ts.map