# clip-files.ps1 — Copy files to Windows clipboard for Ctrl+V paste
# Usage: powershell -File clip-files.ps1 "file1.md" "file2.md"

Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
$ok = @()
$failed = @()
foreach ($path in $args) {
    $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
    if ($resolved) {
        $files.Add($resolved.Path) | Out-Null
        $ok += $path
    } else {
        $failed += $path
    }
}
if ($files.Count -gt 0) {
    [System.Windows.Forms.Clipboard]::SetFileDropList($files)
    Write-Host "[OK] $($files.Count) file(s) copied to clipboard: $($ok -join ', ')"
    if ($failed.Count -gt 0) {
        Write-Host "[FAILED] $($failed.Count) file(s) not found: $($failed -join ', ')"
        Write-Host "Fix the failed path and re-run with ALL files (clipboard is replaced entirely)."
    }
} else {
    Write-Host "[ERROR] No valid files. All failed: $($failed -join ', ')"
}
