@echo off
REM =============================================================
REM  Stop SINGAN2 frontend and backend processes (no restart).
REM  Usage: double-click, or run stop_all.bat from cmd.
REM =============================================================
setlocal
set PORT_API=8080
set PORT_WEB=5173

echo ============================================
echo Stopping SINGAN2 services (ports %PORT_API% / %PORT_WEB%) ...
echo ============================================

REM Kill by port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PORT_API% ^| findstr LISTENING') do (
    echo   Killing backend PID %%p
    taskkill /F /PID %%p >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PORT_WEB% ^| findstr LISTENING') do (
    echo   Killing frontend PID %%p
    taskkill /F /PID %%p >nul 2>&1
)

REM Fallback: kill by process name (covers non-LISTENING / unmatched-port cases)
taskkill /F /IM singan2_server.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Done. Ports should now be free.
echo Verify with: netstat -ano ^| findstr ":8080 :5173"
echo ============================================
endlocal
pause