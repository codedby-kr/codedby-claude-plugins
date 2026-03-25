#!/bin/bash
# clip-files-linux.sh — Copy file URIs to Linux clipboard for Ctrl+V paste
# Usage: bash clip-files-linux.sh "file1.md" "file2.md"
#
# ⚠️ EXPERIMENTAL: File clipboard paste into claude.ai has not been fully tested on Linux.
# Requires: xclip (install via: sudo apt install xclip)
# Uses x-special/gnome-copied-files MIME type for file paste support.
# Note: Works on GNOME-based environments. KDE uses a different MIME type.

if [ $# -eq 0 ]; then
  echo "[ERROR] No files specified"
  exit 1
fi

if ! command -v xclip &> /dev/null; then
  echo "[ERROR] xclip not found. Install with: sudo apt install xclip"
  exit 1
fi

uri_list="copy"
count=0

for filepath in "$@"; do
  resolved=$(realpath "$filepath" 2>/dev/null)
  if [ -f "$resolved" ]; then
    uri_list="${uri_list}\nfile://${resolved}"
    count=$((count + 1))
  else
    echo "[SKIP] not found: $filepath"
  fi
done

if [ $count -eq 0 ]; then
  echo "[ERROR] No valid files"
  exit 1
fi

printf '%b' "$uri_list" | xclip -selection clipboard -t x-special/gnome-copied-files
echo "[OK] ${count} file(s) copied to clipboard"
