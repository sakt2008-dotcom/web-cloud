@echo off
title AMASA RESORT - local test
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
start "" http://localhost:3000
node serve.cjs
pause
