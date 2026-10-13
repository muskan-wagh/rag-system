import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PIPELINE_STAGES,
  STAGE_OUTCOMES,
  LEGACY_STAGE_ALIASES,
} from "@/services/hiring/stageTypes";

/**
 * Schema contract: every value the application writes must be permitted by
 * every CHECK constraint that governs its column, in EVERY SQL source.
 *
 * ── Why this test exists ──────────────────────────────────────────────────────
 * `supabase_setup.sql` is the documented way to provision a database, and it had
 * drifted behind the code on four columns. The worst was
 * `assessment_invites.status`, which omitted `'completed'` — the exact value
 * `candidateAssessmentController` writes after persisting an evaluated attempt.
 * On a database built from that file alone, EVERY assessment submission failed
 * with a 23514 constraint violation.
 *
 * It failed SILENTLY: that update's return value was discarded, so the attempt
 * scored normally, the invite stayed `'sent'`, and the workspace showed a
 * finished candidate as "Invited" forever.
 *
 * This test parses the actual SQL rather than restating it, so the two cannot
 * drift apart again without CI going red.
 */

const ROOT = join(__dirname, "..");
const SETUP_PATH = join(ROOT, "..", "supabase_setup.sql");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

/** Every `assessment_invites.status` value the code writes today. */
const INVITE_STATUS_WRITTEN = [
  "sent", // createInvitesHandler
  "opened", // exchangeTokenHandler, on first open
  "completed", // submitAttemptHandler, after a persisted + evaluated attempt
  "revoked", // revokeInviteHandler
] as const;

/** Reserved by the schema and the middleware, but not written today. */
const INVITE_STATUS_RESERVED = ["started", "expired"] as const;

/** Every `interviews.status` value the live/flow controllers accept. */
const INTERVIEW_STATUS_WRITTEN = [
  "scheduled",
  "joined",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const setupSql = readFileSync(SETUP_PATH, "utf8");
const migrationSql = Object.fromEntries(
  MIGRATION_FILES.map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), "utf8")]),
);

/**
 * The body of `CREATE TABLE IF NOT EXISTS <table> ( ... )`.
 *
 * Every extraction is scoped to this block. Without it, a regex looking for
 * `CHECK (status IN (...))` happily matches `interviews.status` while claiming
 * to describe `candidate_status_log.status` — which is how a green test can
 * assert nothing.
 */
function tableBlock(sql: string, table: string): string {
  const parts: string[] = [];

  // The CREATE TABLE body.
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  if (start !== -1) {
    const end = sql.indexOf("\n);", start);
    parts.push(end === -1 ? sql.slice(start) : sql.slice(start, end));
  }

  // ALTER TABLE ... ADD CONSTRAINT on this table. `candidate_status_log.status`
  // is constrained this way, so scanning only the CREATE TABLE body would find
  // nothing and quietly assert nothing.
  for (const m of sql.matchAll(
    new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b[\\s\\S]*?;`, "gi"),
  )) {
    parts.push(m[0]);
  }

  return parts.join("\n");
}

/**
 * Extract the permitted values of the CHECK governing `<table>.<column>`.
 *
 * Handles both forms Postgres accepts, because either can be the only one
 * present in a given file:
 *   CHECK (col IN ('a','b'))                          — inline column constraint
 *   CONSTRAINT n CHECK (col IN ('a','b'))             — named table constraint
 *   CHECK (col = ANY(ARRAY['a','b']))                 — form used by 20261009
 *
 * Returns null when the column has no CHECK, which means unconstrained rather
 * than wrongly constrained.
 */
function allowedValues(sql: string, table: string, column: string): string[] | null {
  const block = tableBlock(sql, table);
  // NO fallback to the whole file when the table is absent. Scanning everything
  // makes a regex match some OTHER table's CHECK — e.g. asking for
  // `assessment_attempts.status` (created by 20261002, not in supabase_setup.sql)
  // would silently return `interviews.status`'s value list and assert against
  // the wrong constraint. A table that is not in this file means "not
  // constrained here".
  if (!block) return null;
  const searchIn = block;
  const results: string[] = [];

  const forms: RegExp[] = [
    // CONSTRAINT n CHECK (col IN (...))
    new RegExp(
      `CONSTRAINT\\s+\\w+\\s+CHECK\\s*\\(\\s*"?${column}"?\\s+IS\\s+NULL\\s+OR\\s+"?${column}"?\\s+=\\s*ANY\\s*\\(\\s*ARRAY\\[(.*?)\\]\\s*\\)`,
      "gsi",
    ),
    new RegExp(
      `CONSTRAINT\\s+\\w+\\s+CHECK\\s*\\(\\s*"?${column}"?\\s+IN\\s*\\(([^)]*)\\)\\s*\\)`,
      "gsi",
    ),
    // col ... CHECK (col IN (...))
    new RegExp(`"?${column}"?\\s+[^,\\n]*?CHECK\\s*\\(\\s*"?${column}"?\\s+IN\\s*\\(([^)]*)\\)\\s*\\)`, "gsi"),
    // bare CHECK (col IN (...)) inside the table body
    new RegExp(`CHECK\\s*\\(\\s*"?${column}"?\\s+IN\\s*\\(([^)]*)\\)\\s*\\)`, "gsi"),
    new RegExp(
      `CHECK\\s*\\(\\s*"?${column}"?\\s+IS\\s+NULL\\s+OR\\s+"?${column}"?\\s*=\\s*ANY\\s*\\(\\s*ARRAY\\[(.*?)\\]\\s*\\)`,
      "gsi",
    ),
    // CONSTRAINT n CHECK (col IS NULL OR col IN ( ... ))
    new RegExp(
      `CHECK\\s*\\(\\s*"?${column}"?\\s+IS\\s+NULL\\s+OR\\s+"?${column}"?\\s+IN\\s*\\(([^)]*)\\)\\s*\\)`,
      "gsi",
    ),
  ];

  for (const re of forms) {
    for (const m of searchIn.matchAll(re)) {
      for (const q of (m[1] ?? "").matchAll(/'([^']*)'/g)) results.push(q[1]);
    }
  }

  const unique = [...new Set(results)];
  return unique.length ? unique : null;
}

function expectAllows(
  label: string,
  allowed: string[] | null,
  required: readonly string[],
): void {
  expect(allowed, `${label} must have a CHECK constraint`).not.toBeNull();
  for (const value of required) {
    expect(allowed, `${label} must permit '${value}'`).toContain(value);
  }
}

describe("supabase_setup.sql — the documented provisioning path", () => {
  it("permits every assessment_invites.status value the code writes", () => {
    // The reported defect: without 'completed' here, no submission can succeed.
    expectAllows(
      "assessment_invites.status",
      allowedValues(setupSql, "assessment_invites", "status"),
      [...INVITE_STATUS_WRITTEN, ...INVITE_STATUS_RESERVED],
    );
  });

  it("names the assessment_invites status constraint so it is droppable by name", () => {
    // An inline column CHECK is auto-named `<table>_<column>_check`. Relying on
    // that is exactly what let a stale constraint survive a `DROP CONSTRAINT IF
    // EXISTS` that silently matched nothing.
    expect(setupSql).toContain("CONSTRAINT assessment_invites_status_check");
  });

  it("permits every candidate_status_log.status value the timeline writes", () => {
    // `applicationService.appendStageTimeline` writes the DESTINATION stage on
    // every move; `progressionService.appendTimeline` writes the current stage
    // when parking a passed candidate and the outcome when rejecting.
    const required = [
      ...PIPELINE_STAGES,
      ...STAGE_OUTCOMES,
      ...Object.values(LEGACY_STAGE_ALIASES),
      "Pending",
    ];
    expectAllows(
      "candidate_status_log.status",
      allowedValues(setupSql, "candidate_status_log", "status"),
      required,
    );
  });

  it("permits every hiring_stages.stage_type value progressionService.ensureStageRow writes", () => {
    // Only PIPELINE stages get a `hiring_stages` row — outcomes never do — so
    // `Rejected`/`Hold` are deliberately not required here.
    // `ensureStageRow` is only ever called with a DESTINATION stage, so
    // `Applied` (entry point only) and `Hired` (hard-blocked in
    // `advanceCandidate`) are not currently written — but both are permitted so
    // a future caller cannot hit a 23514.
    expectAllows(
      "hiring_stages.stage_type",
      allowedValues(setupSql, "hiring_stages", "stage_type"),
      [
        ...PIPELINE_STAGES.filter((s) => s !== "Applied"),
        "Applied",
        "Technical Interview",
        "Managerial/HR",
      ],
    );
  });

  it("permits every interviews.status value the live/flow controllers write", () => {
    expectAllows(
      "interviews.status",
      allowedValues(setupSql, "interviews", "status"),
      INTERVIEW_STATUS_WRITTEN,
    );
  });

  it("does not leave an unnamed inline CHECK on candidate_status_log.status", () => {
    // A column carrying BOTH a stale inline check and the correct named one is
    // the worst case: the stale one silently rejects writes and nothing errors.
    const block = tableBlock(setupSql, "candidate_status_log");
    expect(block).not.toBe("");
    expect(
      /status\s+TEXT[^,\n]*CHECK\s*\(/i.test(block),
      "candidate_status_log.status must not keep an inline CHECK alongside the named constraint",
    ).toBe(false);
  });

  it("extracts a distinct value list per table (guards against cross-table matches)", () => {
    // A green test that matches the wrong table's constraint asserts nothing.
    // These four lists must be genuinely different from one another.
    const invites = allowedValues(setupSql, "assessment_invites", "status") ?? [];
    const interviews = allowedValues(setupSql, "interviews", "status") ?? [];
    const stages = allowedValues(setupSql, "hiring_stages", "stage_type") ?? [];
    const timeline = allowedValues(setupSql, "candidate_status_log", "status") ?? [];

    expect(interviews).toContain("joined");
    expect(interviews).not.toContain("revoked");
    expect(invites).toContain("revoked");
    expect(invites).not.toContain("joined");
    expect(stages).toContain("Technical Round");
    expect(stages).not.toContain("revoked");
    expect(timeline).toContain("Final Decision");
    expect(timeline).not.toContain("revoked");
  });
});

describe("migrations — existing databases", () => {
  it("20261001 permits every invite status the code writes", () => {
    expectAllows(
      "20261001 assessment_invites.status",
      allowedValues(migrationSql["20261001_assessments.sql"], "assessment_invites", "status"),
      [...INVITE_STATUS_WRITTEN, ...INVITE_STATUS_RESERVED],
    );
  });

  it("20261009 carries every canonical and legacy stage value", () => {
    const sql = migrationSql["20261009_canonical_stage_vocabulary.sql"];
    expect(sql).toBeDefined();
    for (const value of [...PIPELINE_STAGES, ...Object.values(LEGACY_STAGE_ALIASES)]) {
      expect(sql, `20261009 must permit stage '${value}'`).toContain(`'${value}'`);
    }
  });

  it("20261012 reconciles constraints by COLUMN, not by constraint name", () => {
    const sql = migrationSql["20261012_reconcile_setup_constraints.sql"];
    expect(sql).toBeDefined();
    // The discovery query joins pg_attribute on attname — the only way to catch
    // an auto-named or unnamed constraint.
    expect(sql).toContain("pg_attribute");
    expect(sql).toContain("a.attname = col");
    for (const table of ["assessment_invites", "candidate_status_log", "hiring_stages", "interviews"]) {
      expect(sql, `20261012 must reconcile ${table}`).toContain(table);
    }
  });

  it("20261012 only ever WIDENS a value list, never narrows one", () => {
    // Narrowing would reject rows that are currently valid. Each replacement
    // list must be a superset of the setup file's list for the same column.
    const sql = migrationSql["20261012_reconcile_setup_constraints.sql"];
    // The tuples are long, comma-separated CSV strings, so match the whole
    // three-element tuple rather than trying to stop at a delimiter.
    // NOTE the `/` in the character class: `Managerial/HR` contains one.
    const tupleRe = /\(\s*'([a-z_]+)'\s*,\s*'[a-z_]+'\s*,\s*'([a-zA-Z_|/ ]+)'\s*\)/g;
    const replacementLists = [...sql.matchAll(tupleRe)].map((m) => ({
      table: m[1],
      values: m[2].split("|"),
    }));

    expect(replacementLists.length, "20261012 must reconcile nine columns").toBeGreaterThanOrEqual(9);

    for (const { table, values } of replacementLists) {
      const current = allowedValues(setupSql, table, columnFor(table)) ?? [];
      for (const value of current) {
        expect(values, `20261012 must keep existing ${table} value '${value}'`).toContain(value);
      }
    }
  });

  it("20261012 surfaces failures instead of swallowing them", () => {
    const sql = migrationSql["20261012_reconcile_setup_constraints.sql"];
    expect(sql).toContain("RAISE WARNING");

    // All four phases live in ONE DO block, so a failed ADD CONSTRAINT aborts
    // and rolls back every column already touched. That is stronger than a
    // post-hoc "is MISSING" warning, and it is why the separate verify section
    // was removed. The one exception handler that remains must be confined to
    // the READ-ONLY pre-flight so it can never mask a DDL failure.
    const body = sql.slice(sql.indexOf("DO $$"));
    const handlers = [...body.matchAll(/EXCEPTION\s+WHEN ([A-Za-z_,\s]+?) THEN/g)].map((m) => m[1]);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]).toMatch(/undefined_table|insufficient_privilege/);

    // No handler may cover the DDL phases.
    const installAt = body.indexOf("ADD CONSTRAINT %I CHECK");
    expect(body.lastIndexOf("EXCEPTION")).toBeLessThan(installAt);
  });

  it("20261012 keeps no state between statements", () => {
    const sql = migrationSql["20261012_reconcile_setup_constraints.sql"];
    // Regression: the Supabase SQL editor does not guarantee that consecutive
    // statements share a session, so a TEMP table staged across statements is
    // invisible to the next one ("relation \"_reconcile_targets\" does not
    // exist"). Everything must be self-contained in a single block.
    expect(sql).not.toMatch(/^\s*CREATE\s+TEMP\s+TABLE/im);
    expect(sql).not.toMatch(/^\s*DROP\s+TABLE/m);
    const doBlocks = (sql.match(/^DO \$\$/gm) || []).length;
    expect(doBlocks, "20261012 must be exactly one atomic block").toBe(1);
  });

  it("runs after the migrations it reconciles", () => {
    expect(MIGRATION_FILES.indexOf("20261012_reconcile_setup_constraints.sql")).toBeGreaterThan(
      MIGRATION_FILES.indexOf("20261001_assessments.sql"),
    );
  });
});

function columnFor(table: string): string {
  return table === "hiring_stages" ? "stage_type" : "status";
}

describe("submission path values", () => {
  it("writes 'completed' — the value the drift made impossible", () => {
    expect(INVITE_STATUS_WRITTEN).toContain("completed");
  });

  it("covers exactly the statuses the schema must permit", () => {
    // If a new status is written somewhere, it must be added here so the
    // setup file and 20261012 are forced to permit it.
    expect([...INVITE_STATUS_WRITTEN, ...INVITE_STATUS_RESERVED].sort()).toEqual([
      "completed",
      "expired",
      "opened",
      "revoked",
      "sent",
      "started",
    ]);
  });
});
/**
 * `jobs` ALREADY EXISTS on the live database, created outside this repository,
 * and it already had its OWN `status` column with a legacy value set.
 *
 * That made `20261008_job_lifecycle.sql` fail on first run:
 *
 *   ERROR: 23514: check constraint "jobs_status_check" of relation "jobs"
 *          is violated by some row
 *
 * because `ADD COLUMN IF NOT EXISTS` is a silent no-op against an existing
 * column: the legacy values survive, and the new CHECK rejects them.
 *
 * These assertions pin the self-healing behaviour so the same class of failure
 * cannot silently return.
 */
describe("20261008 survives a pre-existing jobs.status column", () => {
  const sql = migrationSql["20261008_job_lifecycle.sql"];

  it("normalises existing values BEFORE adding the CHECK constraint", () => {
    const normalizeAt = sql.indexOf("SET status = CASE");
    const checkAt = sql.indexOf("ADD CONSTRAINT jobs_status_check");
    expect(normalizeAt).toBeGreaterThan(-1);
    expect(checkAt).toBeGreaterThan(-1);
    // Order matters: normalising afterwards would already be too late.
    expect(normalizeAt).toBeLessThan(checkAt);
  });

  it("archives the original values so the mapping is reversible", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS previous_status TEXT");
    // Archived before the overwrite, and guarded so a re-run cannot clobber it.
    expect(sql).toMatch(/SET previous_status = COALESCE\(status, '\(null\)'\)/)
    expect(sql).toContain("AND previous_status IS NULL");
  });

  it("maps only unambiguously-closed legacy values to 'closed'", () => {
    const block = sql.slice(sql.indexOf("SET status = CASE"), sql.indexOf("SET status = CASE") + 900);
    for (const value of ["closed", "archived", "inactive", "disabled", "filled"]) {
      expect(block, `must map legacy '${value}' to closed`).toContain(`'${value}'`);
    }
    // And everything else falls through to 'open', which preserves the
    // pre-migration behaviour where every job was implicitly open.
    expect(block).toMatch(/ELSE\s+'open'/);
  });

  it("treats NULL and unknown values as 'open', not 'closed'", () => {
    // A legacy NULL means "unknown". Locking a live role by accident is worse
    // than leaving a dead role open, because closing refuses real candidates.
    const guard = sql.slice(sql.indexOf("WHERE status IS NULL"))
    expect(guard).toMatch(/WHERE\s+status IS NULL[\s\S]{0,80}OR\s+status NOT IN/)
  })

  it("enforces NOT NULL only after the NULLs are gone", () => {
    const nullFix = sql.indexOf("SET NOT NULL")
    const normalize = sql.indexOf("SET status = CASE")
    expect(normalize).toBeGreaterThan(-1)
    expect(nullFix).toBeGreaterThan(normalize)
  })

  it("reports the before and after distributions instead of transforming silently", () => {
    expect(sql).toContain("Current distribution");
    expect(sql).toContain("normalised. New distribution");
    expect(sql).toContain("RAISE NOTICE");
  })

  it("documents the manual correction query for a mis-mapped legacy value", () => {
    expect(sql).toContain("SELECT previous_status, COUNT(*) FROM jobs");
  })

  it("is still idempotent — every statement is guarded", () => {
    for (const m of sql.matchAll(/ALTER TABLE public\.jobs\s+ADD COLUMN/g)) {
      expect(sql.slice(m.index, m.index + 80)).toContain("IF NOT EXISTS");
    }
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS jobs_status_check");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_status");
  })
})

describe("20261008 audit trail is complete", () => {
  const sql = migrationSql["20261008_job_lifecycle.sql"];

  it("archives a NULL legacy value distinctly rather than losing the row", () => {
    // `SET previous_status = status` writes NULL for a NULL status, which is
    // indistinguishable from "never archived" — those rows would vanish from
    // the audit trail.
    expect(sql).toContain("COALESCE(status, '(null)')")
  })

  it("fails loudly if the legacy column is not TEXT", () => {
    // The CASE compares against text literals; a non-text column would
    // otherwise blow up later with something cryptic.
    expect(sql).toContain("this migration expects TEXT")
    expect(sql).toContain("v_type <> 'text'")
  })

  it("reports the column type and nullability in the NOTICE", () => {
    expect(sql).toMatch(/jobs\.status already existed \(type=%.*nullable=%\)/)
  })
})

/**
 * No migration may widen a constraint using a NAME-ONLY drop.
 *
 * `DROP CONSTRAINT IF EXISTS <name>` is a silent no-op when the constraint has a
 * different name. An inline column CHECK is auto-named
 * `<table>_<column>_check`, and a table that pre-existed from the RAG pipeline
 * may carry its own naming entirely. When the drop misses, the migration ADDS
 * the widened constraint alongside the stale narrow one, and the narrow one
 * keeps rejecting writes at runtime — with no error at migration time.
 *
 * This is the same class of bug that made 20261008 fail with 23514.
 */
describe("constraint widening never relies on the constraint name alone", () => {
  const sql9 = migrationSql["20261009_canonical_stage_vocabulary.sql"]
  const sql12 = migrationSql["20261012_reconcile_setup_constraints.sql"]

  it("20261009 section 4 discovers CHECKs by COLUMN", () => {
    // The stage-column loop must join pg_attribute on attname, exactly as the
    // stage-column loop in section 1 already does.
    expect(sql9).toContain("a.attname = target.col")
    // Both tables must appear in the VALUES list the loop iterates.
    expect(sql9).toMatch(/\('hiring_stages',\s*'stage_type'/)
    expect(sql9).toMatch(/\('interview_invites',\s*'stage'/)
  })

  it("20261009 section 4 no longer hard-codes constraint names", () => {
    // The named-only version is what left the stale CHECK behind.
    expect(sql9).not.toMatch(/DROP CONSTRAINT IF EXISTS hiring_stages_stage_type_check/)
    expect(sql9).not.toMatch(/DROP CONSTRAINT IF EXISTS interview_invites_stage_check/)
  })

  it("20261012 covers every stage/status column the app writes", () => {
    const targets = [
      "assessment_invites", "candidate_status_log", "hiring_stages", "interviews",
      // The gap this change closed.
      "interview_invites", "assessment_attempts",
      "job_applications", "candidates", "assessment_questions",
    ]
    for (const table of targets) {
      expect(sql12, `20261012 must reconcile ${table}`).toContain(`'${table}'`)
    }
  })

  it("20261012 is order-independent — it canonicalises legacy values first", () => {
    // ADD CONSTRAINT validates existing rows. Without this, a row still holding
    // the legacy lowercase 'applied' would make 20261012 itself fail with the
    // same 23514 it was written to prevent.
    const normaliseAt = sql12.indexOf("rewrote %.%")
    const checkAt = sql12.indexOf("ADD CONSTRAINT %I CHECK")
    expect(normaliseAt).toBeGreaterThan(-1)
    expect(normaliseAt).toBeLessThan(checkAt)
    for (const legacy of ["'applied'", "'screening'", "'technical interview'", "'managerial/hr'", "'offer'"]) {
      expect(sql12, `20261012 must canonicalise legacy ${legacy}`).toContain(legacy)
    }
  })

  it("20261012 uses valid SET syntax (no cast in an assignment target)", () => {
    // `SET col::text = $1` is not valid SQL; the cast belongs in the predicate.
    expect(sql12).not.toContain("SET %I::text")
    expect(sql12).toContain("SET %I = $1 WHERE %I::text = $2")
  })

  it("every replacement list is a superset of what the setup file allowed", () => {
    const tupleRe = /\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*,\s*'([a-zA-Z_|/ ]+)'\s*\)/g
    const lists = [...sql12.matchAll(tupleRe)].map((m) => ({
      table: m[1],
      column: m[2],
      values: m[3].split("|"),
    }))
    expect(lists.length).toBeGreaterThanOrEqual(9)

    for (const { table, column, values } of lists) {
      const existing = allowedValues(setupSql, table, column) ?? []
      for (const value of existing) {
        expect(values, `20261012 must keep existing ${table}.${column} value '${value}'`).toContain(value)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Regression cover for the three bugs found only by running against the real
// database. Each of these produced a live 23514 (or silent corruption) and none
// was reachable by unit-testing, because they are all ORDERING bugs.
// ---------------------------------------------------------------------------
describe("constraint ordering (20261008 / 20261012)", () => {
  const sql8 = migrationSql["20261008_job_lifecycle.sql"];
  const sql12 = migrationSql["20261012_reconcile_setup_constraints.sql"];

  const idx = (hay: string, needle: string) => hay.indexOf(needle);

  it("20261008 drops the pre-existing CHECK before writing any values", () => {
    const dropAll = idx(sql8, "0a. Drop EVERY CHECK constraint on jobs.status");
    const normalise = idx(sql8, "0b. Normalise and archive the legacy values");
    const install = idx(sql8, "ADD CONSTRAINT jobs_status_check");

    expect(dropAll).toBeGreaterThan(-1);
    expect(normalise).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(-1);

    // Normalising while the legacy constraint is still attached makes THAT
    // constraint reject the new values: "new row for relation jobs violates
    // check constraint jobs_status_check".
    expect(dropAll).toBeLessThan(normalise);
    expect(normalise).toBeLessThan(install);
  });

  it("20261008 discovers jobs.status checks by column, not by name", () => {
    const dropAll = sql8.slice(
      idx(sql8, "0a. Drop EVERY CHECK constraint on jobs.status"),
      idx(sql8, "0b. Normalise and archive the legacy values"),
    );
    expect(dropAll).toContain("a.attname = 'status'");
    expect(dropAll).toContain("DROP CONSTRAINT %I");
  });

  it("20261012 drops every CHECK before canonicalising any value", () => {
    const preflight = idx(sql12, "A. Pre-flight");
    const drop = idx(sql12, "B. Drop EVERY CHECK on this column");
    const rewrite = idx(sql12, "C. Canonicalise legacy values");
    const install = idx(sql12, "D. Install the correct CHECK");

    expect(preflight).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(-1);
    expect(rewrite).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(drop);
    expect(drop).toBeLessThan(rewrite);
    expect(rewrite).toBeLessThan(install);
  });

  it("20261012 never rewrites a canonical value back to a legacy one", () => {
    // Regression: plain `Interview` was mapped to `Technical Round`. `Interview`
    // is the canonical HR stage, so every re-run of this safety net would have
    // silently corrupted live rows.
    const maps = [...sql12.matchAll(/\(\s*'([^']*[a-zA-Z/][^']*)'\s*,\s*'([^']*[a-zA-Z][^']*)'\s*\)/g)]
      .map((m) => [m[1], m[2]] as const)
      .filter(([from, to]) => from !== to && !from.includes("|") && !to.includes("|"));

    expect(maps.length).toBeGreaterThan(0);

    // The eight canonical stages, per 20261009. `Offer`/`Offered` are LEGACY
    // and are correctly mapped to `Final Decision`, so they are absent here.
    const canonical = new Set([
      "Applied", "Screening", "Shortlisted", "Assessment", "Technical Round",
      "Interview", "Final Decision", "Hired", "Rejected", "Withdrawn", "Hold",
    ]);
    for (const [from, to] of maps) {
      expect(
        canonical.has(from),
        `20261012 maps the CANONICAL value '${from}' to '${to}'`,
      ).toBe(false);
    }
  });

  it("20261009 RAISE format placeholders match their arguments", () => {
    const sql9 = migrationSql["20261009_canonical_stage_vocabulary.sql"];
    // PostgreSQL rejects a RAISE with more arguments than placeholders.
    const raises = [...sql9.matchAll(/RAISE (?:NOTICE|WARNING|EXCEPTION) '([^']*)'\s*(?:,\s*(.+?))?;/g)];
    expect(raises.length).toBeGreaterThan(0);
    for (const [, fmt, args] of raises) {
      const placeholders = (fmt.match(/%/g) || []).length;
      if (!args) {
        expect(placeholders).toBe(0);
        continue;
      }
      const count = args
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0).length;
      expect(count, `RAISE '${fmt}' has ${placeholders} placeholders but ${count} args`)
        .toBe(placeholders);
    }
  });
});
