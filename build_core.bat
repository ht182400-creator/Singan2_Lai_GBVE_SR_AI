@echo off
REM =============================================================
REM  Build SINGAN2 core (and server / tests).
REM  Usage: double-click, or run build_core.bat [Debug|Release].
REM  First run: cmake configure (x64), then build target singan2_core.
REM =============================================================

setlocal
set ROOT=E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI
set CMAKE=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe
set CFG=Debug
if not "%1"=="" set CFG=%1

echo Build config: %CFG%
echo Project root: %ROOT%

REM Configure if build dir is missing or not yet configured
if not exist "%ROOT%\build\CMakeCache.txt" (
    echo.
    echo [1/2] First-time configure - Visual Studio 17 2022, x64 ...
    "%CMAKE%" -S "%ROOT%" -B "%ROOT%\build" -G "Visual Studio 17 2022" -A x64
    if errorlevel 1 (
        echo   [ERROR] cmake configure failed.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [1/2] build directory exists, skipping configure
    echo        (delete the build directory if you need to reconfigure for x64).
)

echo.
echo [2/2] Building singan2_core (and server / tests) ...
"%CMAKE%" --build "%ROOT%\build" --config %CFG% --target singan2_core
if errorlevel 1 (
    echo   [ERROR] singan2_core build failed.
    pause
    exit /b 1
)

echo.
echo [Optional] Building server and tests as well ...
"%CMAKE%" --build "%ROOT%\build" --config %CFG%
if errorlevel 1 (
    echo   [WARNING] server/tests had errors, but core succeeded.
)

echo.
echo Build complete. Backend executable:
echo   %ROOT%\build\server\%CFG%\singan2_server.exe
echo.
echo Next step: run run_all.bat to start frontend and backend.
echo ============================================
endlocal
pause