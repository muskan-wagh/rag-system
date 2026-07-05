// backend/src/seedDatabase.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function seedDatabase() {
  const results = [];
  const csvPath = path.join(__dirname, "../dataset/candidates.csv");

  // ✅ EDIT THIS MAPPER TO MATCH YOUR CSV HEADERS
  function mapCSVToCandidate(row) {
    return {
      full_name:
        row["Name"] || row["Full Name"] || row["Candidate"] || "Unknown",
      email: row["Email"] || row["Email ID"] || "unknown@email.com",
      phone: row["Phone"] || row["Contact"] || null,
      location: row["Location"] || row["City"] || null,
      total_experience_years: parseFloat(
        row["Experience"] || row["Total Exp"] || 0,
      ),
      current_company: row["Current Company"] || row["Company"] || null,
      raw_resume_text:
        row["Resume Text"] ||
        row["Raw Text"] ||
        row["Description"] ||
        "No text provided.",
    };
  }

  console.log(`📂 Reading CSV from: ${csvPath}`);

  // Read CSV stream
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        const candidate = mapCSVToCandidate(row);
        // Avoid duplicates by checking email
        if (candidate.email && candidate.email !== "unknown@email.com") {
          results.push(candidate);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(
    `✅ Parsed ${results.length} candidates from CSV. Inserting into Supabase...`,
  );

  // Insert in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("candidates")
      .upsert(batch, { onConflict: "email", ignoreDuplicates: false });

    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      console.log(`✅ Batch ${i / batchSize + 1} inserted.`);
    }
  }

  console.log("🎉 Database seeding complete!");
}

seedDatabase().catch(console.error);
