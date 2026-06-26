# bump-version.ps1 — PaGamO Service Worker 版本升級腳本
# 執行方式：在 H:\PaGamO 目錄下執行  .\bump-version.ps1
# 功能：版本號自動 +1 → 更新 sw.js / version.json → git commit + push

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ── 計算新版本號（格式：YYYYMMDD-N，同一天自動 +1）──────────────────────────
$versionFile = Join-Path $PSScriptRoot 'public\version.json'
$today = Get-Date -Format 'yyyyMMdd'

$newSeq = 1
if (Test-Path $versionFile) {
  try {
    $cur = (Get-Content $versionFile -Raw | ConvertFrom-Json).version
    if ($cur -match '^(\d{8})-(\d+)$' -and $matches[1] -eq $today) {
      $newSeq = [int]$matches[2] + 1
    }
  } catch {}
}
$newVersion = "$today-$newSeq"
Write-Host "📦 版本升級 → $newVersion"

# ── 更新 version.json ────────────────────────────────────────────────────────
$vJson = "{`"version`":`"$newVersion`"}`n"
[System.IO.File]::WriteAllText($versionFile, $vJson, $utf8NoBom)
Write-Host "✓ version.json 已更新"

# ── 更新 sw.js 的 BUILD_VERSION ──────────────────────────────────────────────
$swFile = Join-Path $PSScriptRoot 'public\sw.js'
$swContent = [System.IO.File]::ReadAllText($swFile)
$swNew = [regex]::Replace(
  $swContent,
  'const BUILD_VERSION = "[^"]*"',
  "const BUILD_VERSION = `"$newVersion`""
)
[System.IO.File]::WriteAllText($swFile, $swNew, $utf8NoBom)
Write-Host "✓ sw.js BUILD_VERSION 已更新"

# ── git commit + push ─────────────────────────────────────────────────────────
git add public/sw.js public/version.json
git commit -m "chore: bump SW version to $newVersion"
git push
Write-Host "✅ 部署完成：$newVersion"
