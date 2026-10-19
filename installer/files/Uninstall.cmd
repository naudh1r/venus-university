@echo off
setlocal
title {{NAME}} - Uninstall
rem Runs the patch on the game's own exe: with ELECTRON_RUN_AS_NODE=1 it is a plain Node.js,
rem so nothing else needs installing. Everything this does is in patch.mjs, beside this file.
set "HERE=%~dp0"
set "GAME=%~1"
if defined GAME goto have
if exist "%HERE%..\Venus University.exe" for %%I in ("%HERE%..") do set "GAME=%%~fI"
if defined GAME goto have
echo.
echo   Type or paste the path of your Venus University folder
echo   (the one with "Venus University.exe" in it), then press Enter.
echo.
set /p "GAME=  Game folder: "
if not defined GAME goto missing
:have
set "GAME=%GAME:"=%"
if "%GAME:~-1%"=="\" set "GAME=%GAME:~0,-1%"
if not exist "%GAME%\Venus University.exe" goto missing
if not exist "%HERE%patch.mjs" goto unpacked
set "LOG=%TEMP%\venus-extracurriculars-uninstall.log"
set ELECTRON_RUN_AS_NODE=1
echo.
echo   Uninstalling... this can take a minute.
"%GAME%\Venus University.exe" "%HERE%patch.mjs" uninstall "%GAME%" > "%LOG%" 2>&1
set "CODE=%ERRORLEVEL%"
type "%LOG%"
del "%LOG%" > nul 2>&1
echo.
pause
exit /b %CODE%
:missing
echo.
echo   "Venus University.exe" was not found in that folder. Nothing was changed.
echo.
pause
exit /b 1
:unpacked
echo.
echo   patch.mjs is missing. Extract the whole zip first, then run this again.
echo.
pause
exit /b 1
