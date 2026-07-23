---
name: yt-digest
description: >
  Summarize a YouTube video from its transcript (subtitles) fetched with yt-dlp, without
  watching it; never downloads the video or audio. Use when a YouTube URL (youtube.com /
  youtu.be) is shared and the user wants the content, key points, or a transcript — including
  vague asks like "what's this about?" as long as the target is a YouTube video.
---

# YT Digest

## Goal

動画を視聴せずに、YouTube が字幕表示用（CC ボタン）に配信している VTT
データだけから内容を把握し、「見なくて済む判断材料」を渡す。
依頼者は内容の紹介ではなく、**見る価値があるかの判断と要点**を求めている。

動画・音声・storyboard は取得しない。字幕 VTT のみ（私的使用・ローカル完結。
著作権法30条の私的複製と30条の4の情報解析の範囲）。

## 手順

1. transcript を取得する:

   ```bash
   python3 ~/.claude/skills/yt-digest/scripts/fetch_transcript.py <URL> \
     --outdir <scratchpad>/yt-digest-<video_id>
   ```

   - `uvx yt-dlp` を内部で使うのでインストール不要
   - 字幕の優先順位は 手動 ja → 自動 ja → 手動 en → 自動 en
     （手動字幕は人手なので誤変換がなく品質が段違い）
   - exit 2 = 字幕なし。下の Edge cases へ

2. `transcript.txt` を読む。長い動画（>50k chars）は分割して読む。
   `meta.json` に chapters があれば構成把握の手がかりにする。

3. 下の「出力の型」で要約を書く。

## 出力の型

1. 📌 **基本情報** — タイトル・チャンネル・長さ・公開日
2. **論旨の流れ** — 何を主張／説明する動画かを一文で言ってから、展開を追う
3. 💢 **ツッコミどころ** — 主張系の動画（投資・健康・製品レビューなど、
   何かを勧める／断じる動画）のみ。チュートリアルや純粋な解説には付けない。
   データの選び方の偏り（チェリーピッキング）、意図的に省かれた前提
   （税・手数料・リスク）、論理の飛躍を具体的に指摘する。
   依頼者が「見なくていい理由」まで含めて判断できるようにするのが目的
4. **宣伝の分離** — スポンサー枠・案件・自社宣伝は本編の要約に混ぜず、
   「動画の◯割が宣伝」程度に分けて報告する

自動字幕の場合、ASR の誤変換は文脈から修正して要約に反映する。
固有名詞の重要な修正は注記する（例:「東京会場→東京海上」）。

## Edge cases

- **字幕なし（exit 2）**: 音楽・ライブ配信・公開直後（自動字幕の生成前）は
  字幕が存在しないことがある。その旨を報告して止まる。
  音声をダウンロードしての文字起こしはこの skill の範囲外
- **メンバー限定・年齢制限・非公開**: アカウント不使用の設計なので取得
  できない。報告して止まる
- **「◯◯についてどこで話してる？」** と聞かれたら `transcript_timed.txt`
  から timestamp を引いて答える

## 拡張余地（未実装）

`transcript_timed.txt` の timestamp は、将来フレーム切り出し
（動画 DL + ffmpeg）を足すときの座標になる。図表が多くて transcript
だけでは不足する動画が出てきたら phase 2 として検討する。
