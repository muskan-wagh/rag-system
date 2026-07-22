export function extractJson<T>(raw: string): T | null {
  const candidates = tryExtract(raw);

  for (const strategy of candidates) {
    try {
      return JSON.parse(strategy) as T;
    } catch {}
  }

  const repaired = candidates
    .map(fixCommonJsonIssues)
    .filter((s): s is string => s !== null);
  const unique = [...new Set(repaired)];

  for (const strategy of unique) {
    try {
      return JSON.parse(strategy) as T;
    } catch {}
  }

  return null;
}

function tryExtract(raw: string): string[] {
  const results: string[] = [];
  const cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/\s*```/g, '')
    .trim();

  results.push(raw);
  if (cleaned !== raw) results.push(cleaned);

  for (const s of [raw, cleaned]) {
    const regions = findJsonRegions(s);
    for (const region of regions) {
      results.push(s.slice(region.start, region.end + 1));
    }
  }

  return results;
}

function findJsonRegions(s: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  const lastBrace = s.lastIndexOf('}');
  if (lastBrace === -1) return regions;

  for (let i = 0; i <= lastBrace; i++) {
    if (s[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          regions.push({ start: i, end: j });
          break;
        }
      }
    }
  }

  return regions;
}

function fixCommonJsonIssues(str: string): string | null {
  let fixed = str
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)(\s*:)/g, '$1"$2"$3');

  if (fixed.includes("'")) {
    fixed = fixed.replace(/'/g, '"');
  }

  fixed = fixed
    .replace(/\\'/g, "'")
    .replace(/(?<!\\)\\"/g, '"')
    .replace(/\\n/g, '\\\\n')
    .replace(/\\t/g, '\\\\t');

  fixed = fixed.trim();
  if (fixed.startsWith('{') || fixed.startsWith('[')) {
    return fixed;
  }
  return null;
}
