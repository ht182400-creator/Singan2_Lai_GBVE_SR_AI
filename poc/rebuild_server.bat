@echo off
setlocal
set CMAKE=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe
set ROOT=E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI
echo [build] server (Debug) ...
"%CMAKE%" --build "%ROOT%\build" --config Debug --target singan2_server > "%ROOT%\poc\build_server.log" 2>&1
type "%ROOT%\poc\build_server.log"
if errorlevel 1 (
  echo [ERROR] build failed
  exit /b 1
)
echo [build] done
endlocal
