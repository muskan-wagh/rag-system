require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const WebSocket = require("ws");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: WebSocket } },
);

async function seedDatabase() {
  const results = [];
  const csvPath = path.join(__dirname, "../dataset/candidates.csv");

  function mapCSVToCandidate(row) {
    const skills = (row.skills || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      full_name: row.name || "Unknown",
      email: row.email || `unknown-${row.id}@email.com`,
      phone: row.phone || null,
      location: null,
      total_experience_years: parseFloat(row.experience || 0),
      current_company: null,
      raw_resume_text: row.summary || "No text provided.",
      parsed_json: {
        skills,
        education: {
          level: row.education_level || "",
          field: row.education_field || "",
          details: row.education_details || "",
        },
      },
      skills,
    };
  }

  console.log(`📂 Reading CSV from: ${csvPath}`);

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        const candidate = mapCSVToCandidate(row);
        if (candidate.email && !candidate.email.startsWith("unknown-")) {
          results.push(candidate);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`✅ Parsed ${results.length} candidates from CSV.`);

  const batchSize = 10;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const rows = batch.map(({ skills, ...candidate }) => candidate);

    const { data, error } = await supabase
      .from("candidates")
      .upsert(rows, { onConflict: "email", ignoreDuplicates: false })
      .select();

    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      console.log(`✅ Batch ${i / batchSize + 1} inserted.`);

      if (data) {
        for (let j = 0; j < data.length; j++) {
          const candidateSkills = batch[j].skills;
          if (candidateSkills.length > 0) {
            const skillRows = candidateSkills.map((skill) => ({
              candidate_id: data[j].id,
              skill_name: skill.toLowerCase(),
            }));
            const { error: skillErr } = await supabase
              .from("candidate_skills")
              .upsert(skillRows, {
                onConflict: "candidate_id, skill_name",
                ignoreDuplicates: true,
              });
            if (skillErr) {
              console.error(
                `  ⚠ Skills insert failed for ${data[j].full_name}:`,
                skillErr.message,
              );
            }
          }
        }
      }
    }
  }

  console.log("🎉 Database seeding complete!");
}

seedDatabase().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
