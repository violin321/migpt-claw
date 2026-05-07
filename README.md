# migpt-claw

## OpenClaw 2026.5.4 适配状态（violin321 fork）

> 本 fork 已针对 **OpenClaw 2026.5.4** 做兼容适配，并完成一次受控本地验证。

### 已包含的适配

- OpenClaw 2026.5.4 plugin SDK 子路径 import 适配。
- ChannelPlugin runtime / inbound / outbound / setup / status API 适配。
- `openclaw.plugin.json#channelConfigs`，用于让 `channels.migpt` 通过 OpenClaw config schema 校验。
- `activation.onStartup=true`，用于让 Gateway 进程级启动时加载 MiGPT channel。
- 修复 `announceOnStart=false` 在 outbound 初始化时丢失、仍播启动语的问题。

### 本地已验证

- `npx tsc --noEmit` ✅
- `npm run build` ✅
- 静态 import `./dist/index.js` ✅
- `node scripts/check-announce-on-start-merge.mjs` ✅
- `npm pack` ✅
- Gateway runtime 启动后包含 `migpt-claw` ✅
- `openclaw channels status` 显示 `MiGPT default ... running, connected` ✅
- OpenClaw → 小爱音箱文本播报 ✅
- `announceOnStart=false` 不再额外播启动语 ✅

### 尚未充分验证

- 小爱语音 inbound → OpenClaw → 小爱回复的完整对话链路。
- 外部 TTS 音频 URL 经小爱音箱播放。
- 多设备同时启用与长期轮询稳定性。

### 最近一次本地打包产物

```text
migpt-claw-1.0.0.tgz
sha256: cdb6299a956879d244df5275aba3c1b6bb45d506aa9095cc7c957b7e3075d8ea
```

更多可追溯信息见：[`OPENCLAW_PATCHED_BUILD.md`](./OPENCLAW_PATCHED_BUILD.md)。


小米小爱音箱 OpenClaw Channel 插件，让小爱音箱成为你的 🦞龙虾 语音助手。

## 功能特性

- 🎤 **语音对话** - 对小爱音箱说话，🦞 语音回复
- 📦 **流式输出** - 长文本分块播放，降低延迟
- 🎯 **智能分流** - 长内容/代码/多媒体自动引导至其他渠道
- 🔔 **状态提示** - 支持启动播报和收到消息提示音

## 快速开始


### 0. 从本 fork 构建并安装（OpenClaw 2026.5.4 推荐）

```bash
npm install
npm run build
node scripts/check-announce-on-start-merge.mjs
npm pack
openclaw plugins install ./migpt-claw-1.0.0.tgz --force
openclaw config validate
openclaw gateway restart
```

注意：安装或更新插件后，需要一次**进程级** `openclaw gateway restart` 才能让 Gateway runtime 加载新插件代码。

### 1. 安装插件

```bash
# 本地安装
openclaw plugins install ./migpt-claw-1.0.0.tgz
```

### 2. 配置账号

编辑 `~/.openclaw/openclaw.json` 配置文件：

**推荐配置（密码 + passToken）**：

```json
{
  "channels": {
    "migpt": {
      "enabled": true,
      "userId": "123456789",
      "password": "your_password",
      "passToken": "your_pass_token",
      "devices": ["客厅音箱"],
      "announceOnStart": true,
      "startupMessage": "您的小龙虾已上线，随时为您服务",
      "acknowledgeOnReceive": true,
      "receiveMessage": "收到，处理中"
    }
  }
}
```

**配置说明**：
- `userId`：小米 ID（数字，在小米账号「个人信息」-「小米 ID」查看）
- `password`：小米账号密码
- `passToken`：登录辅助凭证，避免验证码（推荐配置）
- `devices`：小爱音箱设备名称列表
- `announceOnStart`：启动时是否播报上线文案
- `startupMessage`：上线播报文案
- `acknowledgeOnReceive`：收到消息时是否回复提示
- `receiveMessage`：收到消息回复文案
- `speakerControl`：音箱控制方式（`mina` 或 `miot`，默认 `mina`）

**配置建议（受控测试）**：
- 先只配置一个设备，确认稳定后再加多设备。
- `devices` 必须使用米家 App 中显示的真实设备名，例如 `客厅`，不要使用自己临时想的昵称。
- 建议先设置 `announceOnStart: false`，避免 Gateway/插件初始化时突然播报上线文案。
- 建议先设置 `acknowledgeOnReceive: false`，避免 inbound 测试时多播提示语。


### 音箱控制方式说明

**`speakerControl`**：指定与小爱音箱通信的控制方式

- **`mina`**（默认）：使用 MiNA API，适用于大多数小爱音箱型号
- **`miot`**：使用 MIoT API，适用于部分需要特殊控制的型号

**已知需要 `miot` 的型号**：
- LX04（小爱音箱 Pro）
- X10A（小爱音箱 X10）
- L05B / L05C（小爱音箱 Play 增强版）

**注意**：
- 不同型号的小爱音箱对 `mina` 和 `miot` 的支持情况可能不同
- 如果默认 `mina` 方式无法正常工作，请尝试切换为 `miot`
- 完整兼容性列表参考：[MiGPT 兼容性文档](https://github.com/idootop/mi-gpt/blob/main/docs/compatibility.md)
- 建议自行编译测试以确定您的设备最佳配置

**特别说明**：当前项目未对所有小爱音箱型号进行全面测试，以上型号支持情况仅供参考。由于小爱音箱型号众多，不同型号可能存在差异，建议用户根据自身设备型号自行编译测试。

**配置示例**：

```json
{
  "channels": {
    "migpt": {
      "userId": "123456789",
      "password": "your_password",
      "passToken": "your_pass_token",
      "devices": ["客厅音箱"],
      "speakerControl": "miot"
    }
  }
}
```

### 3. 启动服务

```bash
openclaw gateway restart
```


## 设备名称

设备名称必须与米家 App 中设置的名称**完全一致**（包括大小写和空格）。

如果不确定设备名称，可以：
1. 开启 `debug: true` 配置
2. 启动服务查看设备列表
3. 日志中会打印所有可用设备


## 使用方式与边界

### OpenClaw 主动播报到小爱

已验证链路：OpenClaw → MiGPT channel → 小爱音箱播报。

```bash
openclaw message send \
  --channel migpt \
  --target "客厅" \
  --message "OpenClaw 小爱播报测试"
```

如需只验证路由、不真实播报：

```bash
openclaw message send \
  --channel migpt \
  --target "客厅" \
  --message "OpenClaw 小爱 dry run 测试" \
  --dry-run
```

### 小爱语音对话 OpenClaw

设计目标是继续使用小爱原生唤醒词，例如：

> 小爱同学，帮我问 OpenClaw 今天有什么安排

插件会轮询小爱对话记录，并把符合条件的新 query 转给 OpenClaw，再将 OpenClaw 回复播回音箱。

当前此 inbound 链路尚未充分验证；建议先在单设备、短句、低风险场景下测试。

### 智能家居控制

本插件不会替换小爱系统，也不会主动接管米家智能家居控制。正常的：

> 小爱同学，打开客厅灯

仍应走小爱/米家原生链路。

但插件会读取小爱对话历史；某些普通 query 是否也会被 OpenClaw 看到，取决于小爱历史 API 返回内容和当前过滤逻辑，需要按设备实际验证。

### 播放外部 TTS 音频

代码支持 `MiSpeaker.play({ url })`，理论上可以播放一个小爱可访问的音频 URL。

尚未充分验证：
- 支持哪些音频格式；
- URL 是否必须公网可访问；
- 局域网 HTTP URL 是否稳定；
- 飞书 file_key 等私有资源不能直接作为小爱播放 URL。

### 手动晨报：温柔拟人口吻 TTS → URL 播放到小爱（不接 cron）

这个仓库现在包含一条**手动触发**链路，用于把晨报文本改写成温柔口播稿，经 MiMo TTS 生成 wav、转成 16k mono，再通过公网 HTTP URL 交给 MiNA `player_play_url` 播放到小爱音箱。

> 说明：这是**手动工具链**，**不会自动接 cron**，也**不会改 OpenClaw 配置**。

#### 新增脚本

- `scripts/morning-brief-warm-tts.py`
  - 读取晨报文本
  - 调用 `https://api.xiaomimimo.com/v1/chat/completions`
  - 使用 `mimo-v2-tts` + `mimo_default`
  - 输出 raw wav + 16k mono wav + 改写后的口播文本
- `scripts/play-morning-brief-warm.mjs`
  - 读取 `~/.openclaw/openclaw.json` 中的 `channels.migpt`
  - 仅打印 `hasPassword/hasPassToken`，不打印敏感值
  - 在本地起一个单文件临时 HTTP 服务
  - 调用 MiNA `player_play_url` 播放公网 URL
- `scripts/run-morning-brief-warm.sh`
  - 一条命令串起 TTS、转码、临时托管、播放

#### 凭据读取规则

**MiMo API key**：

优先读取环境变量：
- `XIAOMI_API_KEY`
- `MIMO_API_KEY`

否则回退读取：
- `/root/.openclaw/workspace/.credentials/xiaomi-api.txt`

**小爱 / MiNA 登录信息**：

从 `~/.openclaw/openclaw.json` 的 `channels.migpt` 读取：
- `userId`
- `password`
- `passToken`
- `devices`
- `speakerControl`

日志不会打印密码或 token 正文。

#### 依赖

需要本机有：
- `python3`
- Python `requests`
- `ffmpeg`
- `node`
- 已执行过 `npm install && npm run build`

#### 最简手动命令

```bash
cd /root/.openclaw/workspace/repos/migpt-claw
bash scripts/run-morning-brief-warm.sh /path/to/morning-brief.txt
```

如需指定音箱名：

```bash
cd /root/.openclaw/workspace/repos/migpt-claw
bash scripts/run-morning-brief-warm.sh /path/to/morning-brief.txt "客厅"
```

也可以分步执行：

```bash
python3 scripts/morning-brief-warm-tts.py \
  --input /path/to/morning-brief.txt \
  --spoken-text-out /tmp/morning-brief-warm.txt \
  --wav-out /tmp/morning-brief-warm-16k.wav

node scripts/play-morning-brief-warm.mjs \
  --file /tmp/morning-brief-warm-16k.wav \
  --device "客厅"
```

#### 常用环境变量

- `MORNING_BRIEF_DEVICE`：覆盖默认音箱名
- `MORNING_BRIEF_PUBLIC_HOST`：公网主机/IP，默认 `185.194.141.235`
- `MORNING_BRIEF_HTTP_PORT`：临时 HTTP 端口，默认 `18888`
- `MORNING_BRIEF_HTTP_HOST`：临时 HTTP 绑定地址，默认 `0.0.0.0`
- `MORNING_BRIEF_HTTP_DIR`：允许托管的目录，默认 `/tmp`
- `MORNING_BRIEF_WAV_OUT`：转码后 wav 输出路径
- `MORNING_BRIEF_SPOKEN_TEXT_OUT`：改写后口播稿输出路径

#### dry-run / 帮助检查

```bash
python3 scripts/morning-brief-warm-tts.py --help
node scripts/play-morning-brief-warm.mjs --help
node scripts/play-morning-brief-warm.mjs --file /tmp/morning-brief-warm-16k.wav --dry-run
bash scripts/run-morning-brief-warm.sh --help
```

#### 排错要点

- `Missing MiMo API key`
  - 先检查 `XIAOMI_API_KEY` / `MIMO_API_KEY`
  - 再检查 `/root/.openclaw/workspace/.credentials/xiaomi-api.txt`
- `channels.migpt not found`
  - 检查 `~/.openclaw/openclaw.json`
- `requires userId and password`
  - 当前 MiNA 登录仍要求 `userId + password`，`passToken` 仅作辅助凭证
- 小爱不播放 URL
  - 确认公网主机/IP 可从外部访问
  - 确认端口已放行
  - 确认输出是 `16k mono wav`
  - 确认音箱设备名和 `channels.migpt.devices` 一致
- 端口冲突
  - 改 `MORNING_BRIEF_HTTP_PORT` 或 `--http-port`

#### 边界

- **不会**自动创建 cron
- **不会**写入真实密钥到仓库
- **不会**修改 `~/.openclaw/openclaw.json`
- **不会**在日志里输出密码、token、API key 正文

## 使用技能

### 播报规范

插件内置智能播报规范，AI 会自动判断内容是否适合语音播报：

- ✅ **适合播报**：简短回复、确认信息、简单问答
- ❌ **不适合播报**：代码、长文、数据、多媒体内容

对于不适合播报的内容，AI 会告知用户已通过其他渠道（如微信、邮件等）发送。

## 故障排查

### 登录失败

**错误**: `❌ 本次登录需要验证码，请使用 passToken 重新登录`

**解决**: 使用 passToken 替代密码登录，或尝试多次登录直到不需要验证码

### 设备未找到

**错误**: `❌ 找不到设备：客厅音箱`

**解决**:
1. 检查设备名称是否与米家 App 中完全一致
2. 开启 `debug: true` 查看可用设备列表
3. 注意错别字，如「音响」vs「音箱」

### 消息轮询失败

**错误**: `❌ getConversations failed`

**解决**:
1. 检查网络连接
2. 检查 serviceToken 是否过期
3. 删除 `.mi.json` 缓存文件重新登录

## 项目结构

```
migpt-claw/
├── index.ts                 # 插件入口
├── src/
│   ├── channel.ts          # Channel 核心
│   ├── service.ts          # 认证服务
│   ├── message.ts          # 消息轮询
│   ├── speaker.ts          # TTS 播放
│   ├── config.ts           # 配置解析
│   ├── types.ts            # 类型定义
│   ├── outbound.ts         # 消息发送
│   ├── onboarding.ts       # 安装向导
│   ├── runtime.ts          # 运行时管理
│   ├── mi/                 # 小米服务
│   │   ├── mina.ts        # MiNA API
│   │   ├── miot.ts        # MIoT API
│   │   ├── account.ts     # 账号认证
│   │   ├── common.ts      # 通用工具
│   │   └── typing.ts      # 类型定义
│   └── utils/              # 工具函数
│       ├── http.ts        # HTTP 请求
│       ├── codec.ts       # 编解码
│       ├── hash.ts        # 哈希工具
│       ├── io.ts          # 文件 IO
│       └── parse.ts       # 解析工具
└── skills/
    └── migpt-volume/       # 音量控制技能
        ├── index.ts
        └── SKILL.md
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

```

## AI 辅助开发

本项目由 **Qwen Code** + **Qwen3.5-Plus** 大模型开发实现。

- **[Qwen Code](https://qwenlm.github.io/qwen-code-docs/zh/users/overview/)** - 阿里巴巴通义实验室推出的终端 AI 编程助手（CLI 工具）
- **[Qwen3.5-Plus](https://github.com/QwenLM/Qwen)** - 通义千问 3.5 增强版大模型，提供强大的代码理解和生成能力

感谢 AI 助手在代码编写、问题排查和文档撰写过程中提供的智能辅助！🤖

## 相关项目

本项目受到以下优秀项目的启发和帮助：

- **[MiGPT Next](https://github.com/idootop/migpt-next)** - 让小爱音箱接入 AI 大模型，实现智能对话
- **[MiService](https://github.com/yihong0618/MiService)** - 小米账号认证和米家设备控制基础库

向以上项目的作者致敬！🙏

## 开源协议

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## 安全提醒

- 不要把小米账号密码、`passToken`、`serviceToken` 写入 GitHub 仓库。
- 建议使用测试账号或非主账号做联调。
- 如果凭证曾经出现在聊天、日志或截图中，建议尽快轮换。
- `passToken` 是敏感凭证；本项目只应保存示例字段，不应提交真实值。
- Gateway 配置文件和备份可能包含敏感字段，请注意权限与备份流向。

## 免责声明

本项目仅供学习和研究使用，不得用于任何商业用途或非法目的。

- 使用本项目时，请遵守当地法律法规和小米公司的相关服务条款
- 本项目与小米公司无任何关联，不构成任何官方支持或背书
- 使用本项目可能导致小米账号异常，请谨慎使用并自行承担风险
- 建议仅使用测试账号或非主要账号进行体验
- 如因使用本项目造成的任何损失（包括但不限于账号封禁、数据丢失等），本项目作者不承担任何责任
- 本项目按「原样」提供，不提供任何明示或暗示的保证

如将本项目用于生产环境或其他重要场景，请务必：
1. 仔细阅读并遵守小米开放平台的相关规范
2. 通过官方渠道获取合法的 API 调用权限
3. 评估潜在的法律和技术风险
