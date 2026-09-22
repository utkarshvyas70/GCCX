require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

require("./db"); // creates + seeds the sqlite file on first boot

const candidatesRouter = require("./routes/candidates");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/candidates", candidatesRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the plain-JS frontend as static files so the whole thing runs
// off a single `npm start` — no separate frontend build step needed.
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`Candidate triage API + UI running on http://localhost:${PORT}`);
});
