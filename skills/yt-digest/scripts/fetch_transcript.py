#!/usr/bin/env python3
"""Fetch YouTube video metadata and transcript (subtitles) without downloading media.

Uses `uvx yt-dlp` so nothing needs to be installed permanently.
Downloads ONLY the caption VTT that YouTube serves for the CC button —
no video, no audio, no storyboard, no account credentials.

Outputs (in --outdir):
  meta.json            selected metadata + which subtitle track was used
  transcript.txt       cleaned concatenated text, for summarizing
  transcript_timed.txt [H:MM:SS]-prefixed lines, for locating topics
                       (and as coordinates for future frame extraction)

Exit codes: 0 = ok, 2 = video reachable but no ja/en subtitles, 1 = other failure
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

# manual subs are human-made (no ASR errors) so they win over auto within a language;
# ja wins over en because this skill's output format is Japanese
LANG_PREF = [("ja", "manual"), ("ja", "auto"), ("en", "manual"), ("en", "auto")]

TAG = re.compile(r"<[^>]+>")
CUE_TS = re.compile(r"(?:(\d+):)?(\d{2}):(\d{2})\.\d{3}")


def fetch_info(url: str) -> dict:
    cmd = [
        "uvx", "yt-dlp",
        "--js-runtimes", "node",
        "--no-playlist",
        "--skip-download",
        "-J", url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if r.returncode != 0 or not r.stdout.strip():
        sys.stderr.write(r.stderr)
        sys.exit(1)
    return json.loads(r.stdout)


def pick_track(info: dict):
    """Return (lang_key, kind, vtt_url) following LANG_PREF, or (None, None, None)."""
    pools = {"manual": info.get("subtitles") or {}, "auto": info.get("automatic_captions") or {}}
    for lang, kind in LANG_PREF:
        for key, tracks in pools[kind].items():
            if key == lang or key.startswith(lang + "-"):
                vtt = next((t for t in tracks or [] if t.get("ext") == "vtt" and t.get("url")), None)
                if vtt:
                    return key, kind, vtt["url"]
    return None, None, None


def parse_vtt(vtt_text: str):
    """Return list of (seconds, text), deduping the rolling repeats of auto captions."""
    entries = []
    cur = 0
    prev = None
    for line in vtt_text.splitlines():
        if "-->" in line:
            m = CUE_TS.match(line.strip())
            if m:
                h = int(m.group(1) or 0)
                cur = h * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            continue
        if not line.strip() or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE", "STYLE")):
            continue
        text = TAG.sub("", line).strip()
        if text and text != prev:
            entries.append((cur, text))
            prev = text
    return entries


def hms(seconds: int) -> str:
    h, rest = divmod(seconds, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("url")
    ap.add_argument("--outdir", default=".", help="output directory (default: cwd)")
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    info = fetch_info(args.url)
    lang, kind, vtt_url = pick_track(info)

    meta = {
        "id": info.get("id"),
        "title": info.get("title"),
        "channel": info.get("channel"),
        "duration_string": info.get("duration_string"),
        "upload_date": info.get("upload_date"),
        "webpage_url": info.get("webpage_url"),
        "live_status": info.get("live_status"),
        "chapters": [
            {"start": hms(int(c.get("start_time") or 0)), "title": c.get("title")}
            for c in (info.get("chapters") or [])
        ],
        "subtitle_lang": lang,
        "subtitle_kind": kind,
    }
    (outdir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"title:    {meta['title']}")
    print(f"channel:  {meta['channel']} | {meta['duration_string']} | uploaded {meta['upload_date']}")
    if meta["chapters"]:
        print(f"chapters: {len(meta['chapters'])} (see meta.json)")

    if not vtt_url:
        print("subtitle: NONE (no ja/en track, manual or auto)")
        print(f"meta:     {outdir / 'meta.json'}")
        return 2

    with urllib.request.urlopen(vtt_url, timeout=60) as resp:
        vtt_text = resp.read().decode("utf-8")

    entries = parse_vtt(vtt_text)
    plain = " ".join(t for _, t in entries)
    timed = "\n".join(f"[{hms(ts)}] {t}" for ts, t in entries)
    (outdir / "transcript.txt").write_text(plain, encoding="utf-8")
    (outdir / "transcript_timed.txt").write_text(timed, encoding="utf-8")

    print(f"subtitle: {lang} ({kind})")
    print(f"transcript.txt:       {len(plain)} chars")
    print(f"transcript_timed.txt: {len(entries)} lines")
    print(f"outdir:   {outdir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
