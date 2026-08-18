import { ParsedJD } from '@/types';
import { logger } from '@/utils/logger';
import { getCached } from '@/utils/cache';
import { parseJD, jdCacheKey } from '@/services/llm/parseJD';
import { heuristicParseJD, setCorpusSkills } from '@/services/jd/heuristicParse';
import { getDistinctCandidateSkills } from '@/services/supabase/database';

const inFlightJd = new Set<string>();

let lexiconLoaded = false;

async function refreshSkillLexicon(): Promise<void> {
  try {
    const skills = await getDistinctCandidateSkills();
    if (skills.length > 0) {
      setCorpusSkills(skills);
      logger.info('JD skill lexicon refreshed', { count: skills.length });
    }
  } catch (error) {
    logger.warn('Failed to refresh JD skill lexicon', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function ensureLexiconLoaded(): Promise<void> {
  if (lexiconLoaded) return;
  lexiconLoaded = true;
  await refreshSkillLexicon();
}

function triggerBackgroundParse(jdText: string, key: string): void {
  if (inFlightJd.has(key)) return;
  inFlightJd.add(key);

  parseJD(jdText)
    .catch((error) => {
      logger.warn('Background JD parse failed, heuristic result remains', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      inFlightJd.delete(key);
    });
}

export async function getParsedJDBestEffort(jdText: string): Promise<ParsedJD> {
  const key = jdCacheKey(jdText);

  const cached = await getCached<ParsedJD>(key);
  if (cached) return cached;

  const heuristic = heuristicParseJD(jdText);

  triggerBackgroundParse(jdText, key);

  ensureLexiconLoaded()
    .catch(() => {})
    .then(() => {
      Object.assign(heuristic, heuristicParseJD(jdText));
    });

  return heuristic;
}
