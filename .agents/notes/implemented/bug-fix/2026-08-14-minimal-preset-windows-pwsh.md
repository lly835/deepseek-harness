# Agent Note: The minimal preset follows the Windows pwsh default

Status: implemented

English | [中文](2026-08-14-minimal-preset-windows-pwsh.zh.md)

## Problem

The shipped Web `minimal` preset owns a two-tool coding-agent composition. Its shell tool is persistent Bash backed by the local PTY service, but that PTY's process inspector intentionally implements only Linux and macOS. The other shipped Web presets follow the Windows shell policy by gating Bash off on `win32` and mounting `pwsh` instead. `minimal` bypassed that platform gate when its bare two-tool runtime was introduced.

On Windows, selecting the quick/minimal mode therefore mounts the persistent Bash stack and fails before command execution with `subprocess-local: terminal inspection is unsupported on platform win32`. The model also receives a Bash-specific description and can emit POSIX commands even though the shipped Windows executor is PowerShell. This is the failure reported in upstream Discussion #53.

The earlier minimal-preset note described Windows as unsupported because the PTY substrate is POSIX-only. That remains true for persistent Bash itself, but it should not make the selectable Web preset fail when the product already has a native Windows shell tool.

## Decision

The Web `minimal` preset keeps exactly two model-facing tools on every supported host, with a platform-specific shell implementation.

- Linux and macOS keep the existing entry-local PTY registry, `terminal-bash`, persistent Bash tool, fixed Bash description, and `str_replace_editor` unchanged.
- Windows disables the entire `persistent-shell` group before its PTY plugins mount and enables the existing `@deepseek-ai/dsh-tool-pwsh` row instead. The editor remains unchanged, so the Windows catalog is `pwsh` plus `str_replace_editor`.
- The Windows pwsh row consumes the shipped host-plane pwsh executor and its existing sandbox policy. The preset does not create a second executor or add another shell-selection channel.
- `createProcessInspector()` remains strict. No no-op Windows inspector is introduced, because pretending that process-tree inspection exists would weaken descendant cleanup, foreground signaling, and PID-reuse protections for PTY sessions.

This decision changes only the shipped Web `minimal` preset. The standalone JSON-RPC minimal example continues to represent the persistent-Bash training runtime and retains its existing platform requirements.

## Verification

`apps/cli/tests/windows-shell.spec.ts` loads the real shipped minimal preset through the Cordis entry schema and evaluates its `!!js process.platform` expressions under synthetic `win32` and Linux contexts. It pins that `persistent-shell` is disabled only on Windows, `tool-pwsh` is enabled only on Windows, and the ordinary one-shot `tool-bash` row remains absent from minimal.

The existing shell-composition coverage continues to pin the host-plane Windows pwsh executor and the standard/code/cordis preset gates. Together these assertions prove that the minimal Windows fallback resolves to the same shipped pwsh stack instead of creating a parallel shell policy.

## Alternatives considered

**Add a no-op Windows process inspector.** Rejected because terminal teardown and signaling depend on real process identity and process-tree observations. Returning guessed or empty data would make the PTY appear supported while silently weakening its lifecycle guarantees.

**Keep persistent Bash and require Git Bash or WSL.** Rejected because the failure occurs in the platform process inspector, not merely Bash executable resolution, and the shipped Windows policy already selects PowerShell natively.

**Hide or reject the minimal preset on Windows.** Rejected because the preset's core promise is the fixed prompt and small tool catalog, not Bash persistence specifically. Reusing the native pwsh tool preserves that product surface with one documented platform difference.

## Consequences

Windows minimal sessions use one-shot PowerShell rather than a persistent Bash shell, so shell-local state does not persist across calls there. POSIX minimal sessions retain persistent Bash exactly as before. Windows no longer enters the unsupported local PTY path, and the model receives the PowerShell tool dialect that matches the host executor.
