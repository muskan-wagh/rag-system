/**
 * Allowed coding languages (Run + scored evaluation).
 * JavaScript ships first; the map is the extension point for the
 * builder's other languages (python/typescript/java/c/cpp/go/...).
 * Unknown languages are rejected BEFORE any provider call.
 */

export const ALLOWED_LANGUAGES = ['javascript'] as const;
export type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

// Judge0 language_id mapping (Judge0 CE API). Only javascript is
// enabled now; others are documented for later activation.
export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  javascript: 63, // Node.js
};

const ALIASES: Record<string, string> = {
  js: 'javascript',
  node: 'javascript',
  'node.js': 'javascript',
};

export function normalizeLanguage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  const canonical = ALIASES[key] || key;
  if ((ALLOWED_LANGUAGES as readonly string[]).includes(canonical)) return canonical;
  return null;
}

export function judge0LanguageId(language: string): number | null {
  return JUDGE0_LANGUAGE_IDS[language] ?? null;
}
