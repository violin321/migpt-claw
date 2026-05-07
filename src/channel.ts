import type { ChannelPlugin, PluginRuntime } from 'openclaw/plugin-sdk/core';
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/core';
import { formatInboundEnvelope, resolveEnvelopeFormatOptions } from 'openclaw/plugin-sdk/channel-inbound';
import { dispatchReplyWithBufferedBlockDispatcher, finalizeInboundContext } from 'openclaw/plugin-sdk/reply-runtime';
import type { ResolvedMiAccount, ExtendedOpenClawConfig } from './types.js';
import {
  resolveMiAccount,
  listMiAccountIds,
  resolveDefaultMiAccountId,
  setMiAccountEnabled,
  deleteMiAccount,
  resolveMiAllowFrom,
  formatMiAllowFrom,
} from './config.js';
import { miOutbound } from './outbound.js';
import { MiService } from './service.js';
import { MiMessage } from './message.js';
import { sleep } from './utils/parse.js';
import { Debugger } from './utils/debug.js';
import { MiSpeaker } from './speaker.js';
import { getMiGPTRuntime } from './runtime.js';

const meta = {
  id: 'migpt',
  label: 'MiGPT',
  selectionLabel: '小米音箱 (MiGPT)',
  docsPath: '/channels/migpt',
  docsLabel: 'migpt',
  blurb: '小米小爱音箱语音对话。',
  aliases: ['xiaomi', 'mico'],
  order: 60,
};

export const miGPTPlugin: ChannelPlugin<ResolvedMiAccount> = {
  id: 'migpt',
  meta: {
    ...meta,
  },
  capabilities: {
    chatTypes: ['direct'],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ['channels.migpt'] },

  // 2026.5.4 的 agentPrompt 适配为提示/能力描述，而非可写配置面
  agentPrompt: {
    inboundFormattingHints: () => ({
      text_markup: 'plain',
      rules: [
        '回复要适合语音播报，优先短句和口语化表达。',
        '避免 URL、代码块、表格和复杂格式。',
        '内容过长时先给简短结论，再提示切换到其他渠道查看详情。',
      ],
    }),
    messageToolCapabilities: () => ['supports_tts_playback'],
  },

  config: {
    listAccountIds: (cfg) => listMiAccountIds(cfg as ExtendedOpenClawConfig),
    resolveAccount: (cfg, accountId) =>
      resolveMiAccount(cfg as ExtendedOpenClawConfig, accountId ?? undefined),
    defaultAccountId: (cfg) => resolveDefaultMiAccountId(cfg as ExtendedOpenClawConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setMiAccountEnabled(cfg as ExtendedOpenClawConfig, accountId, enabled),
    deleteAccount: ({ cfg, accountId }) =>
      deleteMiAccount(cfg as ExtendedOpenClawConfig, accountId),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      devices: account.devices,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      resolveMiAllowFrom(cfg as ExtendedOpenClawConfig, accountId ?? undefined),
    formatAllowFrom: ({ cfg, accountId, allowFrom }) =>
      formatMiAllowFrom(
        resolveMiAllowFrom(cfg as ExtendedOpenClawConfig, accountId ?? undefined, allowFrom),
      ),
  },

  setup: {
    resolveAccountId: ({ accountId }: { accountId?: string }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg, accountId, input }: { cfg: any; accountId?: string; input: any }) => {
      const migptCfg = cfg.channels?.migpt ?? {};
      const accountConfig = {
        userId: input.userId,
        password: input.password,
        passToken: input.passToken,
        devices: input.devices,
        enabled: true,
      };

      const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            migpt: {
              ...migptCfg,
              ...accountConfig,
            },
          },
        } as ExtendedOpenClawConfig;
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          migpt: {
            ...migptCfg,
            accounts: {
              ...migptCfg.accounts,
              [accountId]: accountConfig,
            },
          },
        },
      } as ExtendedOpenClawConfig;
    },
    validateInput: ({ input }: { input: any }) => {
      if (!input.userId) {
        return '小米 ID (userId) 是必需的';
      }
      if (!input.passToken && !input.password) {
        return '需要提供 passToken 或 password';
      }
      return null;
    },
  },

  messaging: {
    normalizeTarget: (raw: string) => {
      const normalized = raw.replace(/^migpt:/i, '').trim();
      return normalized || undefined;
    },
    targetResolver: {
      looksLikeId: (raw: string, normalized?: string): boolean => {
        const candidate = normalized ?? raw;
        return candidate.length > 0 && candidate.length < 100;
      },
      hint: 'MiGPT 目标格式：设备名称（如：客厅音箱）',
    },
  },

  outbound: miOutbound,

  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal, log, cfg } = ctx;

      log?.info(`[migpt:${account.accountId}] Starting gateway`);

      if (!account.configured) {
        log?.error(`[migpt:${account.accountId}] Account not configured`);
        return;
      }

      const devices = account.devices;
      if (devices.length === 0) {
        log?.error(`[migpt:${account.accountId}] No devices configured`);
        return;
      }

      const pluginRuntime = getMiGPTRuntime();
      const channelRuntime = (ctx.channelRuntime ?? createChannelRuntimeFallback(pluginRuntime)) as any;

      const devicePromises = devices.map(async (deviceName: string) => {
        log?.info(`[migpt:${account.accountId}] Starting poller for device: ${deviceName}`);

        const initSuccess = await MiService.init({
          ...account.config,
          announceOnStart: account.config.announceOnStart ?? cfg.channels?.migpt?.announceOnStart,
          startupMessage: account.config.startupMessage ?? cfg.channels?.migpt?.startupMessage,
        }, deviceName);
        if (!initSuccess) {
          log?.error(`[migpt:${account.accountId}] Failed to initialize device: ${deviceName}`);
          return;
        }

        Debugger.debug = account.config.debug ?? false;

        ctx.setStatus({
          ...ctx.getStatus(),
          running: true,
          connected: true,
          lastConnectedAt: Date.now(),
        });

        const heartbeat = cfg.channels?.migpt?.heartbeat ?? 1000;

        while (!abortSignal.aborted) {
          try {
            const msg = await MiMessage.fetchNextMessage(deviceName);
            if (msg) {
              log?.info(`[migpt:${account.accountId}] Received message from ${deviceName}: ${msg.text.slice(0, 50)}...`);

              // 唤醒词过滤
              const wakeWord = account.config.wakeWord ?? cfg.channels?.migpt?.wakeWord;
              if (wakeWord) {
                const trimmed = msg.text.trim();
                if (!trimmed.includes(wakeWord)) {
                  continue;
                }

                const cleaned = trimmed.startsWith(wakeWord)
                  ? trimmed.slice(wakeWord.length).trim()
                  : trimmed.replace(wakeWord, '').trim();

                if (!cleaned) {
                  continue;
                }

                msg.text = cleaned;
              }

              // 无论 acknowledgeOnReceive 如何，OpenClaw 回播前先打断设备上正在播的内容
              try {
                MiSpeaker.abortXiaoAI();
                MiSpeaker.stop();
              } catch {
                // best-effort
              }

              const acknowledgeOnReceive = account.config.acknowledgeOnReceive
                ?? cfg.channels?.migpt?.acknowledgeOnReceive ?? false;

              if (acknowledgeOnReceive) {
                const receiveMessage = account.config.receiveMessage
                  ?? cfg.channels?.migpt?.receiveMessage
                  ?? '收到，处理中';

                try {
                  MiSpeaker.play({ text: receiveMessage });
                } catch (err) {
                  log?.error(`[migpt:${account.accountId}] Failed to play receive message: ${err}`);
                }
              }

              pluginRuntime.channel.activity.record({
                channel: 'migpt',
                accountId: account.accountId,
                direction: 'inbound',
              });

              const fromAddress = `migpt:${deviceName}`;
              const toAddress = `migpt:${account.accountId}`;
              const route = channelRuntime.routing.resolveAgentRoute({
                cfg,
                channel: 'migpt',
                accountId: account.accountId,
                peer: { kind: 'direct', id: deviceName },
              });

              const systemPrompts: string[] = [];
              if (account.config.systemPrompt) {
                systemPrompts.push(account.config.systemPrompt);
              }
              const globalSystemPrompt = (cfg as ExtendedOpenClawConfig).channels?.migpt?.systemPrompt;
              if (globalSystemPrompt && globalSystemPrompt !== account.config.systemPrompt) {
                systemPrompts.push(globalSystemPrompt);
              }

              const envelopeOptions = channelRuntime.reply.resolveEnvelopeFormatOptions(cfg);
              const body = channelRuntime.reply.formatAgentEnvelope({
                channel: 'migpt',
                from: fromAddress,
                body: msg.text,
                timestamp: msg.timestamp,
                envelope: envelopeOptions,
              });

              const DEFAULT_SPEAKER_PROMPT = `【音箱播报规范 - 必须遵守】
你是一个智能音箱助手，通过语音与用户交流。请遵守以下规范：

📢 播报原则：
1. 简短优先：单次播报控制在 100 字以内，超过请拆分或改用其他渠道
2. 纯文字：只输出适合语音播报的纯文字，不要包含 URL、代码、复杂格式
3. 自然口语：使用简短、清晰的口语表达，避免长句和复杂结构

🚫 不适合播报的内容（应改用其他渠道）：
- 代码片段、技术文档
- 长篇文章、报告（>300 字）
- 复杂数据表格、列表
- 图片、视频、文件等多媒体内容
- URL 链接、邮箱地址

✅ 正确做法示例：
- 短回复："好的，已为你设置明天早上 8 点的闹钟"
- 长内容分流："由于内容较长，详细报告已发送到你的手机/微信，请查看"
- 代码场景："代码已生成并发送到你的邮箱，请注意查收"
- 多媒体场景："这张图片很有趣，已发送到你的手机查看"`;

              const contextInfo = `你正在通过小米音箱与用户对话。

【会话上下文】
- 设备：${deviceName}
- 用户：${deviceName}
- 消息 ID: ${deviceName}-${msg.timestamp}
- 当前时间：${new Date(msg.timestamp).toLocaleString('zh-CN')}`;

              const agentBody = systemPrompts.length > 0
                ? `${contextInfo}\n\n${systemPrompts.join("\n\n")}\n\n${msg.text}`
                : `${contextInfo}\n\n${DEFAULT_SPEAKER_PROMPT}\n\n${msg.text}`;

              const ctxPayload = finalizeInboundContext({
                Body: body,
                BodyForAgent: agentBody,
                RawBody: msg.text,
                CommandBody: msg.text,
                From: fromAddress,
                To: toAddress,
                SessionKey: route.sessionKey,
                AccountId: account.accountId,
                ChatType: 'direct',
                SenderId: deviceName,
                SenderName: deviceName,
                Provider: 'migpt',
                Surface: 'migpt',
                MessageSid: `${deviceName}-${msg.timestamp}`,
                Timestamp: msg.timestamp,
                OriginatingChannel: 'migpt',
                OriginatingTo: toAddress,
                CommandAuthorized: true,
              });

              await dispatchReplyWithBufferedBlockDispatcher({
                ctx: ctxPayload,
                cfg,
                dispatcherOptions: {
                  responsePrefix: '',
                  deliver: async (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }, info: { kind: string }) => {
                    log?.info(`[migpt:${account.accountId}] deliver called, kind: ${info.kind}`);
                    if (payload.text) {
                      await MiSpeaker.play({ text: payload.text });
                    }
                  },
                },
              });
            }
          } catch (err: any) {
            log?.error(`[migpt:${account.accountId}] Error polling messages: ${err.message}`);
            ctx.setStatus({
              ...ctx.getStatus(),
              lastError: err.message,
            });
          }

          await sleep(heartbeat);
        }

        log?.info(`[migpt:${account.accountId}] Stopping poller for device: ${deviceName}`);
      });

      await Promise.all(devicePromises);
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    buildChannelSummary: ({ snapshot }: { snapshot: Record<string, any> }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }: { account: Record<string, any>; runtime?: Record<string, any> | null }) => ({
      accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account.name,
      enabled: account.enabled ?? false,
      configured: Boolean(account.configured),
      running: runtime?.running ?? false,
      connected: runtime?.connected ?? false,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: typeof runtime?.lastError === 'string' ? runtime.lastError : null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
};

function createChannelRuntimeFallback(runtime: PluginRuntime) {
  return {
    routing: {
      resolveAgentRoute: ({ cfg, channel, accountId, peer }: { cfg: any; channel: string; accountId: string; peer: { kind: string; id: string } }) =>
        runtime.channel.routing.resolveAgentRoute({
          cfg,
          channel,
          accountId,
          peer: { kind: peer.kind === 'direct' ? 'direct' : 'group', id: peer.id },
        }),
    },
    reply: {
      resolveEnvelopeFormatOptions,
      formatAgentEnvelope: ({ channel, from, body, timestamp, envelope }: { channel: string; from: string; body: string; timestamp?: number; envelope?: unknown }) =>
        formatInboundEnvelope({
          channel,
          from,
          body,
          timestamp,
          envelope: envelope as any,
        }),
    },
  };
}
