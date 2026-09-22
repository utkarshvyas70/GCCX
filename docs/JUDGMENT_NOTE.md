# Judgment Note

**Context:** The recruiter likes v1. Leadership wants it live for a client
sending 3,000 candidates per week, with one additional engineer and two weeks.

## What I'd build first

1. **Bulk ingest:** CSV/ATS upload, deduplication using an external ID or
   name-plus-email, and upserts instead of the current JSON seed script.
2. **Pagination and server-side sorting:** the current `SELECT *` is fine for
   48 rows but will become slow and unwieldy as candidates accumulate.
3. **Authentication and client isolation:** every candidate and request must
   belong to a client before this can safely serve multiple customers.
4. **A background LLM queue:** generate summaries on ingest with rate limits,
   retries, and a visible pending state instead of one request per button click.

## What I'd refuse to build yet

I would defer semantic search and custom per-client ML ranking. Both add
embedding or training pipelines before the basics are reliable. I would also
defer a detailed recruiter/manager/admin permissions model until usage shows
which roles are actually needed.

## The risk I'd flag

The fit summary is generated from recruiter-written notes, which may contain
unconscious bias. Showing an AI summary without clearly framing it as a
suggestion could make biased human judgment look objective and influence
shortlisting. Before client rollout, I would label it as decision support,
keep the source notes visible, add auditability, and raise the fairness and
compliance question with the manager and legal team.
