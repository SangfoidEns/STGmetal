@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Потрібен Node.js 18+. https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Встановлення Electron…
  call npm install
  if errorlevel 1 (
    echo npm install failed
    pause
    exit /b 1
  )
)

if not defined PORT set PORT=8787
if not defined HOST set HOST=127.0.0.1

echo.
echo  STGmetal — Windows server
echo  Порт: %PORT%  Bind: %HOST%
echo.
npm start
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Exit code %ERR%
  pause
)
exit /b %ERR%
