@echo off
setlocal
set CMAKE=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe
set ROOT=E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI
set SERVER_EXE=%ROOT%\build\server\Debug\singan2_server.exe

echo [1] kill old server ...
taskkill /F /IM singan2_server.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2] rebuild server (Debug) ...
"%CMAKE%" --build "%ROOT%\build" --config Debug --target singan2_server > "%ROOT%\poc\build_server.log" 2>&1
type "%ROOT%\poc\build_server.log"
if errorlevel 1 (
  echo [ERROR] build failed
  exit /b 1
)

echo [3] restart server ...
start "SINGAN2-API" "%SERVER_EXE%" 8080
echo [done] server restarted on :8080
endlocal
