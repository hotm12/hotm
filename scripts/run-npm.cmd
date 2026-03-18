@echo off
setlocal

set "NODE_EXE=%npm_node_execpath%"
if not defined NODE_EXE set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"

if not exist "%NODE_EXE%" (
  echo Node executable not found. 1>&2
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "NPM_CMD=%NODE_DIR%npm.cmd"

if not exist "%NPM_CMD%" (
  echo npm command not found. 1>&2
  exit /b 1
)

call "%NPM_CMD%" %*
