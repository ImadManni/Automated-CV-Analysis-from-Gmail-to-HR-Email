const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const p = path.join(
  root,
  "PCA - IMAP → MinIO → OpenAI (n8n) → PCA (8).json"
);
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const n = j.nodes.find((x) => x.name === "12 - Save analysis (PCA API)");
if (!n) {
  console.error("node not found");
  process.exit(1);
}
const b = n.parameters.jsonBody;
const key = "offer_context:";
const i = b.indexOf(key);
if (i < 0) {
  console.error("offer_context key not found");
  process.exit(1);
}
const slice = b.slice(i, i + 12000);
process.stdout.write(slice);
