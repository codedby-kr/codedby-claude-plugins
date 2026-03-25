# clip-files.ps1 — Copy files to Windows clipboard for Ctrl+V paste
# Usage: powershell -File clip-files.ps1 "file1.md" "file2.md"

Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
foreach ($path in $args) {
    $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
    if ($resolved) {
        $files.Add($resolved.Path) | Out-Null
    } else {
        Write-Host "[SKIP] not found: $path"
    }
}
if ($files.Count -gt 0) {
    [System.Windows.Forms.Clipboard]::SetFileDropList($files)
    Write-Host "[OK] $($files.Count) file(s) copied to clipboard"
} else {
    Write-Host "[ERROR] No valid files"
}
