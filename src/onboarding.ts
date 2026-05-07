import type { ChannelSetupWizardAdapter } from 'openclaw/plugin-sdk/setup';

export const miGPTOnboardingAdapter: ChannelSetupWizardAdapter = {
  channel: 'migpt',
  async getStatus() {
    return {
      channel: 'migpt',
      configured: false,
      statusLines: ['当前包已适配 OpenClaw 2026.5.4 的静态构建；交互式 setup 向导仍待后续接线。'],
    };
  },
  async configure() {
    throw new Error('MiGPT setup wizard is not implemented in this compatibility patch');
  },
};
