@echo off
setlocal
REM ============================================================
REM  Sobe a mesa em http://localhost:5500 (via "npx serve") e abre
REM  no navegador padrao do sistema.
REM ============================================================

set "DIR=%~dp0"
set PORT=8080

where npx >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js/npx nao encontrado no PATH.
  echo      Instale o Node.js: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

start "mesa-server" cmd /c "cd /d "%DIR%" && npx serve -l %PORT%"

REM  Da um tempo para o servidor subir antes de abrir o navegador.
timeout /t 2 /nobreak >nul

start "" "http://localhost:%PORT%/login.html"
