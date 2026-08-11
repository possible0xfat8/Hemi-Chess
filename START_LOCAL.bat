@echo off
echo ========================================
echo   HemiChess Local Development
echo ========================================
echo.
echo Starting both Backend and Frontend...
echo.
echo Backend will run on: http://localhost:3000
echo Frontend will run on: http://localhost:5173
echo.
echo Press Ctrl+C to stop all servers
echo ========================================
echo.

cd backend
start "HemiChess Backend" cmd /k "node server.js"
cd ..
timeout /t 3 /nobreak >nul
start "HemiChess Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Both servers are starting...
echo Check the new windows for logs
echo ========================================
pause
