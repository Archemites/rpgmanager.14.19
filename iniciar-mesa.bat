@echo off
setlocal
REM ============================================================
REM  Abre a mesa no Chrome com a deteccao de oclusao DESLIGADA.
REM
REM  Sem estas flags, o Chromium marca uma janela totalmente
REM  coberta como "hidden" e para de pintar frames - o estado da
REM  tela do jogador continua correto, mas a captura do Discord
REM  ou do OBS congela ate a janela reaparecer.
REM ============================================================

REM  Abre tambem em modo --app (janela sem barra de navegacao/abas).
REM  Bonus: a janela do jogador aberta por window.open a partir de uma
REM  janela --app tambem nasce sem barra de endereco.

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set "DIR=%~dp0"
set "DIR=%DIR:\=/%"
set APP=--app="file:///%DIR%index.html"

if not exist %CHROME% (
  echo.
  echo  [X] Chrome nao encontrado em:
  echo      %CHROME%
  echo.
  pause
  exit /b 1
)

REM As flags so valem para uma instancia NOVA. Se ja existe um
REM Chrome rodando, ele apenas abre mais uma aba no processo
REM antigo e as flags sao silenciosamente ignoradas.
tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | find /I "chrome.exe" >nul
if not errorlevel 1 (
  echo.
  echo  [!] O Chrome ja esta aberto.
  echo.
  echo      Feche TODAS as janelas do Chrome e rode este arquivo
  echo      de novo, senao as flags nao sao aplicadas.
  echo.
  pause
  exit /b 1
)

start "" %CHROME% --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows %APP%
