# AGENTS.md — AI 助手自动化安装、调试与发版指南

当用户让你帮忙安装、卸载、修复或更新 **Antigravity Viewer Pulse** 时，请直接按以下规范操作，无需向用户反复追问默认路径。

## 1. 一键正式安装（推荐所有普通用户）

在仓库根目录执行：

```bash
# macOS / Linux
./install.sh

# 或者跨平台通用 CLI
node cli.js setup
```

Windows PowerShell / CMD：

```bat
.\install.bat
```

说明：
- **macOS**：`./install.sh`（或 `node cli.js setup`）会将插件同步至稳定目录 `~/.antigravity-pulse`，向 `/Applications/Antigravity.app` 完成 `app.asar` 备份与注入、Ad-hoc 签名修复，并注册 `~/Library/LaunchAgents/com.antigravity.pulse.guard.plist` 守护任务（当官方客户端升级覆盖 `app.asar` 时自动静默重装）。
- **Windows**：`install.bat` 会优先调用系统 `node`，若未安装 Node.js 则自动设置 `ELECTRON_RUN_AS_NODE=1` 借用 `Antigravity.exe` 完成安装。

## 2. 一键卸载与原生恢复

```bash
# macOS / Linux
./uninstall.sh

# Windows
.\uninstall.bat

# 或跨平台 CLI
node cli.js teardown
```

## 3. 开发构建与测试

修改 `src/renderer/` 下的前端样式或逻辑后，必须重新构建单文件渲染产物并通过单测：

```bash
node scripts/build-renderer.js
node scripts/check-release-manifest.js
npm test
```

若需要向当前正在运行的 Antigravity 窗口实时热注入预览：

```bash
npm run live
```

## 4. 在线更新与自动发版（GitHub Actions）

客户端内置更新器默认订阅 `DDG0808/antigravity-viewer-pulse` 的 GitHub Releases：
1. 同步更新以下 3 处版本号（例如 `0.9.1`）：
   - `package.json` (`version`)
   - `plugin.json` (`version`)
   - `src/renderer/main.js` (`METER_VERSION`)，随后运行 `node scripts/build-renderer.js`
2. 更新 `RELEASE_NOTES.md` 中的更新日志。
3. 运行 `node scripts/check-release-manifest.js && npm test` 确保版本与热更新清单一致。
4. 提交代码并推送版本标签：
   ```bash
   git tag v0.9.1
   git push origin main --tags
   ```
5. GitHub Actions (`.github/workflows/release.yml`) 将自动编译 Windows 辅助组件、打包 6 个平台架构的 `antigravity-viewer-pulse_<ver>_<os>_<arch>.zip` 与 `checksums.txt` 并发布正式 Release，已安装用户即可在面板「版本更新」页一键完成 SHA-256 校验与免重启热更新。
