# Agent Note：minimal preset 在 Windows 上遵循 pwsh 默认策略

Status: implemented

[English](2026-08-14-minimal-preset-windows-pwsh.md) | 中文

## 问题

Web 端发布的 `minimal` preset 负责一个仅包含两个工具的编码 Agent 组合。它的 Shell 工具是基于本地 PTY 服务的持久 Bash，但该 PTY 的进程检查器按设计只实现了 Linux 和 macOS。其他已发布的 Web preset 都遵循 Windows Shell 策略：在 `win32` 上禁用 Bash，并改为挂载 `pwsh`。`minimal` 在改造成裸的双工具运行时时漏掉了这层平台 gate。

因此，在 Windows 上选择快速/minimal 模式后，会挂载持久 Bash 栈，并在命令真正执行前报错：`subprocess-local: terminal inspection is unsupported on platform win32`。同时，模型拿到的还是 Bash 专用工具描述，可能生成 POSIX 命令，而发布的 Windows 执行器实际上是 PowerShell。这正是上游 Discussion #53 报告的故障。

此前关于 minimal preset 的说明把 Windows 标记为不支持，因为 PTY 底层只支持 POSIX。这一点对于“持久 Bash”本身仍然成立，但既然产品已经提供原生 Windows Shell 工具，就不应让一个在界面中可选的 Web preset 直接失败。

## 决策

Web `minimal` preset 在每个受支持平台上仍保持恰好两个模型可见工具，但 Shell 实现按平台选择。

- Linux 和 macOS 保持现状：继续使用 entry-local PTY registry、`terminal-bash`、持久 Bash 工具、固定 Bash 描述和 `str_replace_editor`。
- Windows 在 PTY 插件挂载前禁用整个 `persistent-shell` group，并改为启用已有的 `@deepseek-ai/dsh-tool-pwsh`。编辑器不变，因此 Windows 的工具目录为 `pwsh` 加 `str_replace_editor`。
- Windows 的 pwsh 行继续消费发布配置中 host-plane 的 pwsh executor 及既有 sandbox policy。preset 不创建第二套执行器，也不增加新的 Shell 选择通道。
- `createProcessInspector()` 继续保持严格行为。不增加假的 Windows no-op inspector，因为伪装出进程树检查能力会削弱 PTY 会话的后代进程清理、前台信号和 PID 复用保护。

这个决策只改变已发布 Web 的 `minimal` preset。独立 JSON-RPC minimal 示例仍然代表持久 Bash 的训练运行时，并保留现有的平台要求。

## 验证

`apps/cli/tests/windows-shell.spec.ts` 通过 Cordis entry schema 加载真实发布的 minimal preset，并分别用模拟 `win32` 和 Linux 上下文计算其中的 `!!js process.platform` 表达式。测试固定以下行为：`persistent-shell` 只在 Windows 上禁用，`tool-pwsh` 只在 Windows 上启用，同时普通的一次性 `tool-bash` 仍不会出现在 minimal 中。

已有的 Shell 组合测试继续固定 host-plane 的 Windows pwsh executor，以及 standard/code/cordis preset 的平台 gate。两部分断言共同证明 minimal 的 Windows fallback 会复用同一套已发布 pwsh 栈，而不会形成第二套 Shell 策略。

## 备选方案

**增加一个 no-op Windows process inspector。** 不采用。terminal 的 teardown 和 signaling 依赖真实的进程身份与进程树观测；返回猜测值或空数据会让 PTY 看起来“支持 Windows”，同时静默削弱生命周期保证。

**继续使用持久 Bash，并要求安装 Git Bash 或 WSL。** 不采用。当前故障发生在平台进程检查器，而不仅是 Bash 可执行文件解析；并且发布的 Windows 策略已经原生选择 PowerShell。

**在 Windows 上隐藏或拒绝 minimal preset。** 不采用。这个 preset 的核心承诺是固定 prompt 和精简工具目录，而不是必须持久化 Bash。复用原生 pwsh 工具可以保留该产品形态，只留下一个明确的平台差异。

## 后果

Windows minimal 会使用一次性 PowerShell，而不是持久 Bash，因此该平台上的 Shell 本地状态不会跨调用保留。POSIX minimal 仍保持原有持久 Bash 行为。Windows 不再进入不受支持的本地 PTY 路径，模型拿到的也会是与主机执行器一致的 PowerShell 工具语义。
