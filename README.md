# migpt-claw

> Turn Xiaomi XiaoAI speakers into OpenClaw’s home voice entrypoint and playback endpoint.
>
> 把小爱音箱接入 OpenClaw，作为家庭语音入口、播报终端与手动语音工作流桥接器。

**Status:** usable for controlled text-to-speaker playback and wake-word-based routing; the full inbound conversational loop is still under verification.

## Overview

`migpt-claw` is an OpenClaw channel plugin that connects Xiaomi XiaoAI speakers to the OpenClaw runtime.

It is intended to do three things:

1. Let OpenClaw **play text replies on a XiaoAI speaker**.
2. Let a XiaoAI interaction **optionally route into OpenClaw** when a configured `wakeWord` is detected in conversation history.
3. Provide a **manual warm morning brief workflow** that rewrites a text brief into spoken audio and plays it on a speaker through MiNA URL playback.

What it is:

- an OpenClaw plugin/channel runtime integration
- a wake-word-based bridge between XiaoAI conversation history and OpenClaw
- a practical speaker playback endpoint for home voice workflows

What it is not:

- not a full replacement for XiaoAI
- not an officially supported Xiaomi or OpenClaw integration
- not a guarantee of stable real-time interruption, zero-delay routing, or long-running unattended reliability
- not an automatic cron-based morning brief system

## Features

### Implemented

- OpenClaw → XiaoAI speaker text playback
- wake-word routing based on XiaoAI conversation history polling
- non-matching queries continue through native XiaoAI handling
- selectable speaker control path: `mina` or `miot`
- long-text **chunked playback** for text replies
- startup announcement control via `announceOnStart`
- receive acknowledgement control via `acknowledgeOnReceive`
- manual warm morning brief playback workflow
- bundled repository skill: `skills/migpt-volume`

### Experimental

- full inbound → OpenClaw → speaker conversational loop stability
- native XiaoAI reply interruption / overlap reduction
- public URL audio playback compatibility across devices and networks
- multi-device long-running reliability

### Not in scope

- replacing XiaoAI’s native smart home or assistant stack
- claiming uniform behavior across all Xiaomi speaker models
- promising full token-level streaming or system-level voice interception

## How it works

### 1. Voice inbound

`User → XiaoAI wake → XiaoAI history polling → wakeWord filter → OpenClaw`

The plugin polls XiaoAI conversation history through the MiNA conversation chain. If a new query contains the configured `wakeWord`, that word is removed and the remaining text is forwarded to OpenClaw.

If the query does **not** contain the `wakeWord`, it stays on the native XiaoAI path.

### 2. Voice outbound

`OpenClaw reply → migpt-claw → MiNA / MIoT → XiaoAI speaker playback`

Outbound text replies are sent through the plugin and played on the configured speaker. For longer text, the current implementation splits the message into chunks and plays them sequentially.

This is **not** token streaming. It is best understood as long-text chunked playback.

### 3. Manual warm morning brief

`Brief text → MiMo TTS rewrite/audio → temp public URL → MiNA player_play_url → speaker`

The repository includes a manual workflow that:

1. rewrites a morning brief into a warm spoken script,
2. generates WAV audio with MiMo TTS,
3. exposes the audio through a temporary HTTP URL,
4. calls MiNA `player_play_url` to play it on a XiaoAI speaker.

This workflow is manual by design and does **not** install or attach cron automatically.

## Quick start

### 1. Install dependencies and build

Run from this repository:

```bash
npm install
npm run build
```

Optional verification commands already used in local validation notes:

```bash
npx tsc --noEmit
node scripts/check-announce-on-start-merge.mjs
npm pack
```

### 2. Pack and install the plugin

```bash
npm pack
openclaw plugins install ./migpt-claw-1.0.0.tgz --force
openclaw config validate
```

After installation or upgrade, a **process-level** Gateway restart is required so the runtime loads the new plugin code.

### 3. Minimal configuration

Add a `channels.migpt` section to your OpenClaw config:

```json
{
  "channels": {
    "migpt": {
      "enabled": true,
      "userId": "123456789",
      "password": "your_xiaomi_password",
      "passToken": "your_xiaomi_pass_token",
      "devices": ["客厅音箱"],
      "wakeWord": "小龙虾",
      "announceOnStart": false,
      "acknowledgeOnReceive": false
    }
  }
}
```

Notes:

- `devices` should match the Xiaomi / Mi Home device name exactly.
- The schema accepts `passToken`, but current runtime paths should still be described cautiously; see [Configuration](#configuration).
- If you are testing inbound routing, start with one device only.

### 4. First playback test

Use OpenClaw to send a text message to the speaker:

```bash
openclaw message send \
  --channel migpt \
  --target "客厅音箱" \
  --message "OpenClaw 小爱播报测试"
```

Optional dry run:

```bash
openclaw message send \
  --channel migpt \
  --target "客厅音箱" \
  --message "OpenClaw 小爱 dry run 测试" \
  --dry-run
```

### 5. First inbound routing test

Say a phrase that includes the configured wake word, for example:

> 小爱同学，小龙虾，帮我问今天有什么安排

Expected behavior:

- native XiaoAI wake still happens first;
- `migpt-claw` later sees the query through polling;
- only messages containing `wakeWord` are forwarded to OpenClaw;
- the forwarded payload excludes the `wakeWord` itself.

Because this path depends on conversation polling, response timing is affected by `heartbeat`.

## Configuration

### Required

- `userId`: Xiaomi account ID
- `devices`: speaker names
- `password` and/or `passToken`: see credential notes below

### Recommended

- `wakeWord`: strongly recommended so ordinary XiaoAI usage does not all route into OpenClaw
- `speakerControl`: `mina` by default; try `miot` on devices that behave better through that path
- `heartbeat`: controls conversation polling interval in milliseconds
- `announceOnStart`: usually start with `false` during setup
- `acknowledgeOnReceive`: usually start with `false` during setup
- `receiveMessage`: only relevant when `acknowledgeOnReceive` is enabled

### Advanced

- `systemPrompt`: voice-scene behavior hints for the agent side
- `startupMessage`: startup announcement content
- account-level overrides through `channels.migpt.accounts`
- outbound chunking-related behavior comes from current runtime defaults (`streaming` / `textChunkLimit` in code paths), but these are not yet cleanly documented as stable user-facing knobs

### Credential notes: `password` / `passToken`

Be careful here:

- the config schema and setup validation allow either `passToken` or `password`
- some README history implied `passToken` could replace `password`
- however, current repository runtime and helper scripts still contain paths that require or expect `userId + password`, especially for MiNA login and the manual morning brief player

Practical guidance:

- treat `passToken` as a sensitive auxiliary credential, not a guaranteed complete replacement for password
- assume Xiaomi login behavior may vary and captcha / token expiry can still happen
- document examples with placeholders only; never commit real credentials

### Key options

| Option | What it does | Notes |
|---|---|---|
| `wakeWord` | Routes only matching queries into OpenClaw | Empty means more native queries may enter OpenClaw |
| `speakerControl` | Chooses `mina` or `miot` for playback/control | Device-dependent behavior |
| `heartbeat` | Poll interval for XiaoAI history | Lower can feel faster, but is still polling |
| `announceOnStart` | Plays startup message after init | Recommended off for early testing |
| `acknowledgeOnReceive` | Plays a short acknowledgement before reply handling | Can increase overlap/noise during testing |
| `receiveMessage` | Text used for acknowledgement playback | Used only if acknowledgement is enabled |
| `password` / `passToken` | Xiaomi auth inputs | Sensitive; runtime expectations still need care |

## Wake word routing

Current routing behavior is based on the code in `src/channel.ts` and `src/message.ts`:

- only messages containing `wakeWord` are forwarded to OpenClaw
- non-matching queries stay on the native XiaoAI path
- if the utterance is only the wake word and has no remaining body, it is ignored
- if `wakeWord` appears at the start, it is removed before forwarding
- if `wakeWord` appears in the middle, the current logic removes that occurrence and forwards the rest
- routing delay depends on history polling and therefore on `heartbeat`

This is a polling bridge, not a system-level intercept.

## Native reply interruption / duplicate playback reduction

To reduce the “XiaoAI answers once, then OpenClaw answers again” effect, the plugin currently does a best-effort interruption attempt before acknowledgement or reply playback.

The relevant path calls:

- `abortXiaoAI()`
- `stop()`

This should be read narrowly:

- it is an overlap-reduction attempt,
- it is **not** a promise of reliable native reply interruption on every device,
- behavior may differ by model, timing, and whether MiNA / MIoT control succeeds at that moment.

## Manual warm morning brief TTS

This repository keeps a **manual** warm morning brief workflow. It is useful when you want a one-shot spoken morning brief on a XiaoAI speaker without wiring it into cron.

### Included scripts

- `scripts/morning-brief-warm-tts.py`
- `scripts/play-morning-brief-warm.mjs`
- `scripts/run-morning-brief-warm.sh`

### What the workflow does

- reads a source brief text file
- rewrites it into a warmer spoken script with MiMo TTS prompting
- saves raw and normalized WAV output
- serves the WAV through a temporary HTTP endpoint
- asks MiNA to play that public URL on the target speaker

### Requirements

- `python3`
- Python `requests`
- `ffmpeg`
- `node`
- repository already built with `npm run build`
- MiMo API key available through env or a local credentials file
- a URL that is publicly reachable by the target playback path

### One-command manual trigger

```bash
bash scripts/run-morning-brief-warm.sh /path/to/morning-brief.txt
```

With an explicit speaker name:

```bash
bash scripts/run-morning-brief-warm.sh /path/to/morning-brief.txt "客厅音箱"
```

### Helpful checks

```bash
python3 scripts/morning-brief-warm-tts.py --help
node scripts/play-morning-brief-warm.mjs --help
bash scripts/run-morning-brief-warm.sh --help
```

### Important boundaries

- manual trigger only
- no cron is installed or configured automatically
- no OpenClaw config is rewritten by these scripts
- public URL playback means the audio resource may be exposed while it is being served

## Troubleshooting

### Login / captcha issues

If Xiaomi login triggers captcha or inconsistent auth behavior:

- retry carefully with a test account
- re-check whether your current runtime path expects `password`
- do not assume `passToken` alone will always be enough

### `password` / `passToken` confusion

If one setup path appears to accept `passToken` but another fails:

- check the actual script or runtime path you are using
- the manual `play-morning-brief-warm.mjs` path explicitly requires `userId` and `password`
- some plugin schema/setup messaging is looser than current runtime reality

### Device name mismatch

If a speaker cannot be found:

- verify the device name exactly as shown in the Xiaomi app
- avoid local nicknames that do not exist in Xiaomi/Mi Home
- test with a single device first

### URL does not play

If `player_play_url` succeeds poorly or the speaker stays silent:

- verify the URL is publicly reachable
- verify the file is in a compatible format, ideally normalized WAV as used by the included script
- verify temporary HTTP port exposure and routing
- expect differences across devices

### Polling feels slow

Inbound routing is not instantaneous. If it feels delayed:

- check `heartbeat`
- remember this is conversation history polling, not direct voice interception

### Token / session expiry

If previously working auth stops working:

- Xiaomi-side tokens may have expired
- re-login may be needed
- cached account/session behavior may differ by path

### Multi-device differences

If one device behaves differently from another:

- that is expected for now
- compare `speakerControl` mode and model behavior
- keep claims conservative until you validate your own hardware

## Roadmap

### Current

- OpenClaw text-to-speaker playback
- wake-word routing through conversation polling
- native XiaoAI fallback for non-wake-word queries
- MiNA / MIoT selection
- long-text chunked playback
- startup / acknowledgement playback controls
- manual warm morning brief playback workflow

### Next

- setup / onboarding cleanup
- diagnostics and logging improvements
- device compatibility matrix
- clearer workflow documentation
- `passToken` / `password` documentation cleanup

### Future

- more stable interruption strategy
- home voice workflow examples
- richer skill / workflow integration
- multi-device orchestration

## Credits / Sources

This repository sits on top of several upstream ideas and runtime layers.

### Confirmed references in this repo

- **MiGPT / MiGPT Next** — inspiration and direction for connecting XiaoAI speakers with LLM-style workflows
- **MiService** — Xiaomi auth, MiNA, and MIoT reference chain used by this implementation
- **OpenClaw Plugin / Channel runtime** — host runtime and plugin interface used by `migpt-claw`
- **MiNA / MIoT / XiaoAI conversation history chain** — technical path used for playback, device control, and inbound polling

### Repository-level provenance notes

- `openclaw.plugin.json` defines the plugin metadata, schema, and `activation.onStartup`
- `src/channel.ts` contains polling, wake-word filtering, and inbound dispatch logic
- `src/outbound.ts` contains text/media outbound behavior and chunked playback logic
- `scripts/` contains the manual MiMo TTS → URL → MiNA playback workflow

## Skill Dependencies / Related Workflows

| Item | Status | Notes |
|---|---|---|
| OpenClaw plugin/channel runtime | Confirmed | Host runtime and plugin API used by this repository |
| `skills/migpt-volume` | Confirmed | Bundled repo skill present under `skills/migpt-volume` |
| MiMo TTS warm brief scripts | Confirmed | `scripts/morning-brief-warm-tts.py`, `play-morning-brief-warm.mjs`, `run-morning-brief-warm.sh` |
| `xiaomi-mimo-tts` skill | Related external workflow / To verify | Mentioned as related workflow lineage only; not confirmed inside this repo |
| `mimo-tts-feishu-audio` | Related external workflow / To verify | Related workflow reference; not confirmed inside this repo |
| 内部温柔晨报链路 | Deployment/workflow provenance / To verify | Operational lineage, not a confirmed repo dependency |

## Security / Privacy

- never commit Xiaomi credentials, `passToken`, `serviceToken`, or MiMo API keys
- XiaoAI conversation history polling has privacy implications: voice queries visible to that history path may be processed by this plugin when routing conditions match
- public URL playback for the manual brief workflow means the served audio may be exposed to anyone who can reach that temporary URL during its lifetime
- prefer a test account / least-exposure setup for integration and validation
- protect OpenClaw config files, backups, and logs because they may contain sensitive operational data

## License

MIT
