#!/usr/bin/env node
import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';

import { getMiService } from '../dist/src/mi/common.js';

const DEFAULT_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || `${process.env.HOME}/.openclaw/openclaw.json`;
const DEFAULT_PUBLIC_HOST = process.env.MORNING_BRIEF_PUBLIC_HOST || '185.194.141.235';
const DEFAULT_HTTP_HOST = process.env.MORNING_BRIEF_HTTP_HOST || '0.0.0.0';
const DEFAULT_HTTP_PORT = Number(process.env.MORNING_BRIEF_HTTP_PORT || '18888');
const DEFAULT_HTTP_DIR = process.env.MORNING_BRIEF_HTTP_DIR || '/tmp';

function parseArgs(argv) {
  const options = {
    file: '',
    device: '',
    config: DEFAULT_CONFIG_PATH,
    publicHost: DEFAULT_PUBLIC_HOST,
    httpHost: DEFAULT_HTTP_HOST,
    httpPort: DEFAULT_HTTP_PORT,
    httpDir: DEFAULT_HTTP_DIR,
    dryRun: false,
    keepServerMs: 15000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--file':
        options.file = next;
        i += 1;
        break;
      case '--device':
        options.device = next;
        i += 1;
        break;
      case '--config':
        options.config = next;
        i += 1;
        break;
      case '--public-host':
        options.publicHost = next;
        i += 1;
        break;
      case '--http-host':
        options.httpHost = next;
        i += 1;
        break;
      case '--http-port':
        options.httpPort = Number(next);
        i += 1;
        break;
      case '--http-dir':
        options.httpDir = next;
        i += 1;
        break;
      case '--keep-server-ms':
        options.keepServerMs = Number(next);
        i += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  if (!options.file) {
    throw new Error('--file is required');
  }
  if (!Number.isFinite(options.httpPort) || options.httpPort <= 0) {
    throw new Error('http port must be a positive number');
  }
  return options;
}

function printHelp() {
  console.log(`Play a public WAV URL on a Xiaomi speaker via MiNA.\n\nUsage:\n  node scripts/play-morning-brief-warm.mjs --file /tmp/morning-brief-warm-16k.wav [--device 客厅]\n\nOptions:\n  --file <path>            Local wav file to expose and play (required)\n  --device <name>          Xiaomi speaker name; defaults to channels.migpt.devices[0]\n  --config <path>          OpenClaw config path (default: ~/.openclaw/openclaw.json)\n  --public-host <host>     Public host/IP for the URL (default: 185.194.141.235 or env)\n  --http-host <host>       Bind host for the temp HTTP server (default: 0.0.0.0)\n  --http-port <port>       Temp HTTP port (default: 18888 or env)\n  --http-dir <dir>         Expected serving directory (default: /tmp or env)\n  --keep-server-ms <ms>    Keep temp HTTP server alive after play call (default: 15000)\n  --dry-run                Only validate config and print the URL; do not contact MiNA\n`);
}

async function loadConfig(configPath) {
  const resolved = resolve(configPath.replace(/^~(?=\/)/, process.env.HOME || ''));
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(resolved, 'utf8'));
}

function pickMigptConfig(rootConfig, deviceOverride) {
  const migpt = rootConfig?.channels?.migpt;
  if (!migpt) {
    throw new Error('channels.migpt not found in OpenClaw config');
  }
  const device = deviceOverride || migpt.devices?.[0];
  if (!device) {
    throw new Error('No Xiaomi speaker device configured; pass --device or set channels.migpt.devices[0]');
  }
  const speakerControl = migpt.speakerControl || 'mina';
  const hasPassword = Boolean(migpt.password);
  const hasPassToken = Boolean(migpt.passToken);
  if (!migpt.userId || !hasPassword) {
    throw new Error('channels.migpt requires userId and password for MiNA login');
  }
  return {
    device,
    speakerControl,
    config: {
      userId: String(migpt.userId),
      password: String(migpt.password),
      passToken: migpt.passToken ? String(migpt.passToken) : undefined,
      debug: Boolean(migpt.debug),
      timeout: migpt.timeout,
      speakerControl,
    },
    summary: {
      device,
      hasPassword,
      hasPassToken,
      speakerControl,
    },
  };
}

function createSingleFileServer(filePath, bindHost, port, allowedDirInput) {
  const resolvedFile = resolve(filePath);
  const allowedDir = resolve(allowedDirInput);
  if (!resolvedFile.startsWith(`${allowedDir}/`) && resolvedFile !== allowedDir) {
    throw new Error(`file must be inside ${allowedDir}; got ${resolvedFile}`);
  }
  const filename = basename(resolvedFile);
  const server = createServer(async (req, res) => {
    if (!req.url || req.url === '/favicon.ico') {
      res.writeHead(404).end('Not found');
      return;
    }
    const reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath !== `/${filename}`) {
      res.writeHead(404).end('Not found');
      return;
    }
    try {
      const { createReadStream } = await import('node:fs');
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      });
      createReadStream(resolvedFile).pipe(res);
    } catch (error) {
      res.writeHead(500).end(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, bindHost, () => {
      resolvePromise({ server, filename });
    });
  });
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePath = resolve(options.file);
  await stat(filePath);

  const rootConfig = await loadConfig(options.config);
  const migpt = pickMigptConfig(rootConfig, options.device);
  const { server, filename } = await createSingleFileServer(filePath, options.httpHost, options.httpPort, options.httpDir);
  const publicUrl = `http://${options.publicHost}:${options.httpPort}/${filename}`;

  console.log('[play] config summary:', migpt.summary);
  console.log('[play] local file:', filePath);
  console.log('[play] public url:', publicUrl);

  if (options.dryRun) {
    server.close();
    console.log('[play] dry-run complete');
    return;
  }

  try {
    const mina = await getMiService({
      service: 'mina',
      did: migpt.device,
      userId: migpt.config.userId,
      password: migpt.config.password,
      passToken: migpt.config.passToken,
      relogin: false,
    });
    if (!mina) {
      throw new Error('Failed to initialize MiNA service');
    }
    const playResult = await mina.play({ url: publicUrl });
    console.log('[play] MiNA player_play_url result:', { success: Boolean(playResult) });
    if (!playResult) {
      throw new Error('MiNA player_play_url returned false');
    }
    await sleep(options.keepServerMs);
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
