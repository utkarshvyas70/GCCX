const express = require("express");
const db = require("../db");
const { generateFitSummary } = require("../services/llm");

const router = express.Router();

function rowToCandidate(row) {
  const tags = db
    .prepare("SELECT tag FROM tags WHERE candidate_id = ? ORDER BY tag")
    .all(row.id)
    .map((t) => t.tag);

  return {
    id: row.id,
    name: row.name,
    target_role: row.target_role,
    years_experience: row.years_experience,
    source: row.source,
    skills: JSON.parse(row.skills),
    notes: row.notes,
    applied_date: row.applied_date,
    ai_summary: row.ai_summary,
    tags,
  };
}

// GET /api/candidates?q=&role=&source=&minExperience=&tag=
// Filters are all optional and combine with AND. `q` does a substring
// match on name + notes — the dataset is <50 rows so a LIKE scan is plenty
// fast; FTS5 would be premature here (see README for the write-up).
router.get("/", (req, res) => {
  const { q, role, source, minExperience, tag } = req.query;

  let sql = "SELECT DISTINCT c.* FROM candidates c";
  const params = [];
  const where = [];

  if (tag) {
    sql += " JOIN tags t ON t.candidate_id = c.id";
    where.push("t.tag = ?");
    params.push(tag);
  }

  if (q) {
    where.push("(c.name LIKE ? OR c.notes LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (role) {
    where.push("c.target_role = ?");
    params.push(role);
  }
  if (source) {
    where.push("c.source = ?");
    params.push(source);
  }
  if (minExperience) {
    where.push("c.years_experience >= ?");
    params.push(Number(minExperience));
  }

  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }
  sql += " ORDER BY c.applied_date DESC";

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(rowToCandidate));
});

// GET /api/candidates/meta — distinct roles/sources for building filter dropdowns
router.get("/meta", (req, res) => {
  const roles = db.prepare("SELECT DISTINCT target_role FROM candidates ORDER BY target_role").all().map((r) => r.target_role);
  const sources = db.prepare("SELECT DISTINCT source FROM candidates ORDER BY source").all().map((r) => r.source);
  res.json({ roles, sources });
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Candidate not found" });
  res.json(rowToCandidate(row));
});

// POST /api/candidates/:id/tags  { tag: "shortlist" }
router.post("/:id/tags", (req, res) => {
  const { tag } = req.body;
  if (!tag || typeof tag !== "string" || !tag.trim()) {
    return res.status(400).json({ error: "tag is required" });
  }
  const candidate = db.prepare("SELECT id FROM candidates WHERE id = ?").get(req.params.id);
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });

  db.prepare("INSERT OR IGNORE INTO tags (candidate_id, tag) VALUES (?, ?)").run(req.params.id, tag.trim().toLowerCase());

  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id);
  res.status(201).json(rowToCandidate(row));
});

// DELETE /api/candidates/:id/tags/:tag
router.delete("/:id/tags/:tag", (req, res) => {
  db.prepare("DELETE FROM tags WHERE candidate_id = ? AND tag = ?").run(req.params.id, req.params.tag.toLowerCase());
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Candidate not found" });
  res.json(rowToCandidate(row));
});

// POST /api/candidates/:id/fit-summary — generates (or regenerates) the
// LLM one-liner and caches it on the row so we don't pay for it twice.
router.post("/:id/fit-summary", async (req, res) => {
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Candidate not found" });

  const force = req.query.force === "true";
  if (row.ai_summary && !force) {
    return res.json({ id: row.id, ai_summary: row.ai_summary, cached: true });
  }

  try {
    const candidate = rowToCandidate(row);
    const summary = await generateFitSummary(candidate);
    db.prepare(
      "UPDATE candidates SET ai_summary = ?, ai_summary_generated_at = datetime('now') WHERE id = ?"
    ).run(summary, row.id);
    res.json({ id: row.id, ai_summary: summary, cached: false });
  } catch (err) {
    if (err.code === "NO_API_KEY") {
      return res.status(503).json({
        error: "ANTHROPIC_API_KEY is not configured on the server. See backend/.env.example.",
      });
    }
    console.error("fit-summary generation failed:", err);
    res.status(502).json({ error: "LLM request failed. Try again in a moment." });
  }
});

module.exports = router;
