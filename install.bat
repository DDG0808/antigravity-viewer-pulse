@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion

cd /d "%~dp0"

echo ========================================================
echo   Antigravity Viewer Pulse v0.10.1 - 一键安装向导 (Windows)
echo ========================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :TRY_ELECTRON
echo [1/2] 已检测到系统 Node.js 运行时，开始正式注入安装...
node "%~dp0cli.js" setup %*
set "EXIT_CODE=%ERRORLEVEL%"
goto :FINISH

:TRY_ELECTRON
set "AG_EXE="
if exist "%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" set "AG_EXE=%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe"
if not defined AG_EXE if exist "%ProgramFiles%\Antigravity\Antigravity.exe" set "AG_EXE=%ProgramFiles%\Antigravity\Antigravity.exe"
if not defined AG_EXE if exist "%ProgramFiles(x86)%\Antigravity\Antigravity.exe" set "AG_EXE=%ProgramFiles(x86)%\Antigravity\Antigravity.exe"

if not defined AG_EXE goto :NO_RUNTIME

echo [1/2] 未安装独立 Node.js，自动借用 Antigravity 内置引擎完成安装...
set "ELECTRON_RUN_AS_NODE=1"
"%AG_EXE%" "%~dp0cli.js" setup %*
set "EXIT_CODE=%ERRORLEVEL%"
set "ELECTRON_RUN_AS_NODE="
goto :FINISH

:NO_RUNTIME
echo [错误] 未检测到 Node.js 或默认路径下的 Antigravity.exe。
echo 请先安装 Antigravity 桌面端，或安装 Node.js ^(https://nodejs.org/^) 后重试。
set "EXIT_CODE=1"

:FINISH
echo.
if "%EXIT_CODE%"=="0" (
    echo [2/2] 安装完成！现在打开或重启 Antigravity 即可看到右上角状态胶囊。
) else (
    echo [提示] 若提示权限不足，请右键点击 install.bat 选择「以管理员身份运行」。
)
echo.
pause
exit /b %EXIT_CODE%
