import { ParsedJD } from '@/types';

const BASE_SKILLS = [
  'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby',
  'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'sql', 'mysql', 'postgresql',
  'postgres', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'neo4j',
  'graphql', 'rest api', 'rest', 'node.js', 'nodejs', 'express', 'express.js', 'next.js',
  'nextjs', 'react', 'react.js', 'reactjs', 'angular', 'angular.js', 'vue', 'vue.js',
  'svelte', 'redux', 'tailwind', 'tailwind css', 'css', 'html', 'html5', 'sass', 'scss',
  'bootstrap', 'material ui', 'django', 'flask', 'fastapi', 'spring', 'spring boot',
  'rails', 'ruby on rails', 'laravel', 'dotnet', '.net', 'asp.net', 'microservices',
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'git',
  'github', 'gitlab', 'bitbucket', 'aws', 'azure', 'gcp', 'google cloud', 'firebase',
  'serverless', 'lambda', 's3', 'ec2', 'ecs', 'nginx', 'apache', 'linux', 'unix', 'bash',
  'shell scripting', 'powershell', 'agile', 'scrum', 'kanban', 'devops', 'mlops',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
  'pandas', 'numpy', 'nlp', 'natural language processing', 'computer vision', 'llm',
  'large language model', 'prompt engineering', 'rag', 'retrieval augmented generation',
  'langchain', 'data science', 'data analysis', 'data engineering', 'etl', 'spark',
  'apache spark', 'hadoop', 'hive', 'airflow', 'kafka', 'rabbitmq', 'tableau',
  'power bi', 'excel', 'statistics', 'a/b testing', 'product management', 'project management',
  'jira', 'confluence', 'salesforce', 'sap', 'seo', 'ux', 'ui design', 'figma', 'photoshop',
  'illustrator', 'cybersecurity', 'security', 'networking', 'tcp/ip', 'http', 'testing',
  'unit testing', 'integration testing', 'selenium', 'cypress', 'jest', 'mocha', 'playwright',
  'graphql api', 'websockets', 'oauth', 'jwt', 'openai', 'hugging face', 'transformers',
  'android', 'ios', 'react native', 'flutter', 'mobile development', 'cucumber', 'gatsby',
  'webpack', 'vite', 'babel', 'typescript compiler', 'swagger', 'openapi', 'grpc',
  'load balancing', 'cd', 'iac', 'infrastructure as code', 'observability', 'grafana',
  'prometheus', 'datadog', 'sentry', 'cloud computing', 'agile methodologies',
];

const BASE_SKILL_SET = [...new Set(BASE_SKILLS.map((s) => s.toLowerCase().trim()))];

let corpusSkills: string[] = [];

export function setCorpusSkills(skills: string[]): void {
  corpusSkills = [...new Set([...BASE_SKILL_SET, ...skills.map((s) => s.toLowerCase().trim()).filter(Boolean)])];
}

export function getLexicon(): string[] {
  return corpusSkills.length > 0 ? corpusSkills : BASE_SKILL_SET;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesSkill(text: string, skill: string): boolean {
  const escaped = escapeRegExp(skill);
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'i').test(text);
}

const SECTION_HEADINGS = {
  responsibilities: /(responsibilities|what you['’]?ll do|what you will do|duties|role & responsibilities|role and responsibilities|about the role|the role|job duties|scope of work)/i,
  requirements: /(requirements|qualifications|minimum qualifications|preferred qualifications|must have|you have|what you need|skills & experience|skills and experience|what we need|experience & qualifications|experience and qualifications)/i,
};

function extractSection(lines: string[], key: 'responsibilities' | 'requirements', allHeadings: RegExp[]): string[] {
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isOwnHeading = SECTION_HEADINGS[key].test(trimmed);
    const isOtherHeading = allHeadings.some((re, i) => i !== (key === 'responsibilities' ? 0 : 1) && re.test(trimmed));

    if (isOwnHeading) {
      capturing = true;
      continue;
    }
    if (capturing && isOtherHeading) {
      capturing = false;
      continue;
    }
    if (!capturing) continue;

    const bullet = trimmed.replace(/^[-•*▪◦\d.)]+\s*/, '').trim();
    if (bullet && bullet.length > 2) {
      items.push(bullet.slice(0, 200));
    }
  }

  return items.slice(0, 30);
}

function extractExperience(text: string): { min: number; max: number } {
  const range = text.match(/(\d+)\s*[-–—to]+\s*(\d+)\s*(?:\+?\s*)?(?:years|yrs|y\b)/i);
  if (range) {
    return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) };
  }

  const plus = text.match(/(\d+)\s*\+\s*(?:years|yrs|y\b)/i);
  if (plus) {
    const min = parseInt(plus[1], 10);
    return { min, max: Math.max(min, 10) };
  }

  const bare = text.match(/(\d+)\s*(?:years|yrs|y\b)/i);
  if (bare) {
    const min = parseInt(bare[1], 10);
    return { min, max: min };
  }

  return { min: 0, max: 0 };
}

const EDUCATION_FIELDS = [
  'computer science', 'software engineering', 'engineering', 'business', 'mathematics',
  'physics', 'chemistry', 'biology', 'psychology', 'economics', 'finance', 'marketing',
  'law', 'medicine', 'education', 'arts', 'data science', 'information technology',
  'electrical engineering', 'mechanical engineering', 'statistics',
];

function extractEducation(text: string): { level: string; field: string } {
  let level = 'any';
  if (/ph\.?\s*d|doctorate/i.test(text)) level = 'phd';
  else if (/master|m\.?\s*s\b|m\.?\s*tech/i.test(text)) level = 'master';
  else if (/bachelor|b\.?\s*s\b|b\.?\s*tech|undergraduate/i.test(text)) level = 'bachelor';
  else if (/associate|diploma|high school|10th|12th/i.test(text)) level = 'diploma';

  let field = '';
  for (const f of EDUCATION_FIELDS) {
    if (new RegExp(`\\b${escapeRegExp(f)}\\b`, 'i').test(text)) {
      field = f;
      break;
    }
  }

  return { level, field };
}

function extractTitle(text: string): string {
  const explicit = text.match(/^\s*(?:title|position|role)\s*[:：]\s*(.+)$/im);
  if (explicit) {
    return explicit[1].trim().slice(0, 100);
  }

  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith('http') && !l.includes('@'));
  if (firstLine) {
    return firstLine.replace(/^#{1,6}\s*/, '').slice(0, 100);
  }

  return '';
}

export function heuristicParseJD(jdText: string): ParsedJD {
  const text = jdText ?? '';
  const lexicon = getLexicon();

  const matchedSkills: string[] = [];
  for (const skill of lexicon) {
    if (matchesSkill(text, skill)) matchedSkills.push(skill);
  }

  const seen = new Set<string>();
  const skills = matchedSkills.filter((s) => {
    const normalized = s.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const lines = text.split('\n');
  const allHeadings = [SECTION_HEADINGS.responsibilities, SECTION_HEADINGS.requirements];

  return {
    title: extractTitle(text),
    skills: skills.slice(0, 60),
    experience: extractExperience(text),
    education: extractEducation(text),
    responsibilities: extractSection(lines, 'responsibilities', allHeadings),
    requirements: extractSection(lines, 'requirements', allHeadings),
    rawText: text.slice(0, 20000),
  };
}
