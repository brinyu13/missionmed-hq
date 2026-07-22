@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_node

node "%SCRIPT_DIR%missionmed-prototype-launcher.mjs" %*
exit /b %errorlevel%

:missing_node
echo.
echo MissionMed Prototype Launcher
echo Could not find an approved Node.js runtime on this PC.
echo Code: MMPL-RUNTIME-001
echo No install or unrelated server change was attempted.
pause
exit /b 69
