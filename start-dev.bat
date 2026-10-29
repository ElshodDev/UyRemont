@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo =======================================================
echo          🏠 UyRemont Marketplace Ishga Tushmoqda...
echo =======================================================
echo.
if not exist "backend\node_modules" goto setup
if not exist "web\node_modules" goto setup
if not exist "backend\.env" goto setup
goto run

:setup
echo Birinchi ishga tushirish: loyiha sozlanmoqda...
call npm run setup
if errorlevel 1 goto failed

:run
echo Brauzerda http://localhost:3000 manzilini oching. To'xtatish: Ctrl + C
call npm run dev
goto :eof

:failed
echo.
echo Sozlashda xatolik yuz berdi. Yuqoridagi xabarni o'qing.
pause
