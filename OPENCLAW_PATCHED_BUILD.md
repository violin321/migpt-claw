# OpenClaw 2026.5.4 patched build

This fork contains the OpenClaw 2026.5.4 compatibility patch and the follow-up MiGPT runtime fixes used by the controlled local test.

## Source

- Fork: https://github.com/violin321/migpt-claw
- Base commit: `91061fe47b1f36a3df63c6edd30db98c128baa63`
- Original local patch: `/tmp/migpt-claw-openclaw-2026.5.4.patch`
- Original patch sha256: `3d755c90bdbbec781ec6d16a5bf1b07a707fba00df484847071b2ad0174e3a00`

## Included changes

1. OpenClaw 2026.5.4 SDK import compatibility.
2. ChannelPlugin API shape compatibility for runtime startup, inbound dispatch, outbound delivery, setup and status snapshots.
3. `openclaw.plugin.json#channelConfigs` metadata so `channels.migpt` validates through OpenClaw config schema.
4. `activation.onStartup=true` so the gateway runtime loads the MiGPT channel on process startup.
5. Fix for `announceOnStart=false` being lost on outbound initialization.

## Validation commands

Run from this repository:

```bash
npx tsc --noEmit
npm run build
node scripts/check-announce-on-start-merge.mjs
ln -sfn /usr/local/lib/node_modules/openclaw node_modules/openclaw
node -e "import('./dist/index.js').then(() => console.log('static import ok'))"
npm pack
sha256sum migpt-claw-1.0.0.tgz
```

Latest validated tgz sha256 at local install time:

```text
cdb6299a956879d244df5275aba3c1b6bb45d506aa9095cc7c957b7e3075d8ea
```

## Operational notes

- No Xiaomi credentials are stored in this repository.
- Runtime credentials live outside the repo under OpenClaw credentials/config.
- After installing the tgz, a process-level `openclaw gateway restart` is required for gateway startup runtime to load new plugin code.
