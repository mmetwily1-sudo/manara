# ============================================================
# منارة — سكربت الرفع الذاتي لـGitHub
# شغّله مرة واحدة: زرار يمين → Run with PowerShell
# هيعمل: تسجيل دخول GitHub (نافذة المتصفح) → إنشاء الريبو → رفع الكود
# ============================================================

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== منارة — النشر على GitHub ===" -ForegroundColor Cyan
Write-Host ""

# 1) التأكد من gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "خطأ: gh CLI مش متسطب — نزّله من https://cli.github.com" -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"; exit 1
}

# 2) تسجيل الدخول (لو مش مسجل)
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "هفتحلك المتصفح لتسجيل دخول جيت هب..." -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
}

# 3) إنشاء الريبو الخاص + رفع الكود
$user = (gh api user | ConvertFrom-Json).login
Write-Host "مسجل دخول باسم: $user" -ForegroundColor Green

$repoExists = gh repo view manara 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "جاري إنشاء الريبو الخاص manara..." -ForegroundColor Yellow
    gh repo create manara --private --description "منارة — نظام تشغيل المعلم والسنتر: منصة تعليمية White-label للمعلمين في مصر" --source . --remote origin
} else {
    Write-Host "الريبو موجود بالفعل" -ForegroundColor DarkGray
}

# 4) الرفع
git add -A
$hasChanges = git diff --cached --quiet; if (-not $?) { git commit -m "update: sync from local build" }
git push -u origin main

Write-Host ""
Write-Host "تم! الريبو: https://github.com/$user/manara" -ForegroundColor Green
Write-Host "CI هيشتغل تلقائياً على أول push" -ForegroundColor DarkGray
Read-Host "اضغط Enter للإغلاق"
