## Antigravity Viewer Pulse v0.9.0

### 核心亮点 (Spatial Bento HUD v3)
- **渐进式缓存命中率监控**：主卡片默认展示**会话累计缓存命中率**（已命中 / 可复用输入池），直观衡量长对话省流效率；悬停或点击药丸无缝展开**本轮最近一次模型请求**的精确命中率与 Token 明细。
- **5h 窗口 + 周额度双池同屏透视**：自动聚合 Claude / GPT 与 Gemini Pro / Flash 共享额度池，同时展示 5 小时短周期窗口与 7 天周限额剩余百分比及重置倒计时。
- **端到端 `tok/s` 真实生成吞吐校准**：全链路保留 `modelOutputTokens` 与生成耗时统计，兼容流式增量与非流式回包，准确计算单轮及会话平均输出速度。
- **精简无冲突上下文窗口卡片**：移除冗余快捷按钮与拥挤字号，上下文预算统一收口至设置抽屉，兼容 Antigravity `2.32+` 最新协议。
- **傻瓜式一键安装 & 官方更新自愈守护**：
  - **macOS**：双击 `安装 Antigravity Pulse.command` 完成注入，并自动注册 `launchd` 文件变动守护，即使 Antigravity 官方客户端自动更新覆盖了 `app.asar`，也会在数秒内静默自愈重装。
  - **Windows**：双击 `install.bat` 一键安装（内置自动借用客户端 Electron 运行时，电脑没装 Node.js 也能装）。
  - **Linux**：运行 `./install.sh` 一键部署。
- **内置 SHA-256 在线热更新系统**：控制舱「版本更新」标签页直接对接 `DDG0808/antigravity-viewer-pulse` Releases，支持新版本红点提示、SHA-256 完整性校验与免重启 Live-Host 热切换。
