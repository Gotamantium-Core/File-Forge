@echo off
title File Forge
cd /d "%~dp0"
node "%~dp0scripts\launch.mjs" %*
if errorlevel 1 pause
