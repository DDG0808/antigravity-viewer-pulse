@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ========================================================
echo   Antigravity Viewer Pulse - 一键卸载与原生恢复向导
echo ========================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node "%~dp0cli.js" teardown %*
    set "EXIT_CODE=%ERRORLEVEL%"
    goto :FINISH
)

set "AG_EXE="
if exist "%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" (
    set "AG_EXE=%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe"
) else if exist "%ProgramFiles%\Antigravity\Antigravity.exe" (
    set "AG_EXE=%ProgramFiles%\Antigravity\Antigravity.exe"
) else if exist "%ProgramFiles(x86)%\Antigravity\Antigravity.exe" (
    set "AG_EXE=%ProgramFiles(x86)%\Antigravity\Antigravity.exe"
)

if defined AG_EXE (
    set "ELECTRON_RUN_AS_NODE=1"
    "!AG_EXE!" "%~dp0cli.js" teardown %*
    set "EXIT_CODE=%ERRORLEVEL%"
    set "ELECTRON_RUN_AS_NODE="
    goto :FINISH
)

echo [错误] 未检测到 Node.js 或默认路径下的 Antigravity.exe，无法自动执行恢复。
set "EXIT_CODE=1"

:FINISH
echo.
if "%EXIT_CODE%"=="0" (
    echo 已卸载插件并恢复 Antigravity 原生文件，重启客户端即可生效。
)
echo.
pause
exit /b %EXIT_CODE%
