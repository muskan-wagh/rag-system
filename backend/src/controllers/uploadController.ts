import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSession, insertCandidate, insertSkills } from '@/services/supabase/database';
import { uploadResumeFile } from '@/services/supabase/storage';
import { extractResumeText, sanitizeText } from '@/services/resume-parser';
import { generateEmbedding } from '@/services/llm/client';
import { parseResume } from '@/services/llm/parseResume';
import { analyzeFlightRisk } from '@/services/llm/flightRisk';
import { getQdrantClient } from '@/services/qdrant/client';
import { config } from '@/config';
import { enqueue } from '@/services/queue';
import { logger } from '@/utils/logger';

export const uploadResumeHandler = asyncHandler(async (req: Request, res: Response) => {
  const uuid = req.params.uuid as string;

  if (!uuid) {
    res.status(400).json({ success: false, error: 'Upload session UUID is required' });
    return;
  }

  const session = await getSession(uuid);
  if (!session) {
    res.status(404).json({ success: false, error: 'Invalid upload link. This session does not exist.' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded. Please attach a PDF or DOCX resume.' });
    return;
  }

  const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
  const isDocx =
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.originalname.endsWith('.docx');

  if (!isPdf && !isDocx) {
    res.status(400).json({ success: false, error: 'Unsupported file format. Please upload a PDF or DOCX file.' });
    return;
  }

  logger.info('Resume upload received', {
    sessionId: uuid,
    fileName: file.originalname,
    fileSize: file.size,
  });

  try {
    const storagePath = await uploadResumeFile(uuid, file.originalname, file.buffer, file.mimetype);

    const rawText = await extractResumeText(file.buffer, file.mimetype);
    const cleanText = sanitizeText(rawText);

    const parsed = await parseResume(cleanText);
    const flightRisk = await analyzeFlightRisk(cleanText, parsed);

    const candidate = await insertCandidate({
      upload_session_id: uuid,
      full_name: parsed.full_name || 'Unknown',
      email: parsed.email || undefined,
      phone: parsed.phone || undefined,
      location: parsed.location || undefined,
      current_company: parsed.current_company || undefined,
      total_experience_years: parsed.total_experience_years || 0,
      raw_resume_text: cleanText,
      parsed_json: parsed as unknown as Record<string, unknown>,
      flight_risk: flightRisk.flight_risk,
      growth_trajectory: flightRisk.growth_trajectory,
    });

    if (parsed.skills.length > 0) {
      await insertSkills(candidate.id, parsed.skills);
    }

    enqueue(`embed-${candidate.id}`, async () => {
      try {
        const embeddingText = [
          parsed.full_name,
          `Skills: ${parsed.skills.join(', ')}`,
          `Experience: ${parsed.total_experience_years} years`,
          `Education: ${parsed.education}`,
          cleanText.slice(0, 3000),
        ]
          .filter(Boolean)
          .join('. ');

        const embedding = await generateEmbedding(embeddingText);
        const qdrant = getQdrantClient();
        await qdrant.upsert(config.qdrant.collectionName, {
          points: [
            {
              id: candidate.id,
              vector: embedding,
              payload: {
                id: candidate.id,
                name: parsed.full_name,
                email: parsed.email,
                skills: parsed.skills,
                experience: parsed.total_experience_years,
                education: { level: '', field: '', details: parsed.education },
                summary: cleanText.slice(0, 500),
              },
            },
          ],
        });
        logger.info('Candidate embedded and stored in Qdrant', { candidateId: candidate.id });
      } catch (error) {
        logger.error('Failed to embed candidate', { candidateId: candidate.id, error });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Resume uploaded and processed successfully',
        candidateId: candidate.id,
        name: parsed.full_name,
      },
    });
  } catch (error) {
    logger.error('Upload processing failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to process resume. Please try again.',
    });
  }
});
