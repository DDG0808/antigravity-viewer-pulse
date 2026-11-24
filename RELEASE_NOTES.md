## v0.10.0 更新内容

### 重磅新功能
- **账本一键导出 (CSV / JSON) 与各模型花费明细排行**：在「脉搏账本」中新增 UTF-8 BOM `CSV`（防 Excel 乱码与公式注入）与结构化 `JSON` 导出按钮；底部切换新增「排行」视图，按模型展示实际 API 零售花费、Token 总量、调用次数与成本占比进度条。
- **免 TUN 代理多预设管理 (Proxy Profiles 一键切换)**：在「内核工坊」免 TUN 代理卡片内支持保存/管理最多 12 个命名代理节点预设（持久化于 `modules.json` 且展示自动脱敏凭据），点击预设胶囊即可一键切换地址并自动触发四层连通性诊断。
- **Windows 官方更新自愈守护**：补齐与 macOS `launchd WatchPaths` 对等的 Windows 守护能力，通过无黑窗 `guard-sync.vbs` + 任务计划 `AntigravityPulseUpdateGuard`（登录触发 + 每 2 小时巡检，含启动目录回退与 `EBUSY` CDP 热注入兜底），官方升级覆写 `app.asar` 后自动补装自愈。
- **Audit 会话轮次时间线与自动压缩标注**：审计抽屉右侧新增「轮次时间线 / 附件明细」切换，按轮次追踪上下文大小、缓存命中与 TTFT/TPS 速度；自动识别 Antigravity 上下文压缩点并标注压缩降幅（不再将正常自动压缩误报为缓存断流）。
- **一键复制会话遥测 Markdown 摘要 + `Alt+Shift+P` 快捷呼出**：驾驶舱顶栏与审计抽屉新增「复制摘要」按钮，一键导出不含隐私路径与令牌的 Markdown 遥测快照；支持 `Alt+Shift+P`（macOS `Option+Shift+P`）全局呼出/收起 HUD（输入焦点内自动避让）。

### 安全边界与 IPC / OTA / CI 加固
- **收紧宿主窗口 URL 白名单**：`isAntigravityFallbackWorkbenchUrl` 改为严格 `URL` 解析，仅允许本机回环 / `file:` 路径末尾为 `/workbench.html` 及 Electron 本机协议（`vscode-file:` / `app:`），彻底阻断恶意外部网页通过 `?p=workbench.html` 触发脚本注入与本地令牌泄露。
- **全量 IPC 与 Live-Host 参数白名单化**：对 `get-settings`、`save-settings`、`check-update`、`apply-update`、`context-unlock-*`、`enhance-*`、`modules-status`、`toggle-module`、`restart-host` 及 `get-quota` 全部实施主进程白名单过滤，强制固定 `currentVersion`、阻断渲染层覆盖 `targetDir`/`asarPath`/`_stateDir`/`targets`/`appOverride`，并修复 `launch-cli` 未透传 `cwd` 的问题。
- **纯 Node ZIP 硬核验签与重定向收紧**：移除 OTA 解压失败后回退系统 `tar`/`unzip` 的旁路，补齐 EOCD 尾部长度、Central Directory 边界、本地头与中央目录文件名一致性、CRC32 与总解压配额（128 MiB）校验；收紧 GitHub/AWS S3 重定向白名单并隔离 Hop-1 `streamTo` 所有权；`.live-session.json` 统一以 `0o600` 权限落盘，Chromium 代理参数剥离凭据，CLI 日志全面脱敏。
- **Release Workflow 防注入与最小权限**：`.github/workflows/release.yml` 改用环境变量传递标签并做正则校验，全局降权至 `contents: read`（仅发布 Job 持有 `contents: write`），同步升级至 Node 22。

### 跨平台安装、采集器与长时运行自愈
- **根治长时运行后 HUD 归零与额度鉴权卡死**：
  - 修复在轨迹轮询或归档扫描在途时切换会话导致 `requestBusy`/`scanBusy` 永久锁死（界面长期卡在 `0 tok / 等待模型响应 / -- tok/s`）的竞态死锁，切会话时立即中止旧请求、按令牌精准释放忙锁并加入 25s/45s 休眠挂起看门狗。
  - 渲染层拦截器被动嗅探宿主最新 `x-codeium-csrf-token`，并在 `pollTrajectory`、`GetAvailableModels` 及同源额度兜底中遇到 `HTTP 401/403` 时自动重拉 `/` 刷新令牌重试；支持窗口休眠唤醒（`visibilitychange`/`focus`）自动恢复同步。
  - `local-api.js` 与 `meter-collector.js` 改用括号平衡解析 `window.__APP_CONFIG__`、透传 `GET /` 的 `Set-Cookie`、遇 `401/403` 自动重拉刷新重试并在原端口失效时回退 CDP 重新发现活跃 Hub；前端 `syncQuotaFromHost` 在后端报 `本地鉴权失败或已失效` 或旧缓存桶已过重置时间（`待重置`）时不再跳过同源 RPC 自愈。
- **根治采集器并发死锁**：修复 `collect()` 在 `supersedePrevious: true` 被抢占取消后 `pending` 僵尸 Promise 永久滞留导致后续强制扫描也卡死的问题；支持 `http://` / `localhost` 回环并增加 CSRF 匹配空保护；采集器 Worker 消息串行化避免环境变量并发踩踏；15 秒配额缓存支持按焦点模型重建视图。
- **Windows / macOS / Linux 全链路修复**：修复 `install.bat`/`uninstall.bat` 的 `ERRORLEVEL` 块内解析缺陷；修复 Windows `setup` 误传 macOS App 路径、借壳 Electron 时 `ELECTRON_RUN_AS_NODE` 反转与 `cli.js` 子命令解析；修复 `ag-pulse setup` 在无源码的 `live-runtime` 目录中报错与 `teardown` 还原失败误删备份；统一 Linux 代理探测路径为 `XDG_STATE_HOME`；修复从备份重装时 `.unpacked` 原生模块缺失问题并改为 POSIX 原子 `renameSync`。
- **代理探测与互斥锁加固**：`testProxyHealth` 支持 `https://` 代理与 IPv6 方括号剥离，SOCKS5 校验协商方法并监听提前断开；文件互斥锁对非 `EEXIST` 错误即时抛出并在释放前核验持有令牌。

### 账本精算、二进制解锁与 HUD 体验
- **账本与缓存统计精准化**：`summarize()`、`summarizeApiCost()` 与会话缓存命中率统一计入 `cacheWriteTokens`；修复 `gemini-3.1-pro` 折算口径与非 USD 地区订阅汇率偏差（统一读取核心 `6.72` 基准）；修复 `gemini-2.5-flash-lite` 误归类、硬编码 `pricingDate`、纯日期 UTC 偏移与 `_dailyCostCache` 无界增长；负净缓存收益统一显示为「净增」而非「省 $-x」。
- **二进制增强与解锁修复**：修复 `.old_<ts>_<rand>` 残留清理失效导致的磁盘泄漏；Worker 静态分析结果回填主线程缓存并补全缺失参数；手术式还原后再次解锁保护纯净 `.orig` 备份不被覆盖；隔离多目标进程缓存并正确处理 `pgrep` 退出码 1。
- **HUD 渲染、图表与性能**：修复 Speed Duel 切换 TTFT/耗时无样本时崩溃与单日累计曲线悬停；修复 Studio 增强状态未读取 `data.summary` 导致设置失真并改为并发拉取；修复无关 WebSocket 帧误消耗 450ms 请求去重标记并加入高速预筛；优化隐藏页签心跳节流、窄窗锚点防越界、无权限池外环重置、`i18n-runtime` 忽略 `#ag-context-meter` 以及关闭态 `visibility: hidden` 与键盘 `:focus-visible` 焦点环。
