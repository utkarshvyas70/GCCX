# Task 2b — Reviewing the AI's function

## Original

```js
function matchCandidates(candidates, requiredSkills) {
  let matches = [];
  for (i = 0; i <= candidates.length; i++) {
    const c = candidates[i];
    const score = c.skills.filter(s => requiredSkills.includes(s));
    if (score.length > 0) {
      matches.push({ name: c.name, score: score });
    }
  }
  return matches.sort((a, b) => a.score - b.score);
}
```

## Bugs

1. **Off-by-one + implicit global.** `i <= candidates.length` reads one index past
   the end of the array. `candidates[candidates.length]` is `undefined`, so
   `c.skills` throws `TypeError: Cannot read properties of undefined`. Also `i`
   is never declared (`let`/`const`), so in non-strict mode it silently leaks
   onto the global object — a classic bug that only shows up as weird
   cross-call state once this function is called more than once in the same
   process.

2. **Sorting arrays, not numbers.** `score` is the *array* returned by
   `.filter(...)`, not a count. `a.score - b.score` is `[...] - [...]`, which
   JS coerces to `NaN` for anything but single-element arrays, so `.sort()`
   does effectively nothing — the "ranking" is arbitrary. Even fixed, this
   sorts ascending, which is backwards for "best match first."

## Design smell

`requiredSkills.includes(s)` inside `.filter()` is an `O(R)` linear scan
against `requiredSkills` for every skill of every candidate — `O(N * S * R)`
overall. At the 100k-candidate scale from Task 2a, this stops being fine.
Converting `requiredSkills` to a `Set` once and calling `.has()` drops that to
`O(N * S)`, and reusing the inverted-index approach from `ranking.js` is the
real fix if this needs to run interactively.

## Fixed version

```js
function matchCandidates(candidates, requiredSkills) {
  const required = new Set(requiredSkills);
  const matches = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const overlap = c.skills.filter((s) => required.has(s));
    if (overlap.length > 0) {
      matches.push({ name: c.name, score: overlap.length });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
```

## What a dev who didn't actually read the AI's output would have missed

The function *looks* plausible, but the out-of-bounds access always produces
`undefined` for the final loop iteration and throws before a complete result
is returned. The sort bug
is the sneaky one: `matches.sort(...)` returns an array either way, so nothing
crashes, and a spot-check of "did I get an array of matches back? yes, ship
it" would pass code review while the actual ranking is silently wrong. Both
bugs are the kind that only surface with a real dataset and a human looking
at whether the *order* and *count* of results make sense — which is exactly
the verification step it's easy to skip when the code came from an AI and
"looks reasonable."
