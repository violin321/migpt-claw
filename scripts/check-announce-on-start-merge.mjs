import { resolveMiAccount } from '../dist/src/config.js';

const baseCfg = {
  channels: {
    migpt: {
      enabled: true,
      userId: 'u',
      passToken: 'p',
      devices: ['speaker'],
      announceOnStart: false,
      startupMessage: 'GLOBAL',
      acknowledgeOnReceive: false,
      receiveMessage: 'OK',
      accounts: {
        child: {
          enabled: true,
          userId: 'u2',
          passToken: 'p2',
          devices: ['speaker2'],
          announceOnStart: false,
          startupMessage: 'CHILD',
          acknowledgeOnReceive: true,
          receiveMessage: 'CHILD_OK'
        }
      }
    }
  }
};

const def = resolveMiAccount(baseCfg);
if (def.config.announceOnStart !== false) throw new Error(`default announceOnStart mismatch: ${def.config.announceOnStart}`);
if (def.config.startupMessage !== 'GLOBAL') throw new Error(`default startupMessage mismatch: ${def.config.startupMessage}`);
if (def.config.acknowledgeOnReceive !== false) throw new Error(`default acknowledgeOnReceive mismatch: ${def.config.acknowledgeOnReceive}`);
if (def.config.receiveMessage !== 'OK') throw new Error(`default receiveMessage mismatch: ${def.config.receiveMessage}`);

const child = resolveMiAccount(baseCfg, 'child');
if (child.config.announceOnStart !== false) throw new Error(`child announceOnStart mismatch: ${child.config.announceOnStart}`);
if (child.config.startupMessage !== 'CHILD') throw new Error(`child startupMessage mismatch: ${child.config.startupMessage}`);
if (child.config.acknowledgeOnReceive !== true) throw new Error(`child acknowledgeOnReceive mismatch: ${child.config.acknowledgeOnReceive}`);
if (child.config.receiveMessage !== 'CHILD_OK') throw new Error(`child receiveMessage mismatch: ${child.config.receiveMessage}`);

const fallbackChild = resolveMiAccount({
  channels: {
    migpt: {
      enabled: true,
      userId: 'u',
      passToken: 'p',
      devices: ['speaker'],
      announceOnStart: false,
      startupMessage: 'GLOBAL',
      accounts: {
        fallback: {
          enabled: true,
          userId: 'u3',
          passToken: 'p3',
          devices: ['speaker3']
        }
      }
    }
  }
}, 'fallback');

if (fallbackChild.config.announceOnStart !== false) throw new Error(`fallback child announceOnStart mismatch: ${fallbackChild.config.announceOnStart}`);
if (fallbackChild.config.startupMessage !== 'GLOBAL') throw new Error(`fallback child startupMessage mismatch: ${fallbackChild.config.startupMessage}`);

console.log('announceOnStart merge checks passed');
