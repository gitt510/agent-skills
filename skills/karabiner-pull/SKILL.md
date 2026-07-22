---
name: karabiner-pull
description:
  "Karabiner-Elements の runtime 設定（GUI/アプリで編集した実設定）を repo SoT（dotfiles）へ
  取り込む capture 方向。symlink でなくコピー運用のため GUI 編集は repo に自動反映されない。
  「karabiner-pull」「GUIの変更を取り込んで」「karabiner取り込み」と言われたときに使う。逆方向（適用）は karabiner-apply。"
---

# Karabiner Pull Contract

## Purpose

- GUI / アプリで編集された runtime 設定を repo SoT へ**取り込む（capture）**
- runtime は symlink でなくコピー運用のため GUI 編集が repo に流れない。明示的に吸い上げる
- 方向は **runtime -> repo（capture）**。逆（repo -> runtime の反映）は `karabiner-apply`

## Scope

**In Scope**

- runtime `~/.config/karabiner/karabiner.json` の JSON 検証
- 取り込み前の repo 側状態の保全（`git status` 確認・未コミット変更の警告）
- runtime -> repo の上書き取り込み
- 取り込み後の一致確認（`cmp`）
- `git diff` の提示（コミット前レビューを促す）

**Out of Scope**

- runtime の変更（profile 再選択はしない＝ runtime は不変）
- runtime を恒久 SoT とする運用
- 取り込み後の自動コミット

## Inputs

- 必須: runtime config path（source、既定: `~/.config/karabiner/karabiner.json`）
- 必須: repo config path（target、既定: `keyboard/karabiner/karabiner.json`）

## Outputs

- repo 設定ファイル（runtime の内容で上書き済み）
- 取り込み前の repo 差分情報（`git status` / 退避の有無）
- 検証結果（`cmp` の一致有無）
- レビュー用 `git diff --stat` サマリ

## Output Schema

```markdown
- status: pulled | failed
- source: ~/.config/karabiner/karabiner.json
- target: keyboard/karabiner/karabiner.json
- verify:
  - cmp_exit_code: 0 | 1
  - diff_stat: <git diff --stat の要約>
- review: コミット前に `git diff` の確認を促す
- notes:
  - failure reason or follow-up action
```

## Invariants

- `INV-001`: SoT(target) は `keyboard/karabiner/karabiner.json`
- `INV-002`: 取り込み前に runtime を `jq empty` で検証する
- `INV-003`: repo は git 管理下。上書き前に `git status` を確認し、未コミット変更があれば警告する（undo は `git restore`）
- `INV-004`: runtime は一切変更しない（`--select-profile` しない＝ source は read-only）
- `INV-005`: 取り込み後に `cmp` で runtime と repo の一致を確認する
- `INV-006`: 取り込み後に `git diff` を提示し、コミット前レビューを促す

## Prohibited

- `PRO-001`: runtime を編集・再選択する（pull の source は読み取り専用）
- `PRO-002`: 取り込み後に無確認で自動コミットする
- `PRO-003`: `cmp` による一致確認を省略する

## Acceptance Criteria

- runtime JSON が妥当（`jq empty` 成功）
- repo が runtime と一致している（`cmp` が `0`）
- `git diff` が提示され、レビューが促されている
- 取り込み前に未コミット変更があった場合は警告または退避されている

## Caveats

- 🔥 GUI 編集は複合キーボードの `ignore:false` を外しやすい（「Modify events」操作で発生）。
  取り込んだ `git diff` に `devices` の `ignore` 変化や `simple_modifications` の増減があれば、
  意図せぬ device 破壊の可能性を疑う。詳細は `karabiner-apply` の Caveats を参照。
