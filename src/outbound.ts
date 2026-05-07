import type { ChannelOutboundAdapter } from 'openclaw/plugin-sdk/core';
import type { OutboundDeliveryResult } from 'openclaw/plugin-sdk/outbound-runtime';
import type { MiGPTConfig } from './types.js';
import { MiService } from './service.js';
import { MiSpeaker } from './speaker.js';
import { resolveMiAccount } from './config.js';
import type { ExtendedOpenClawConfig } from './types.js';

/**
 * 文本分块函数
 */
function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      splitAt = remaining.lastIndexOf(' ', limit);
    }
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      splitAt = limit;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

type MiOutboundConfig = {
  channels?: {
    migpt?: MiGPTConfig;
  };
};

type SendTextOpts = {
  to: string;
  text: string;
  accountId?: string;
  cfg: MiOutboundConfig;
};

type SendMediaOpts = {
  to: string;
  text?: string;
  mediaUrl: string;
  accountId?: string;
  cfg: MiOutboundConfig;
};

function delivered(messageId: string): OutboundDeliveryResult {
  return { channel: 'migpt', messageId, timestamp: Date.now() };
}

export const miOutbound: ChannelOutboundAdapter = {
  deliveryMode: 'direct',
  chunker: chunkText,
  chunkerMode: 'text',
  textChunkLimit: 200,

  sendText: async ({ to, text, accountId, cfg }: SendTextOpts) => {
    const account = resolveMiAccount(cfg as ExtendedOpenClawConfig, accountId ?? undefined);

    if (!account.configured) {
      throw new Error('Account not configured');
    }

    const initSuccess = await MiService.init(
      {
        ...account.config,
        announceOnStart: account.config.announceOnStart ?? cfg.channels?.migpt?.announceOnStart,
        startupMessage: account.config.startupMessage ?? cfg.channels?.migpt?.startupMessage,
      },
      to,
    );
    if (!initSuccess) {
      throw new Error('Failed to initialize MiService');
    }

    const volume = cfg.channels?.migpt?.volume;
    if (volume && volume >= 6 && volume <= 100) {
      await MiSpeaker.setVolume(volume);
    }

    const streaming = cfg.channels?.migpt?.streaming ?? true;
    const chunkLimit = cfg.channels?.migpt?.textChunkLimit ?? 200;

    if (streaming && text.length > chunkLimit) {
      const chunks = chunkText(text, chunkLimit);
      for (const chunk of chunks) {
        const result = await MiSpeaker.play({ text: chunk });
        if (!result.success) {
          throw new Error(result.error);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return delivered(Date.now().toString());
    }

    const result = await MiSpeaker.play({ text });
    if (!result.success) {
      throw new Error(result.error);
    }
    return delivered(Date.now().toString());
  },

  sendMedia: async ({ to, text, mediaUrl, accountId, cfg }: SendMediaOpts) => {
    const account = resolveMiAccount(cfg as ExtendedOpenClawConfig, accountId ?? undefined);

    if (!account.configured) {
      throw new Error('Account not configured');
    }

    const initSuccess = await MiService.init(
      {
        ...account.config,
        announceOnStart: account.config.announceOnStart ?? cfg.channels?.migpt?.announceOnStart,
        startupMessage: account.config.startupMessage ?? cfg.channels?.migpt?.startupMessage,
      },
      to,
    );
    if (!initSuccess) {
      throw new Error('Failed to initialize MiService');
    }

    if (text?.trim()) {
      await MiSpeaker.play({ text });
    }

    if (mediaUrl) {
      const result = await MiSpeaker.play({ url: mediaUrl });
      if (!result.success) {
        throw new Error(result.error);
      }
    }

    return delivered(Date.now().toString());
  },
};
