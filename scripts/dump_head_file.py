import subprocess
from pathlib import Path

repo = Path(__file__).resolve().parent.parent
path_in_repo = "src/pages/InterviewsPage.tsx"
r = subprocess.run(
    ["git", "-C", str(repo), "show", f"HEAD:{path_in_repo}"],
    capture_output=True,
    text=True,
)
out = repo / "_head_InterviewsPage.tsx"
out.write_text(r.stdout if r.returncode == 0 else r.stderr, encoding="utf-8")
print("exit", r.returncode, "bytes", len(r.stdout))
