// Calls Anthropic's Messages API to generate a one-line "why this candidate
// might fit" summary from the free-text notes field. Real network call —
// nothing here is mocked. Requires ANTHROPIC_API_KEY in the environment.

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

async function generateFitSummary(candidate) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set");
    err.code = "NO_API_KEY";
    throw err;
  }

  const prompt = `You are helping a recruiter triage candidates quickly.
Given the structured fields and free-text notes below, write ONE line (max 25 words)
on why this candidate might fit their target role. Be specific and grounded only in
the given info — do not invent facts. If the notes raise a concern, it's fine to
mention it briefly instead of pure praise.

Target role: ${candidate.target_role}
Years of experience: ${candidate.years_experience}
Skills: ${candidate.skills.join(", ")}
Source: ${candidate.source}
Notes: ${candidate.notes}

Respond with only the one-line summary, no preamble, no quotes.`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Anthropic API error ${res.status}: ${body}`);
    err.code = "LLM_REQUEST_FAILED";
    throw err;
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Anthropic API returned no text content");
  }
  return text;
}

module.exports = { generateFitSummary };
