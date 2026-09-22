const assert = require("node:assert");
const { rankBySkillOverlap } = require("./ranking");

function run() {
  const candidates = [
    { id: "a", skills: ["React", "Node.js"] },
    { id: "b", skills: ["React", "TypeScript"] },
    { id: "c", skills: ["React", "Node.js", "TypeScript", "AWS"] },
    { id: "d", skills: ["Python"] },
  ];

  const results = rankBySkillOverlap(candidates, ["React", "Node.js", "AWS"], 3);

  assert.deepStrictEqual(
    results.map((r) => r.id),
    ["c", "a", "b"],
    "expected c > a > b by overlap count, d excluded (zero overlap)"
  );
  assert.strictEqual(results[0].score, 3);
  assert.strictEqual(results[1].score, 2);
  assert.strictEqual(results.length, 3);

  const empty = rankBySkillOverlap(candidates, [], 3);
  assert.deepStrictEqual(empty, [], "no required skills should return no matches");

  const noMatch = rankBySkillOverlap(candidates, ["Rust"], 3);
  assert.deepStrictEqual(noMatch, [], "unknown skill should return no matches");

  console.log("ranking.test.js: all assertions passed");
}

run();
