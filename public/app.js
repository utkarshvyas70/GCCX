const API_BASE = "/api/candidates";

const state = {
  q: "",
  role: "",
  source: "",
  minExperience: "",
  tag: "",
};

const els = {
  list: document.getElementById("list"),
  resultCount: document.getElementById("resultCount"),
  search: document.getElementById("searchBox"),
  role: document.getElementById("roleFilter"),
  source: document.getElementById("sourceFilter"),
  minExp: document.getElementById("minExpFilter"),
  tag: document.getElementById("tagFilter"),
  clear: document.getElementById("clearFilters"),
  template: document.getElementById("cardTemplate"),
};

let searchDebounce = null;

async function loadMeta() {
  const res = await fetch(`${API_BASE}/meta`);
  const { roles, sources } = await res.json();
  for (const role of roles) {
    const opt = document.createElement("option");
    opt.value = role;
    opt.textContent = role;
    els.role.appendChild(opt);
  }
  for (const source of sources) {
    const opt = document.createElement("option");
    opt.value = source;
    opt.textContent = source;
    els.source.appendChild(opt);
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.role) params.set("role", state.role);
  if (state.source) params.set("source", state.source);
  if (state.minExperience) params.set("minExperience", state.minExperience);
  if (state.tag) params.set("tag", state.tag);
  return params.toString();
}

async function loadCandidates() {
  const res = await fetch(`${API_BASE}?${buildQuery()}`);
  const candidates = await res.json();
  renderList(candidates);
}

function renderList(candidates) {
  els.list.innerHTML = "";
  els.resultCount.textContent = `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`;

  if (candidates.length === 0) {
    els.list.innerHTML = `<div class="empty-state">No candidates match these filters.</div>`;
    return;
  }

  for (const c of candidates) {
    els.list.appendChild(renderCard(c));
  }
}

function renderCard(candidate) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.id = candidate.id;

  node.querySelector(".card-name").textContent = candidate.name;
  node.querySelector(".card-meta").textContent =
    `${candidate.target_role} · ${candidate.years_experience} yrs · ${candidate.source} · applied ${candidate.applied_date}`;
  node.querySelector(".card-skills").textContent = candidate.skills.join(" · ");
  node.querySelector(".card-notes").textContent = candidate.notes;

  const tagsEl = node.querySelector(".card-tags");
  for (const tag of candidate.tags) {
    const pill = document.createElement("span");
    pill.className = `pill ${tag}`;
    pill.textContent = tag;
    tagsEl.appendChild(pill);
  }

  const aiSummaryEl = node.querySelector(".ai-summary");
  const aiBtn = node.querySelector(".ai-btn");
  if (candidate.ai_summary) {
    aiSummaryEl.textContent = candidate.ai_summary;
    aiBtn.textContent = "↻ Regenerate";
  }
  aiBtn.addEventListener("click", () => generateSummary(candidate.id, aiBtn, aiSummaryEl));

  for (const btn of node.querySelectorAll(".tag-btn")) {
    const tag = btn.dataset.tag;
    if (candidate.tags.includes(tag)) btn.classList.add("active");
    btn.addEventListener("click", () => toggleTag(candidate.id, tag, btn));
  }

  return node;
}

async function generateSummary(id, btn, summaryEl) {
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Generating…";
  try {
    const res = await fetch(`${API_BASE}/${id}/fit-summary`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      summaryEl.textContent = data.error || "Could not generate a summary.";
      return;
    }
    summaryEl.textContent = data.ai_summary;
    btn.textContent = "↻ Regenerate";
  } catch (err) {
    summaryEl.textContent = "Network error while calling the AI feature.";
  } finally {
    btn.disabled = false;
    if (btn.textContent === "Generating…") btn.textContent = originalLabel;
  }
}

async function toggleTag(id, tag, btn) {
  const isActive = btn.classList.contains("active");
  btn.disabled = true;
  try {
    if (isActive) {
      await fetch(`${API_BASE}/${id}/tags/${tag}`, { method: "DELETE" });
      btn.classList.remove("active");
    } else {
      await fetch(`${API_BASE}/${id}/tags`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      btn.classList.add("active");
    }
    // If the current view is filtered by tag, the card may need to disappear.
    if (state.tag) loadCandidates();
  } finally {
    btn.disabled = false;
  }
}

els.search.addEventListener("input", (e) => {
  state.q = e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadCandidates, 250);
});
els.role.addEventListener("change", (e) => { state.role = e.target.value; loadCandidates(); });
els.source.addEventListener("change", (e) => { state.source = e.target.value; loadCandidates(); });
els.minExp.addEventListener("change", (e) => { state.minExperience = e.target.value; loadCandidates(); });
els.tag.addEventListener("change", (e) => { state.tag = e.target.value; loadCandidates(); });
els.clear.addEventListener("click", () => {
  state.q = state.role = state.source = state.minExperience = state.tag = "";
  els.search.value = "";
  els.role.value = "";
  els.source.value = "";
  els.minExp.value = "";
  els.tag.value = "";
  loadCandidates();
});

loadMeta().then(loadCandidates);
