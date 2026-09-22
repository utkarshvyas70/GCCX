# AI Collaboration Log

## Tools used

- **Claude Code** (CLI) — did most of the heavy lifting: scaffolding the
  Express + SQLite backend, the vanilla JS frontend, the ranking function in
  Task 2a, and drafting this doc set. I drove it interactively rather than
  giving it one giant prompt — smaller asks, review the diff, adjust.

## Real prompts I used

> "Build the SQLite schema for a candidate triage tool — candidates table
> from the JSON dataset, plus a way to tag/shortlist candidates that isn't
> just a status enum, since a recruiter might want multiple tags on one
> person. Index whatever we'll actually filter on."

> "Write the ranking function for Task 2a — skill overlap, has to work at
> 100k candidates, so no full sort. Explain the complexity trade-off vs the
> naive loop-and-sort version in comments, not just in the writeup."

> "This candidate list is 48 people — do I actually need FTS5 for the notes
> search or am I over-building this? Give me the honest answer, not the
> impressive-sounding one."

## Where I overrode it

Two separate moments, both caught by actually running things instead of
trusting the diff:

1. **Wrong dependency choice, caught immediately by `npm install` failing.**
   First pass at the DB layer used `better-sqlite3`. It needs native
   compilation (`node-gyp` + Visual Studio build tools), and `npm install`
   failed on this machine with a "could not find Visual Studio" error —
   which means it would fail on a reviewer's machine too unless they happen
   to have build tools installed, which isn't a safe assumption for a
   take-home. Rather than debug a Windows build toolchain, I had it swap to
   Node's built-in `node:sqlite` module (stable since Node 22) — zero native
   deps, same synchronous API shape, one less thing that can break on
   `git clone && npm install`. This is the kind of thing you only catch by
   actually running `npm install` on the target machine, not by reading the
   code.

2. **A heap that didn't match its own complexity claim.** The first pass at
   Task 2a's top-K selection used `array.push()` + `array.sort()` +
   `array.shift()` inside the loop, with a comment admitting it wasn't a
   real heap ("fine for v1"). That directly contradicted the `O(M log K)`
   claim in the docstring above it — a sort-per-insert is `O(M log M)` in
   the worst case, not `O(log K)`. Had it implement an actual binary
   min-heap (`task2/minHeap.js`) instead of shipping a comment that lied
   about the Big-O it sat next to.

## Where it made me faster — and how I checked

The inverted-index approach for skill-overlap ranking (Task 2a) is something
I'd have reached for eventually, but Claude got a working version down in one
pass, which saved the 20 minutes of writing-then-debugging boilerplate. I
didn't trust it on the ranking order, though — that's the part that actually
matters for a recruiter — so I wrote `task2/ranking.test.js` with a small,
hand-checked fixture (4 candidates, known overlap counts) and ran it
(`node task2/ranking.test.js`) before accepting the function. It failed on
the first run: two of my fixture candidates tied in overlap score and I'd
hard-coded an expected order that assumed no ties. That was my test being
wrong, not the ranking code — I adjusted the fixture to remove the tie and
it passed. Small example, but it's the whole point of writing the test
instead of just reading the function and nodding.

## Where I couldn't fully verify

The LLM fit-summary feature (`backend/services/llm.js`) calls the real
Anthropic Messages API — it's not mocked, and the code path (auth header,
request/response shape, error handling for a missing key) is correct against
the current API docs. I did not have a live `ANTHROPIC_API_KEY` in this
environment to run an end-to-end call, so I'm flagging that honestly rather
than claiming I watched real output come back: whoever runs this next should
drop a key into `backend/.env` and hit the "Generate fit summary" button once
before treating that feature as verified, not just "should work."
