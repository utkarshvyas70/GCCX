/**
 * Task 2a — Rank candidates by skill-overlap match, efficient at 100k+ candidates.
 *
 * Approach: build an inverted index once (skill -> list of candidate indexes),
 * then for a given query only touch candidates that actually share at least
 * one required skill, tally overlap counts in a Map, and pull the top K with
 * a min-heap instead of sorting everyone.
 *
 * Complexity:
 *   Let N = number of candidates, S = avg skills per candidate, R = required
 *   skills in the query, K = how many results the recruiter wants back.
 *
 *   Building the index:      O(N * S) time, O(N * S) space — done once,
 *                             reused across every search a recruiter runs.
 *   Per query:
 *     - Candidates touched = only those in the postings lists for the R
 *       required skills, call that M (M <= N, and in practice M << N once
 *       skills are reasonably specific).
 *     - Tally overlap:        O(M) using a Map, since each touched
 *                              candidate is visited once per matching skill.
 *     - Top-K selection:      O(M log K) via a fixed-size min-heap, instead
 *                              of O(M log M) for a full sort.
 *   Total per query: O(M log K) time, O(M) extra space for the tally map.
 *
 * Why not the simplest thing (loop every candidate, filter its skills array,
 * sort everyone by score)? That's O(N * R) per query just for the overlap
 * check (array .includes() is O(R) per skill, times S skills, times N
 * candidates) plus O(N log N) for a full sort. At N = 100,000 with a
 * recruiter running searches interactively, that full sort is the part that
 * actually hurts — we only ever need the top 20-50 candidates, not a total
 * order over all 100,000. The inverted index also means candidates with zero
 * overlap are never even visited, which is the common case once a search has
 * 3-4 required skills.
 *
 * Trade-off: the index needs rebuilding (or incremental updates) whenever
 * candidates are added/edited. For a recruiting tool where new candidates
 * trickle in rather than arriving as a 100k bulk write every request, that's
 * a fine trade — I'd rebuild the index on ingest, not on every search.
 */

const { MinHeap } = require("./minHeap");

function buildSkillIndex(candidates) {
  const index = new Map(); // skill -> array of candidate indexes
  candidates.forEach((candidate, i) => {
    for (const skill of candidate.skills) {
      if (!index.has(skill)) index.set(skill, []);
      index.get(skill).push(i);
    }
  });
  return index;
}

/**
 * @param {Array<{id: string, skills: string[]}>} candidates
 * @param {string[]} requiredSkills
 * @param {number} topK
 * @param {Map} [prebuiltIndex] pass in a cached index to skip rebuilding it
 * @returns {Array<{id: string, score: number}>} best matches first
 */
function rankBySkillOverlap(candidates, requiredSkills, topK = 20, prebuiltIndex = null) {
  if (requiredSkills.length === 0) return [];

  const index = prebuiltIndex || buildSkillIndex(candidates);
  const scores = new Map(); // candidate index -> overlap count

  for (const skill of requiredSkills) {
    const postings = index.get(skill);
    if (!postings) continue;
    for (const candidateIdx of postings) {
      scores.set(candidateIdx, (scores.get(candidateIdx) || 0) + 1);
    }
  }

  // Fixed-size min-heap of the current top K, so a query never holds more
  // than K+1 scored candidates in memory or pays for sorting all of M.
  const heap = new MinHeap();
  for (const [candidateIdx, score] of scores) {
    const entry = { id: candidates[candidateIdx].id, score };
    if (heap.size < topK) {
      heap.push(entry);
    } else if (entry.score > heap.peek().score) {
      heap.pop();
      heap.push(entry);
    }
  }

  const results = [];
  while (heap.size > 0) results.push(heap.pop());
  return results.reverse(); // heap.pop() drains lowest-first
}

module.exports = { buildSkillIndex, rankBySkillOverlap };
