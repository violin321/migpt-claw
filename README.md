# migpt-claw

[中文](#中文) | [English](#english)

## 中文

`migpt-claw` 是一个面向 OpenClaw 的小米小爱音箱 Channel 插件实验实现，用来把 OpenClaw 的文本结果转成适合音箱场景的语音播报，并通过小米侧会话链路轮询用户对话。

它的目标是把 **OpenClaw Channel runtime**、**小米账号 / 设备访问链路**、以及**音箱场景下的播报约束**接起来，方便开发者做本地实验、兼容性验证和二次实现。

> [!IMPORTANT]
> 本项目仍应视为实验性集成，不应被描述为：
> - 小爱官方替代品
> - 稳定低延迟语音助手
> - 已完整验证的可靠打断方案
> - 已确认可直接集成 cron / 自动化工作流的官方能力
> - 任何来自小米或 OpenClaw 官方的支持或背书

### 项目定位

当前仓库主要覆盖以下方向：

- 以 OpenClaw Channel 插件形式接入小爱音箱
- 通过 **MiNA / MIoT** 控制音箱播报与部分设备行为
- 通过 **XiaoAI conversation history chain** 轮询最近会话
- 为音箱场景补充更适合 TTS 的输出约束
- 提供一个仓库内技能 `skills/migpt-volume` 作为相关能力示例

它更适合被理解为：**MiGPT / MiGPT Next 思路在 OpenClaw Plugin / Channel runtime 上的一次接线与兼容探索**。

### 当前能力概览

- **语音播报**：把 OpenClaw 输出转成小爱音箱播报
- **分块播报**：长文本按 chunk 输出，尽量降低单次等待体感
- **多设备 / 多账号配置基础**：支持按配置选择账户与设备
- **MiNA / MIoT 双控制路径**：不同型号可尝试不同控制方式
- **启动 / 收到消息提示**：支持基础上线播报和接收提示
- **音量相关 skill**：内置 `skills/migpt-volume`

### 已知边界

请在使用前先接受这些边界：

- **不是所有型号都验证过**：不同小爱音箱型号对 MiNA / MIoT 的支持存在差异
- **打断能力不能夸大**：仓库内有相关占位与尝试，但不应宣称“可靠打断”已被系统性验证
- **会话轮询依赖小米侧接口行为**：conversation history 链路可能受接口变化、账号状态、风控或地区差异影响
- **延迟表现不保证稳定**：分块播报可改善体感，但不能承诺稳定低延迟
- **自动化工作流仅能谨慎描述**：若你在外部流程里接了 `xiaomi-mimo-tts`、`mimo-tts-feishu-audio` 或 MiMo warm brief 脚本，它们应视为相关外部工作流 / 待验证链路，不应写成仓库已确认内建
- **OpenClaw 兼容性需自行验证**：不同版本的 OpenClaw SDK / runtime 可能存在接口代差

### 快速开始

#### 1. 安装插件

```bash
openclaw plugins install ./migpt-claw-1.0.0.tgz
```

#### 2. 配置账号与设备

编辑 `~/.openclaw/openclaw.json`。

下面示例只展示字段结构与占位符，**不要**把真实密码、token、serviceToken、ssecurity 等敏感值提交到仓库。

```json
{
  "channels": {
    "migpt": {
      "enabled": true,
      "userId": "123456789",
      "password": "<your-password>",
      "passToken": "<your-pass-token>",
      "devices": ["客厅音箱"],
      "speakerControl": "mina",
      "announceOnStart": true,
      "startupMessage": "您的小龙虾已上线，随时为您服务",
      "acknowledgeOnReceive": true,
      "receiveMessage": "收到，处理中"
    }
  }
}
```

字段说明：

- `userId`：小米 ID（数字）
- `password`：小米账号密码
- `passToken`：登录辅助凭证；字段可以出现，但请勿泄露真实值
- `devices`：目标小爱音箱名称列表，需与米家 App 中名称一致
- `speakerControl`：`mina` 或 `miot`
- `announceOnStart`：是否启动播报
- `startupMessage`：启动播报文案
- `acknowledgeOnReceive`：收到消息时是否给出提示
- `receiveMessage`：接收提示文案

#### 3. 选择音箱控制方式

`speakerControl` 用于指定控制路径：

- `mina`：默认路径，适合多数音箱型号
- `miot`：部分型号或场景下可尝试的替代路径

已知可能更需要 `miot` 的型号包括：

- LX04（小爱音箱 Pro）
- X10A（小爱音箱 X10）
- L05B / L05C（小爱音箱 Play 增强版）

但这不是完整兼容性结论。更完整的设备经验可参考上游文档，例如 MiGPT 的兼容性说明：
<https://github.com/idootop/mi-gpt/blob/main/docs/compatibility.md>

#### 4. 启动 / 重载 OpenClaw

按你当前的 OpenClaw 环境方式加载插件。若你在本地开发，通常至少需要：

```bash
npm run build
```

> `openclaw gateway restart` 属于环境操作，不应从外部 README 直接推断为所有场景的唯一步骤；请按你的本地 OpenClaw 版本与运维方式执行。

### 设备名称要求

设备名称必须与米家 App 中显示的名称一致，包括：

- 大小写
- 空格
- 标点
- “音响 / 音箱”等容易混淆的写法

如果设备找不到，可临时打开调试日志，查看实际设备列表后再修正配置。

### 音箱场景下的输出约束

本项目假设语音播报并不适合承载所有内容。

更适合播报的内容：

- 简短确认
- 短问答
- 状态提醒
- 简短摘要

不适合直接播报的内容：

- 代码
- 长篇文档
- 大块结构化数据
- 多链接、多媒体集合

因此仓库里会把“小爱音箱播报”视为一个**受约束的输出渠道**，而不是通用完整 UI。

### 故障排查

#### 登录失败 / 需要验证码

常见现象：

- 登录态失效
- 需要验证码
- 配置存在 `passToken` 字段但仍无法直接通过

建议排查：

1. 重新确认 `userId` / `password` 是否正确
2. 确认 `passToken` 是否只是辅助凭证，而不是被误认为密码替代品
3. 如本地缓存登录态异常，检查 `.mi.json` 相关缓存后再重试
4. 注意 `serviceToken`、`ssecurity` 等字段名可以出现在代码 / 配置结构中，但不要把真实值写入文档或 issue

#### 设备未找到

建议排查：

1. 核对设备名称是否与米家 App 完全一致
2. 尝试切换 `speakerControl: "mina"` / `"miot"`
3. 查看调试日志中枚举到的设备名称、设备标识

#### 会话轮询失败

若 `getConversations` 相关链路异常，通常需要考虑：

1. 网络状态
2. 小米接口行为变化
3. 账号风控 / 登录态失效
4. 当前设备 / 账号是否真的存在可读取的 XiaoAI conversation history

### 项目结构

```text
migpt-claw/
├── index.ts                 # 插件入口
├── src/
│   ├── channel.ts           # Channel 核心
│   ├── service.ts           # 认证与服务接线
│   ├── message.ts           # 会话轮询
│   ├── speaker.ts           # TTS / 播放控制
│   ├── config.ts            # 配置解析
│   ├── outbound.ts          # 出站播报
│   ├── onboarding.ts        # setup 向导适配
│   ├── runtime.ts           # OpenClaw runtime 接线
│   ├── mi/
│   │   ├── account.ts       # 小米账号登录链路
│   │   ├── common.ts        # Mi 服务公共逻辑
│   │   ├── mina.ts          # MiNA API 路径
│   │   ├── miot.ts          # MIoT API 路径
│   │   └── typing.ts        # 小米侧类型定义
│   └── utils/
│       ├── http.ts
│       ├── codec.ts
│       ├── hash.ts
│       ├── io.ts
│       └── parse.ts
└── skills/
    └── migpt-volume/
        ├── index.ts
        └── SKILL.md
```

### 开发

```bash
npm install
npm run build
npm pack --dry-run
```

### Credits

感谢以下项目与实现思路提供参考：

- **[MiGPT](https://github.com/idootop/mi-gpt)**
- **[MiGPT Next](https://github.com/idootop/migpt-next)**
- **[MiService](https://github.com/yihong0618/MiService)**
- **OpenClaw Plugin / Channel runtime**

### Sources / Architecture Notes

本仓库 README 所描述的能力边界，基于以下关联链路理解整理：

- **MiNA / MIoT / XiaoAI conversation history chain**：对应音箱控制、设备访问、对话轮询链路
- **in-repo skill: `skills/migpt-volume`**：仓库内与音箱场景直接相关的 skill 示例
- **MiMo warm brief scripts**：可视为相关思路或周边脚本链路，但不应默认视为本仓库已内建能力
- **Related external workflow / To verify**：`xiaomi-mimo-tts`、`mimo-tts-feishu-audio`

如果你在文档、演示或二次分发中引用这些链路，请保留“相关 / 待验证”边界，不要把它们写成仓库已经正式确认或完整集成的功能。

### Skill Dependencies

当前仓库中可以明确看到的 skill 依赖 / 关联只有：

- `skills/migpt-volume`

除此之外，若你在自己的 OpenClaw 环境里组合其他 skills、agents 或自动化流程，那属于你的部署层编排，不应默认归因到本仓库本身。

### AI-Assisted Development

现有仓库历史中包含 AI 辅助开发痕迹；这属于实现过程信息，不构成对结果稳定性、兼容性或官方支持的额外承诺。

### License

MIT

### 免责声明

本项目仅供学习、研究与个人实验使用。请务必注意：

- 使用时需遵守当地法律法规以及小米相关服务条款
- 本项目与小米公司无官方关联，也不构成任何官方支持或背书
- 使用本项目可能带来账号、设备、接口兼容性与风控风险
- 建议仅使用测试环境、测试账号或非关键设备进行验证
- 项目按“原样”提供，不承诺可用性、稳定性、连续性或适配范围

---

## English

`migpt-claw` is an experimental Xiaomi XiaoAI speaker channel plugin for OpenClaw. It connects OpenClaw outputs to speaker-friendly TTS playback and polls recent XiaoAI-side conversation history so the speaker can act as a constrained voice endpoint.

Its purpose is to bridge the **OpenClaw Channel runtime**, the **Xiaomi account / device access path**, and the **output constraints required by voice-first speaker usage** for local experiments, compatibility checks, and follow-up implementations.

> [!IMPORTANT]
> This project should still be treated as an experimental integration. It should **not** be described as:
> - an official replacement for XiaoAI,
> - a stable low-latency voice assistant,
> - a fully verified reliable interruption solution,
> - a confirmed built-in cron / automation integration,
> - or anything officially supported or endorsed by Xiaomi or OpenClaw.

### Positioning

This repository currently focuses on:

- exposing XiaoAI speakers as an OpenClaw channel plugin,
- using **MiNA / MIoT** to drive playback and some device actions,
- polling the **XiaoAI conversation history chain** for recent user messages,
- adding TTS-oriented output constraints for speaker scenarios,
- and shipping an in-repo skill example at `skills/migpt-volume`.

A practical way to view it is: **an OpenClaw-side wiring and compatibility exploration inspired by MiGPT / MiGPT Next ideas**.

### What it currently does

- **Voice playback** for OpenClaw text responses
- **Chunked playback** for longer text to reduce perceived waiting time
- **Basic multi-account / multi-device configuration support**
- **Dual control paths through MiNA and MIoT**
- **Startup / receive acknowledgements**
- **A bundled volume-related skill** at `skills/migpt-volume`

### Known limits

Please keep these limits in mind:

- **Not all speaker models have been verified**
- **Interruption support should not be overstated**; the repo contains related attempts/placeholders, not a broadly validated guarantee
- **Conversation polling depends on Xiaomi-side interfaces** and may break with API changes, auth state, risk controls, or regional differences
- **Latency is not guaranteed to be consistently low** even with chunked playback
- **Automation workflows must be described carefully**; if you connect external flows such as `xiaomi-mimo-tts`, `mimo-tts-feishu-audio`, or MiMo warm brief scripts, they should be labeled as related external workflows / to verify
- **OpenClaw compatibility must be checked in your own environment**, because SDK/runtime surfaces may differ across versions

### Quick start

#### 1. Install the plugin

```bash
openclaw plugins install ./migpt-claw-1.0.0.tgz
```

#### 2. Configure account and devices

Edit `~/.openclaw/openclaw.json`.

The example below shows only field structure and placeholders. **Do not** commit real passwords, tokens, `serviceToken`, or `ssecurity` values.

```json
{
  "channels": {
    "migpt": {
      "enabled": true,
      "userId": "123456789",
      "password": "<your-password>",
      "passToken": "<your-pass-token>",
      "devices": ["Living Room Speaker"],
      "speakerControl": "mina",
      "announceOnStart": true,
      "startupMessage": "Your lobster assistant is online.",
      "acknowledgeOnReceive": true,
      "receiveMessage": "Got it, processing now."
    }
  }
}
```

Field notes:

- `userId`: Xiaomi account ID
- `password`: Xiaomi account password
- `passToken`: auxiliary login credential; the field name may appear, but real values should stay private
- `devices`: target XiaoAI speaker names, matching the Mi Home app exactly
- `speakerControl`: `mina` or `miot`
- `announceOnStart`: whether to speak a startup message
- `startupMessage`: startup TTS text
- `acknowledgeOnReceive`: whether to acknowledge an incoming message
- `receiveMessage`: acknowledgement text

#### 3. Choose the speaker control path

`speakerControl` selects the communication path:

- `mina`: default path for many speaker models
- `miot`: an alternative path worth trying on some models or scenarios

Models sometimes reported as more likely to need `miot` include:

- LX04 (XiaoAI Speaker Pro)
- X10A (XiaoAI Speaker X10)
- L05B / L05C (XiaoAI Speaker Play Enhanced)

That is **not** a complete compatibility claim. For broader upstream experience, see MiGPT compatibility notes:
<https://github.com/idootop/mi-gpt/blob/main/docs/compatibility.md>

#### 4. Build / load in OpenClaw

Load the plugin according to your own OpenClaw environment. For local development, you will usually at least need:

```bash
npm run build
```

> `openclaw gateway restart` is an environment operation, not a universal one-line instruction that should be assumed from this README alone. Use whatever lifecycle flow matches your OpenClaw version and setup.

### Device naming

Device names must match the Mi Home app exactly, including:

- letter case,
- spaces,
- punctuation,
- and easy-to-mix wording differences.

If a device cannot be found, enable debugging temporarily and inspect the enumerated device list before adjusting config.

### Output constraints for speaker use

This project assumes that voice playback is not a suitable carrier for every kind of content.

Good fit for playback:

- short confirmations,
- short Q&A,
- status reminders,
- concise summaries.

Poor fit for direct playback:

- code,
- long-form documents,
- large structured data,
- link-heavy or media-heavy bundles.

So the speaker is treated as a **constrained output channel**, not a full general-purpose UI.

### Troubleshooting

#### Login failures / captcha-like auth issues

Common causes include:

- expired auth state,
- extra verification required,
- or a mistaken assumption that `passToken` fully replaces the password.

Suggested checks:

1. verify `userId` / `password`,
2. treat `passToken` as an auxiliary credential rather than a guaranteed password replacement,
3. inspect local `.mi.json` cache state if auth looks stale,
4. keep field names like `serviceToken` and `ssecurity` out of sensitive disclosures unless you are only referring to schema structure.

#### Device not found

Suggested checks:

1. make sure the speaker name exactly matches Mi Home,
2. try switching `speakerControl` between `mina` and `miot`,
3. inspect debug logs for enumerated device identifiers and names.

#### Conversation polling issues

If the `getConversations` path fails, check:

1. network state,
2. Xiaomi-side API behavior changes,
3. auth/risk-control issues,
4. whether the current account/device really exposes readable XiaoAI conversation history.

### Repository layout

```text
migpt-claw/
├── index.ts                 # plugin entry
├── src/
│   ├── channel.ts           # channel core
│   ├── service.ts           # auth and service wiring
│   ├── message.ts           # conversation polling
│   ├── speaker.ts           # TTS / playback control
│   ├── config.ts            # config parsing
│   ├── outbound.ts          # outbound playback
│   ├── onboarding.ts        # setup wizard adapter
│   ├── runtime.ts           # OpenClaw runtime bridge
│   ├── mi/
│   │   ├── account.ts       # Xiaomi account login chain
│   │   ├── common.ts        # shared Xiaomi service logic
│   │   ├── mina.ts          # MiNA API path
│   │   ├── miot.ts          # MIoT API path
│   │   └── typing.ts        # Xiaomi-side typings
│   └── utils/
│       ├── http.ts
│       ├── codec.ts
│       ├── hash.ts
│       ├── io.ts
│       └── parse.ts
└── skills/
    └── migpt-volume/
        ├── index.ts
        └── SKILL.md
```

### Development

```bash
npm install
npm run build
npm pack --dry-run
```

### Credits

Thanks to the following projects and implementation ideas:

- **[MiGPT](https://github.com/idootop/mi-gpt)**
- **[MiGPT Next](https://github.com/idootop/migpt-next)**
- **[MiService](https://github.com/yihong0618/MiService)**
- **OpenClaw Plugin / Channel runtime**

### Sources / Architecture Notes

The boundaries described in this README are grounded in the following related chains and sources:

- **MiNA / MIoT / XiaoAI conversation history chain** for speaker control, device access, and conversation polling
- **in-repo skill: `skills/migpt-volume`** as the clearest bundled skill dependency/example
- **MiMo warm brief scripts** as related ideas or adjacent scripts, not default built-in capabilities
- **Related external workflow / To verify**: `xiaomi-mimo-tts`, `mimo-tts-feishu-audio`

If you reference these in docs, demos, or downstream packaging, keep the “related / to verify” boundary explicit instead of presenting them as confirmed first-class features of this repository.

### Skill Dependencies

The only clearly visible skill dependency / association inside this repository is:

- `skills/migpt-volume`

Anything else you compose in your own OpenClaw deployment belongs to your environment-level orchestration, not this repo by default.

### AI-Assisted Development

Repository history includes AI-assisted implementation traces. That is process metadata, not an extra promise of stability, compatibility, or official support.

### License

MIT

### Disclaimer

This project is intended for learning, research, and personal experimentation.

- Follow your local laws and Xiaomi-related terms of service
- This project is not officially affiliated with Xiaomi and does not imply official support
- It may carry account, device, API compatibility, and risk-control risks
- Prefer test environments, test accounts, and non-critical devices
- The project is provided on an “as is” basis, with no guarantee of availability, stability, continuity, or device coverage

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=violin321/migpt-claw&type=Date)](https://www.star-history.com/#violin321/migpt-claw&Date)
