@echo off
setlocal
set "PACKAGE_DIR=%~dp0"
call "%PACKAGE_DIR%launcher-integrity.cmd" stop --config "%PACKAGE_DIR%prototype.launch.json" --pause-on-error
exit /b %errorlevel%
