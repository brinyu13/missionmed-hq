@echo off
setlocal
set "PACKAGE_DIR=%~dp0"
call "%PACKAGE_DIR%launcher-integrity.cmd" launch --config "%PACKAGE_DIR%prototype.launch.json" --browser default --pause-on-error
exit /b %errorlevel%
