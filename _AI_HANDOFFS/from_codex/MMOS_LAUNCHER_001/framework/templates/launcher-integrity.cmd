@echo off
setlocal
set "PACKAGE_DIR=%~dp0"
set "FRAMEWORK_DIR=%PACKAGE_DIR%..\MMOS_LAUNCHER_001\framework"
set "EXPECTED_BOOTSTRAP=4dbf93e5ff220870066bb92470e9e001a930a4836b3d7dcee8f30b04e4d19600"
set "EXPECTED_ENGINE=053744d04cd91dc855d8fa37364e335faa35882eda944cc0aa725fb3ba52a289"
for /f %%H in ('powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath '%FRAMEWORK_DIR%\bootstrap.cmd').Hash.ToLowerInvariant()"') do set "ACTUAL_BOOTSTRAP=%%H"
for /f %%H in ('powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath '%FRAMEWORK_DIR%\missionmed-prototype-launcher.mjs').Hash.ToLowerInvariant()"') do set "ACTUAL_ENGINE=%%H"
if /I not "%ACTUAL_BOOTSTRAP%"=="%EXPECTED_BOOTSTRAP%" goto integrity_error
if /I not "%ACTUAL_ENGINE%"=="%EXPECTED_ENGINE%" goto integrity_error
call "%FRAMEWORK_DIR%\bootstrap.cmd" %*
exit /b %errorlevel%

:integrity_error
echo.
echo MissionMed Prototype Launcher
echo The shared launcher does not match this review package.
echo Code: MMPL-INTEGRITY-001
echo Nothing was installed, started, or stopped.
pause
exit /b 78
