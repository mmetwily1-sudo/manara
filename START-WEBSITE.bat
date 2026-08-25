@echo off
chcp 65001 >nul
title منارة — الموقع
cd /d "%~dp0"

echo.
echo   ============================================
echo      منارة — جاري تشغيل الموقع...
echo      افتح المتصفح على:  http://localhost:3000
echo      للإغلاق: اضغط Ctrl+C في النافذة دي
echo   ============================================
echo.

start "" http://localhost:3000
node node_modules\next\dist\bin\next start -p 3000

pause
