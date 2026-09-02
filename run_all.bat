@echo off
REM =============================================================
REM  SINGAN2 one-click launcher: kill old frontend/backend, then start both.
REM  Usage: double-click, or run run_all.bat from cmd.
REM  Prereq: build_core.bat has been run (singan2_server.exe exists).
REM =============================================================

setlocal
chcp 65001 >nul
set ROOT=E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI
set CMAKE=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe
set SERVER_EXE=%ROOT%\build\server\Debug\singan2_server.exe
set PORT_API=8080
set PORT_WEB=5173

echo ============================================
echo [1/3] Killing old processes on ports %PORT_API% (backend) / %PORT_WEB% (frontend) ...
echo ============================================

REM Kill by port (LISTENING state)
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

REM Wait 2 seconds for TIME_WAIT / handle release
timeout /t 2 /nobreak >nul

echo   Done.

echo.
echo ============================================
echo [2/3] Building backend M3 API (增量重编 singan2_server) ...
echo ============================================
if not exist "%ROOT%\build\CMakeCache.txt" (
    echo   [ERROR] build 目录未配置，请先运行 build_core.bat 完成首次 cmake 配置。
    pause
    exit /b 1
)
"%CMAKE%" --build "%ROOT%\build" --config Debug --target singan2_server
if errorlevel 1 (
    echo   [ERROR] 后端编译失败，未启动旧 exe（先用 build_core.bat 排查错误）。
    pause
    exit /b 1
)
echo   后端编译完成。

echo ============================================
echo [2/3] Starting backend M3 API (singan2_server.exe :%PORT_API%) ...
echo ============================================
if not exist "%SERVER_EXE%" (
    echo   [ERROR] %SERVER_EXE% not found.
    echo   Please run build_core.bat first.
    pause
    exit /b 1
)
start "SINGAN2-API" "%SERVER_EXE%" %PORT_API%
echo   Backend launched in new window, listening on http://127.0.0.1:%PORT_API%

echo.
echo ============================================
echo [3/3] Starting frontend Web (Vite :%PORT_WEB%) ...
echo ============================================
if not exist "%ROOT%\web\node_modules" (
    echo   [INFO] node_modules not found, running npm install ...
    pushd "%ROOT%\web"
    call npm install
    popd
)
start "SINGAN2-WEB" cmd /k "cd /d %ROOT%\web && npm run dev"
echo   Frontend will start at http://localhost:%PORT_WEB% in a new window.

echo.
echo All services started. Close the corresponding windows to stop them,
echo or re-run this bat to kill and restart.
echo ============================================
endlocal
pause