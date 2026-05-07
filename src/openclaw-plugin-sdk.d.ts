// Minimal compatibility declarations for OpenClaw 2026.5.4 plugin SDK subpaths.
type MiAnyRecord = Record<string, any>;

declare module 'openclaw/plugin-sdk' {
  export const DEFAULT_ACCOUNT_ID: string;
  export function emptyPluginConfigSchema(): any;

  export interface PluginRuntime {
    channel: {
      activity: {
        record: (opts: { channel: string; accountId: string; direction: 'inbound' | 'outbound' }) => void;
      };
      reply: {
        finalizeInboundContext: (opts: MiAnyRecord) => any;
        dispatchReplyWithBufferedBlockDispatcher: (opts: {
          ctx: any;
          cfg: any;
          dispatcherOptions?: {
            responsePrefix?: string;
            deliver?: (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }, info: { kind: string }) => Promise<void>;
          };
        }) => Promise<void>;
        resolveEffectiveMessagesConfig: (cfg: any, agentId?: string) => any;
        resolveEnvelopeFormatOptions: (cfg: any) => any;
        formatInboundEnvelope: (opts: MiAnyRecord) => string;
      };
      routing: {
        resolveAgentRoute: (opts: MiAnyRecord) => any;
      };
    };
  }

  export interface OpenClawPluginApi {
    runtime: PluginRuntime;
    logger: any;
    registerChannel(options: { plugin: any }): void;
    registerTool(tool: any): void;
    registerGatewayMethod(name: string, handler: any): void;
    registerHttpRoute(handler: any): void;
    registerCli(handler: any, options?: any): void;
    registerCommand(command: any): void;
    registerService(service: any): void;
    registerContextEngine(id: string, factory: any): void;
    registerHook(event: string, handler: any, options?: any): void;
    registerProvider(provider: any): void;
    on(event: string, handler: any, options?: any): void;
  }
}

declare module 'openclaw/plugin-sdk/core' {
  export { DEFAULT_ACCOUNT_ID, PluginRuntime, OpenClawPluginApi } from 'openclaw/plugin-sdk';

  export interface OpenClawConfig {
    channels?: Record<string, any>;
  }

  export interface ChannelOnboardingAdapter {
    selectAccount?: (opts: any) => Promise<any>;
    promptCredentials?: () => Promise<any>;
    validateCredentials?: (opts: any) => Promise<any>;
    applyConfig?: (opts: any) => any;
  }

  export interface ChannelOutboundAdapter {
    deliveryMode: string;
    chunker?: (text: string, limit: number) => string[];
    chunkerMode?: string;
    textChunkLimit?: number;
    sendText: (opts: { to: string; text: string; accountId?: string; cfg: any; replyToId?: string }) => Promise<any>;
    sendMedia?: (opts: { to: string; text?: string; mediaUrl: string; accountId?: string; cfg: any; replyToId?: string }) => Promise<any>;
  }

  export interface ChannelPlugin<T = any> {
    id: string;
    meta: {
      id: string;
      label: string;
      selectionLabel: string;
      docsPath?: string;
      docsLabel?: string;
      blurb: string;
      aliases?: string[];
      order?: number;
    };
    capabilities: {
      chatTypes: string[];
      polls?: boolean;
      threads?: boolean;
      media?: boolean;
      reactions?: boolean;
      edit?: boolean;
      reply?: boolean;
      blockStreaming?: boolean;
    };
    reload?: { configPrefixes: string[] };
    onboarding?: ChannelOnboardingAdapter;
    config: {
      listAccountIds: (cfg: any) => string[];
      resolveAccount: (cfg: any, accountId?: string) => T;
      defaultAccountId: (cfg: any) => string;
      setAccountEnabled: (opts: { cfg: any; accountId: string; enabled: boolean }) => any;
      deleteAccount: (opts: { cfg: any; accountId: string }) => any;
      isConfigured: (account: T) => boolean;
      describeAccount: (account: T) => any;
      resolveAllowFrom?: (opts: { cfg: any; accountId?: string }) => Array<string | number>;
      formatAllowFrom?: (opts: { cfg: any; accountId?: string; allowFrom: Array<string | number> }) => string[];
    };
    setup?: {
      resolveAccountId?: (opts: any) => string;
      applyAccountConfig?: (opts: any) => any;
      validateInput?: (opts: any) => string | null;
      applyAccountName?: (opts: any) => any;
    };
    messaging?: {
      normalizeTarget: (target: string) => any;
      targetResolver: {
        looksLikeId: (...args: any[]) => boolean;
        hint: string;
      };
    };
    outbound: ChannelOutboundAdapter;
    gateway?: {
      startAccount: (ctx: any) => Promise<void>;
      logoutAccount?: (opts: any) => Promise<any>;
    };
    status?: MiAnyRecord;
    pairing?: any;
    security?: any;
    groups?: any;
    agentPrompt?: any;
    directory?: any;
  }
}

declare module 'openclaw/plugin-sdk/setup' {
  export interface ChannelSetupWizardAdapter {
    channel: string;
    getStatus: (...args: any[]) => Promise<any>;
    configure: (...args: any[]) => Promise<any>;
  }
}

declare module 'openclaw/plugin-sdk/channel-inbound' {
  export function formatInboundEnvelope(...args: any[]): any;
  export function resolveEnvelopeFormatOptions(...args: any[]): any;
}

declare module 'openclaw/plugin-sdk/reply-runtime' {
  export function dispatchReplyWithBufferedBlockDispatcher(...args: any[]): Promise<any>;
  export function finalizeInboundContext(...args: any[]): any;
}

declare module 'openclaw/plugin-sdk/outbound-runtime' {
  export interface OutboundDeliveryResult {
    channel: string;
    messageId: string;
    timestamp: number;
  }
}
