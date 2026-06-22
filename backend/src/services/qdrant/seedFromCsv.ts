import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { createCollection } from './createCollection';
import { insertCandidates } from './insertCandidate';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';

interface CsvRow {
  id?: string;
  name?: string;
  skills?: string;
  experience?: string;
  education_level?: string;
  education_field?: string;
  education_details?: string;
  summary?: string;
  email?: string;
  phone?: string;
  [key: string]: string | undefined;
}

function mapRowToCandidate(row: CsvRow, index: number): Candidate {
  return {
    id: row.id || `candidate-${index}`,
    name: row.name || 'Unknown',
    email: row.email,
    phone: row.phone,
    skills: (row.skills || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    experience: parseFloat(row.experience || '0') || 0,
    education: {
      level: (row.education_level || '').toLowerCase(),
      field: row.education_field || '',
      details: row.education_details,
    },
    summary: row.summary || '',
  };
}

async function seedFromCsv(csvPath: string): Promise<void> {
  const absolutePath = path.resolve(csvPath);

  if (!fs.existsSync(absolutePath)) {
    logger.error(`CSV file not found: ${absolutePath}`);
    process.exit(1);
  }

  logger.info(`Reading candidates from: ${absolutePath}`);

  const rows: CsvRow[] = await new Promise((resolve, reject) => {
    const results: CsvRow[] = [];
    fs.createReadStream(absolutePath)
      .pipe(csvParser())
      .on('data', (data: CsvRow) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });

  logger.info(`Parsed ${rows.length} rows from CSV`);

  if (rows.length === 0) {
    logger.warn('CSV is empty, nothing to seed');
    return;
  }

  const candidates: Candidate[] = rows.map(mapRowToCandidate);

  logger.info('Sample candidate', {
    first: {
      id: candidates[0].id,
      name: candidates[0].name,
      skills: candidates[0].skills.slice(0, 5),
      experience: candidates[0].experience,
    },
  });

  await createCollection();
  await insertCandidates(candidates);

  logger.info(`Seeding complete: ${candidates.length} candidates inserted`);
}

const csvPath = process.argv[2] || './dataset/candidates.csv';

seedFromCsv(csvPath).catch((error) => {
  logger.error('Seeding failed', { error });
  process.exit(1);
});
