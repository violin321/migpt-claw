#!/usr/bin/env python3
"""Generate a warm spoken morning brief with MiMo TTS and normalize it to 16 kHz mono WAV.

Security notes:
- Never prints API keys or Xiaomi credentials.
- Reads MiMo API key from env first, then a local credential file.
- This is a manual helper only; it does not schedule itself.
"""

from __future__ import annotations

import argparse
import base64
import os
import subprocess
import sys
from pathlib import Path

import requests

DEFAULT_SYSTEM_PROMPT = (
    "请把输入的晨报改写成适合清晨听的温柔拟人口播稿。"
    "要求：保留事实，不编造；语言自然、简洁、温暖；"
    "控制在 1-2 分钟内可播完；不要使用标题、项目符号、emoji 或 markdown。"
)
DEFAULT_VOICE = "mimo_default"
DEFAULT_MODEL = "mimo-v2-tts"
API_URL = "https://api.xiaomimimo.com/v1/chat/completions"
DEFAULT_KEY_FILE = "/root/.openclaw/workspace/.credentials/xiaomi-api.txt"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Use MiMo TTS to rewrite a morning brief into a warm spoken script and output 16k mono wav."
    )
    parser.add_argument("--input", required=True, help="Path to the source morning brief text file.")
    parser.add_argument(
        "--spoken-text-out",
        help="Optional path to save the rewritten spoken text.",
    )
    parser.add_argument(
        "--raw-wav-out",
        default="/tmp/morning-brief-warm.raw.wav",
        help="Path for the raw wav returned by MiMo TTS. Default: /tmp/morning-brief-warm.raw.wav",
    )
    parser.add_argument(
        "--wav-out",
        default="/tmp/morning-brief-warm-16k.wav",
        help="Path for the normalized 16k mono wav. Default: /tmp/morning-brief-warm-16k.wav",
    )
    parser.add_argument(
        "--voice",
        default=os.environ.get("MIMO_VOICE", DEFAULT_VOICE),
        help=f"MiMo voice name. Default: {DEFAULT_VOICE}",
    )
    parser.add_argument(
        "--system-prompt",
        default=os.environ.get("MIMO_MORNING_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT),
        help="Instruction used to rewrite the morning brief into a warm spoken script.",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("MIMO_MODEL", DEFAULT_MODEL),
        help=f"MiMo model name. Default: {DEFAULT_MODEL}",
    )
    parser.add_argument(
        "--api-key-file",
        default=os.environ.get("XIAOMI_API_KEY_FILE", DEFAULT_KEY_FILE),
        help=f"Fallback API key file path. Default: {DEFAULT_KEY_FILE}",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("MIMO_TIMEOUT_SEC", "90")),
        help="HTTP timeout in seconds. Default: 90",
    )
    return parser.parse_args()


def load_api_key(api_key_file: str) -> str:
    for env_name in ("XIAOMI_API_KEY", "MIMO_API_KEY"):
        value = os.environ.get(env_name, "").strip()
        if value:
            return value
    path = Path(api_key_file)
    if path.is_file():
        value = path.read_text(encoding="utf-8").strip()
        if value:
            return value
    raise SystemExit(
        "Missing MiMo API key. Set XIAOMI_API_KEY / MIMO_API_KEY or provide a readable api key file."
    )


def read_input_text(path: str) -> str:
    text = Path(path).read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit(f"Input text is empty: {path}")
    return text


def call_mimo_tts(api_key: str, model: str, voice: str, system_prompt: str, text: str, timeout: int) -> tuple[str, bytes]:
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": system_prompt},
            {"role": "assistant", "content": text},
        ],
        "audio": {
            "format": "wav",
            "voice": voice,
        },
    }
    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    try:
        message = data["choices"][0]["message"]
        spoken_text = (message.get("content") or "").strip()
        audio_b64 = message["audio"]["data"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected MiMo response schema: {exc}") from exc
    if not spoken_text:
        spoken_text = text
    return spoken_text, base64.b64decode(audio_b64)


def ensure_parent(path: str) -> None:
    Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def convert_wav(raw_wav_out: str, wav_out: str) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        raw_wav_out,
        "-ar",
        "16000",
        "-ac",
        "1",
        wav_out,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = result.stderr.strip().splitlines()[-20:]
        raise RuntimeError("ffmpeg convert failed:\n" + "\n".join(stderr))


def main() -> int:
    args = parse_args()
    api_key = load_api_key(args.api_key_file)
    source_text = read_input_text(args.input)

    print(f"[mimo] reading source text: {args.input}")
    print(f"[mimo] voice={args.voice} model={args.model}")

    spoken_text, raw_audio = call_mimo_tts(
        api_key=api_key,
        model=args.model,
        voice=args.voice,
        system_prompt=args.system_prompt,
        text=source_text,
        timeout=args.timeout,
    )

    ensure_parent(args.raw_wav_out)
    ensure_parent(args.wav_out)
    Path(args.raw_wav_out).write_bytes(raw_audio)

    if args.spoken_text_out:
        ensure_parent(args.spoken_text_out)
        Path(args.spoken_text_out).write_text(spoken_text + "\n", encoding="utf-8")

    convert_wav(args.raw_wav_out, args.wav_out)

    print(f"[mimo] raw wav saved: {args.raw_wav_out}")
    print(f"[mimo] 16k mono wav saved: {args.wav_out}")
    if args.spoken_text_out:
        print(f"[mimo] spoken text saved: {args.spoken_text_out}")
    print(f"[mimo] spoken chars: {len(spoken_text)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.HTTPError as exc:
        detail = exc.response.text[:500] if exc.response is not None else str(exc)
        print(f"MiMo API request failed: {detail}", file=sys.stderr)
        raise SystemExit(1)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
