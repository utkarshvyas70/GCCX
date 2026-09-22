const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

// Node 22+ ships a built-in sqlite module, so we skip better-sqlite3 (native
// bindings) entirely — one less thing to compile on whatever machine runs
// this, and this project doesn't need anything the built-in module lacks.
const DB_PATH = path.join(__dirname, "triage.db");
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_role TEXT NOT NULL,
    years_experience INTEGER NOT NULL,
    source TEXT NOT NULL,
    skills TEXT NOT NULL,        -- JSON array, stored as text
    notes TEXT NOT NULL,
    applied_date TEXT NOT NULL,
    ai_summary TEXT,             -- cached LLM output, NULL until generated
    ai_summary_generated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_candidates_target_role ON candidates (target_role);
  CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates (source);
  CREATE INDEX IF NOT EXISTS idx_candidates_years_experience ON candidates (years_experience);

  CREATE TABLE IF NOT EXISTS tags (
    candidate_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (candidate_id, tag),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (tag);
`);

// Seed once from the mock dataset if the table is empty. Re-running the
// server never duplicates rows or clobbers tags a recruiter already added.
const rowCount = db.prepare("SELECT COUNT(*) AS n FROM candidates").get().n;
if (rowCount === 0) {
  const raw = fs.readFileSync(path.join(__dirname, "data", "candidates.json"), "utf-8");
  const candidates = JSON.parse(raw);

  const insert = db.prepare(`
    INSERT INTO candidates (id, name, target_role, years_experience, source, skills, notes, applied_date)
    VALUES ($id, $name, $target_role, $years_experience, $source, $skills, $notes, $applied_date)
  `);

  db.exec("BEGIN");
  try {
    for (const c of candidates) {
      insert.run({
        $id: c.id,
        $name: c.name,
        $target_role: c.target_role,
        $years_experience: c.years_experience,
        $source: c.source,
        $skills: JSON.stringify(c.skills),
        $notes: c.notes,
        $applied_date: c.applied_date,
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log(`Seeded ${candidates.length} candidates into ${DB_PATH}`);
}

module.exports = db;
