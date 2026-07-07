require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { pipeline } = require('@xenova/transformers');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION_NAME || 'candidates';

if (!supabaseUrl || !supabaseKey || !qdrantUrl || !qdrantApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model (Xenova/all-MiniLM-L6-v2)...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    console.log('Embedding model loaded');
  }
  return embedder;
}

async function generateEmbedding(text) {
  const extractor = await getEmbedder();
  const result = await extractor(text.slice(0, 10000), {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(result.data);
}

async function seed() {
  console.log('=== RecruitIQ Seed Script ===');
  console.log(`Supabase: ${supabaseUrl}`);
  console.log(`Qdrant: ${qdrantUrl}`);
  console.log(`Collection: ${collectionName}`);

  let totalProcessed = 0;
  let totalErrors = 0;
  let offset = 0;
  const batchSize = 10;

  while (true) {
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Failed to fetch candidates:', error.message);
      break;
    }

    if (!candidates || candidates.length === 0) {
      console.log('No more candidates to process');
      break;
    }

    console.log(`\nProcessing batch of ${candidates.length} candidates (offset ${offset})...`);

    for (const candidate of candidates) {
      try {
        const embeddingText = [
          candidate.full_name || '',
          `Skills: ${(candidate.parsed_json?.skills || []).join(', ')}`,
          `Experience: ${candidate.total_experience_years || 0} years`,
          (candidate.raw_resume_text || '').slice(0, 3000),
        ].filter(Boolean).join('. ');

        if (!embeddingText) {
          console.log(`  Skipping ${candidate.id}: no text available`);
          continue;
        }

        const embedding = await generateEmbedding(embeddingText);

        const skills = candidate.parsed_json?.skills || [];
        if (skills.length > 0) {
          const { data: existingSkills } = await supabase
            .from('candidate_skills')
            .select('skill_name')
            .eq('candidate_id', candidate.id);

          if (!existingSkills || existingSkills.length === 0) {
            const rows = skills.map((s) => ({
              candidate_id: candidate.id,
              skill_name: s.toLowerCase().trim(),
            }));
            const { error: skillError } = await supabase
              .from('candidate_skills')
              .insert(rows);
            if (skillError) {
              console.log(`  Skills insert warning (${candidate.id}): ${skillError.message}`);
            } else {
              console.log(`  Inserted ${rows.length} skills for ${candidate.id}`);
            }
          }
        }

        if (!candidate.processing_status) {
          await supabase
            .from('candidates')
            .update({ processing_status: 'COMPLETED' })
            .eq('id', candidate.id);
        }

        const qdrantPayload = {
          id: candidate.id,
          name: candidate.full_name || 'Unknown',
          email: candidate.email || '',
          skills: skills,
          experience: candidate.total_experience_years || 0,
          summary: (candidate.raw_resume_text || '').slice(0, 500),
          source: candidate.source || '',
        };

        const response = await fetch(`${qdrantUrl}/collections/${collectionName}/points`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'api-key': qdrantApiKey,
          },
          body: JSON.stringify({
            points: [{
              id: candidate.id,
              vector: embedding,
              payload: qdrantPayload,
            }],
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Qdrant upsert failed: ${response.status} ${body}`);
        }

        totalProcessed++;
        console.log(`  ✓ ${candidate.id}: ${candidate.full_name || 'Unnamed'} (${skills.length} skills)`);
      } catch (err) {
        totalErrors++;
        console.error(`  ✗ ${candidate.id}: ${err.message}`);
      }
    }

    offset += batchSize;
  }

  console.log(`\n=== Seed complete ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
