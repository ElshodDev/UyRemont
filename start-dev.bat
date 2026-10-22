@echo off
chcp 65001 > nul
echo =======================================================
echo          🏠 UyRemont Marketplace Ishga Tushmoqda...
echo =======================================================
echo.
echo [1/2] Web Frontend (http://localhost:3000) ochilmoqda...
start "UyRemont Web" cmd /k "cd web && npm run dev"
echo.
echo [2/2] Backend API (http://localhost:5000) tekshirilmoqda...
start "UyRemont Backend" cmd /k "cd backend && npm start"
echo.
echo Tayyor! Brauzeringizda http://localhost:3000 manziliga kiring.
pause
