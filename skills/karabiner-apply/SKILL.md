---
name: karabiner-apply
description:
  "Karabiner-Elements 設定を repo SoT（dotfiles）から runtime へ反映（適用）し、
  active profile 再選択でリロード・確認する deploy 方向。「karabiner反映して」「karabiner適用」
  「karabiner-apply」と言われたときに使う。逆方向（GUI 編集の取り込み）は karabiner-pull。"
---

# Karabiner Apply Contract

## Purpose

- dotfiles の Karabiner 設定を repo SoT から runtime へ安全に**反映（適用）**する
- validate / backup / overwrite / reload を固定手順化し、反映漏れを防ぐ
- 方向は **repo → runtime（deploy）**。逆（runtime → repo の取り込み）は `karabiner-pull`

## Scope

**In Scope**

- `keyboard/karabiner/karabiner.json` の JSON 検証
- runtime 設定のバックアップ作成
- repo -> runtime の上書き反映
- active profile の再選択による再読込（外部編集は再選択しないと効かない）

**Out of Scope**

- runtime ファイルを SoT とした直接運用
- GUI 編集の取り込み（→ `karabiner-pull`）
- macOS システムショートカットそのものの変更
- Karabiner 未インストール環境の構築作業

## Inputs

- 必須: repo config path（既定: `keyboard/karabiner/karabiner.json`）
- 必須: runtime config path（既定: `~/.config/karabiner/karabiner.json`）

## Outputs

- runtime 設定ファイル（repo SoT で上書き済み）
- バックアップファイル（`~/.config/karabiner/karabiner.json.bak-<timestamp>`）
- 必要時のトラブルシュート方針

## Output Schema

```markdown
- status: applied | failed
- source: keyboard/karabiner/karabiner.json
- runtime: ~/.config/karabiner/karabiner.json
- backup: ~/.config/karabiner/karabiner.json.bak-YYYYmmdd-HHMMSS
- profile: <current-profile>
- notes:
  - failure reason or follow-up action
```

## Invariants

- `INV-001`: repo SoT は `keyboard/karabiner/karabiner.json`
- `INV-002`: 反映前に `jq empty` で JSON を検証する
- `INV-003`: runtime 上書き前にバックアップを作成する
- `INV-004`: reload は `--select-profile "<current-profile>"` を使う（外部編集は再選択しないと反映されない）
- `INV-005`: 失敗時は失敗理由を明示する

## Prohibited

- `PRO-001`: runtime ファイルを主運用として直接編集する
- `PRO-002`: `karabiner_cli --reloadxml` を使用する

## Acceptance Criteria

- repo JSON が妥当（`jq empty` 成功）
- runtime バックアップが作成されている
- profile 再選択コマンドが実行されている
- 失敗時は再試行方針または環境要因が記録されている

## Caveats

- 🔥 **複合キーボード（`is_pointing_device:true`）の `ignore:false` が修飾の命綱。**
  これが外れた device は **simple + complex の全 modification が無効化**する。
  GUI で当該 device の simple modification をいじる、または device entry を削除すると
  `ignore:false` が外れる。
- **編集は `complex_modifications` に限定**。`devices` / `simple_modifications` は不可侵。
  device entry と `ignore:false` は必ず残す（個別 remap は持たず profile-level に集約）。
- リロード不能に見えるときは、まず当該 device の `ignore:false` を疑う
  （`--select-profile` 自体は機能している）。
