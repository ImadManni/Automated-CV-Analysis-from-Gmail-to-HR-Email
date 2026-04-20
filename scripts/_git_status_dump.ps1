Set-Location "C:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
git status --short | Out-File -Encoding utf8 git-status-out.txt
git diff --stat | Out-File -Encoding utf8 git-diff-stat.txt
