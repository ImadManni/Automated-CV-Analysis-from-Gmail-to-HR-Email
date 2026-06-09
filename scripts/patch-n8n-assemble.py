import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
code = (root / "scripts" / "n8n-assemble-llm-payload.js").read_text(encoding="utf-8").replace("\r\n", "\n")
wf = root / "n8n-workflow-imap-openai-in-n8n.json"
data = json.loads(wf.read_text(encoding="utf-8"))
found = False
for node in data["nodes"]:
    if node.get("name") == "9 - Assemble LLM payload":
        node["parameters"]["jsCode"] = code
        found = True
        break
if not found:
    raise SystemExit("node 9 not found")
wf.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("patched", len(code))
