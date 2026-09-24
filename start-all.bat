@echo off
setlocal
title EduSphere launcher
cd /d "%~dp0"

echo ============================================
echo  EduSphere - starting all services
echo ============================================

rem --- 1. PostgreSQL must be running (local Windows service) ---
set "PG_OK="
for /f "tokens=*" %%s in ('sc query state^= all ^| findstr /i "SERVICE_NAME.*postgresql"') do set "PG_OK=1"
if not defined PG_OK (
  echo [WARN] No PostgreSQL Windows service found. Make sure your database is reachable at DATABASE_URL in backend\.env
) else (
  sc query postgresql-x64-18 | findstr /i "RUNNING" >nul || (
    echo Starting PostgreSQL service...
    net start postgresql-x64-18 >nul 2>&1 || echo [WARN] Could not start PostgreSQL. Start it manually / run as Administrator.
  )
)

rem --- 2. Free ports 4000 (API) and 3000 (web) from stale processes ---
for %%p in (4000 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%%p .*LISTENING"') do (
    echo Port %%p busy - stopping PID %%a
    taskkill /F /PID %%a >nul 2>&1
  )
)

rem --- 3. Backend: deps, prisma client, MIGRATIONS, seed ---
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing backend dependencies...
  call npm install || goto :fail
)
if not exist .env (
  echo Creating backend\.env from .env.example - edit DATABASE_URL and secrets, then re-run.
  copy .env.example .env >nul
  goto :fail
)
echo Generating Prisma client...
call npx prisma generate || goto :fail
echo Applying database migrations...
call npx prisma migrate deploy || goto :fail
echo Seeding base data / admin account...
call npx tsx prisma/seed.ts || goto :fail

rem --- 4. Frontend deps ---
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install || goto :fail
)

rem --- 5. Launch both servers in their own windows ---
echo Starting API on http://localhost:4000 ...
start "EduSphere API :4000" cmd /k "cd /d %~dp0backend && npm run dev"
echo Starting web app on http://localhost:3000 ...
start "EduSphere Web :3000" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Web:      http://localhost:3000
echo  API:      http://localhost:4000/api/v1
echo  API docs: http://localhost:4000/api/docs
echo.
timeout /t 8 >nul
start "" http://localhost:3000
exit /b 0

:fail
echo.
echo [ERROR] Startup failed - see messages above.
pause
exit /b 1
