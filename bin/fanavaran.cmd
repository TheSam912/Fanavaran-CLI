@echo off
REM Safe to run from this folder. setup still installs an absolute-path copy in %USERPROFILE%\bin.
set "CLI=%~dp0fanavaran.js"
if not exist "%CLI%" (
  echo Fanavaran CLI not found at: %CLI%
  echo From the Fanavaran-CLI repo run:  node bin/fanavaran.js setup
  exit /b 1
)
node "%CLI%" %*
