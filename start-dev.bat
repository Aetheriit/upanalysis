@echo off
echo ===================================================
echo     Starting Election Intelligence Platform...
echo ===================================================
echo.

:: Start the backend in a new window
echo [1/2] Starting FastAPI Backend on port 8000...
start "ElectionIntel Backend" cmd /c "run-backend.bat"

:: Start the frontend in a new window
echo [2/2] Starting Next.js Frontend on port 3000...
start "ElectionIntel Frontend" cmd /c "run-frontend.bat"

echo.
echo ===================================================
echo  Servers are starting up in separate windows.
echo  Note: The backend may take a minute to install dependencies 
echo  if this is your first time running it.
echo.
echo  Frontend UI:    http://localhost:3000
echo  Backend API:    http://localhost:8000/docs
echo ===================================================
echo.
echo Opening browser...
start http://localhost:3000
pause
