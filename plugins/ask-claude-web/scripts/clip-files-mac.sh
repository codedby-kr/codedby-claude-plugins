#!/bin/bash
# clip-files-mac.sh — Copy files to macOS clipboard for Cmd+V paste
# Usage: bash clip-files-mac.sh "file1.md" "file2.md"
#
# ⚠️ EXPERIMENTAL: File clipboard paste into claude.ai has not been fully tested on macOS.
# Uses Finder alias list to set file references on the clipboard.
# Browser paste behavior may vary.

if [ $# -eq 0 ]; then
  echo "[ERROR] No files specified"
  exit 1
fi

file_list=""
count=0

for filepath in "$@"; do
  resolved=$(realpath "$filepath" 2>/dev/null)
  if [ -f "$resolved" ]; then
    # Convert POSIX path to Finder alias format
    file_list="${file_list}(POSIX file \"${resolved}\") as alias, "
    count=$((count + 1))
  else
    echo "[SKIP] not found: $filepath"
  fi
done

if [ $count -eq 0 ]; then
  echo "[ERROR] No valid files"
  exit 1
fi

# Remove trailing ", "
file_list="${file_list%, }"

osascript -e "tell application \"Finder\" to set the clipboard to {${file_list}}"
echo "[OK] ${count} file(s) copied to clipboard"
