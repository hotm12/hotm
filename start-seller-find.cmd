@echo off
setlocal

set "ROOT_DIR=%~dp0"

echo Starting Seller Find with embedded PostgreSQL...
echo Root: %ROOT_DIR%

start "Seller Find DB" /D "%ROOT_DIR%" cmd /k "call scripts\run-with-npm-node.cmd scripts\embedded-postgres-server.mjs"

timeout /t 3 /nobreak >nul

start "Seller Find API" /D "%ROOT_DIR%" cmd /k "call scripts\with-embedded-db-env.cmd scripts\run-npm.cmd --workspace apps/api run start:dev"
start "Seller Find Web" /D "%ROOT_DIR%" cmd /k "call scripts\run-npm.cmd --workspace apps/web run dev"

timeout /t 5 /nobreak >nul
start "" http://localhost:3000

echo Web: http://localhost:3000
echo API: http://localhost:3001/api/health
echo DB:  postgresql://postgres:postgres@127.0.0.1:5432/seller_find
echo.
echo Three terminal windows were opened for the DB, API, and web server.
echo Discovery page: http://localhost:3000/discovery
echo You can close this launcher window now.

endlocal
