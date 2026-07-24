# Public readiness TODO

この repository はすでに GitHub 上で public になっている。以下は公開前の準備ではなく、
現在の露出を前提にした優先修正として扱う。

## P0 — 最優先

- [x] `distribute` の意図した ownership と破壊的挙動を README に明記する

  提案文言：

  > This CLI is a personal environment reconciler, not a general-purpose package
  > manager. Within a selected target, skill names present in this repository are
  > treated as repository-owned. Therefore, `distribute` intentionally replaces
  > same-name symlinks that point elsewhere and removes all dangling symlinks,
  > including links not created by this repository. Run `list` first if the target
  > directory also contains symlinks managed by hand or by another tool.

- [x] `mouse-doctor` から特定ユーザー、日時、machine spec、device、個人運用への依存を除き、
  LinearMouse / Karabiner-Elements を使う macOS 環境向け runbook として抽象化する
- [x] `mouse-doctor` の既存履歴は書き換えない
  - credential、住所、email などの sensitive PII は含まれていない
  - nickname、device model、local 運用、診断値は現在の source から除去済み
  - commit SHA、tag、PR の参照を壊す履歴書き換えは行わない
- [x] `yt-digest` の `~/.claude/...` 固定パスを廃止し、skill 自身の配置先を基準に script を実行する
- [x] `yt-digest` から日本の著作権法による適法性の断定を削除し、アクセス権・利用規約・適用法を確認する表現へ変更する

## P1 — 公開利用者向け

- [ ] README に clone から利用開始までの Quickstart を追加する
  - `git clone`
  - `cd`
  - `doctor`
  - target を指定した `distribute`
- [ ] README に skill catalog を追加する
  - 概要
  - 対応 OS
  - 必要な外部 command
  - 個人環境への依存有無
- [ ] README に update、uninstall、repository 移動時の手順を追加する
- [ ] README に target 未指定時は全 target を処理することを明記する
- [ ] README に日本語中心・個人用途由来の repository であることを明記する
- [ ] skill ごとの依存関係を明記する
  - `yt-digest`: Python、`uvx`、Node、network access
  - `oss-bus-factor`: `gh`、`jq`、network access
  - `tmux`: `tmux`
- [ ] 最小限の `.gitignore` を追加する
  - `node_modules/`
  - `__pycache__/`
  - `*.pyc`
  - `.DS_Store`
  - `.env*`（必要なら `.env.example` を除外）
- [ ] CI で全 `skills/*/SKILL.md` の存在を検証する
- [ ] CI で directory 名と frontmatter の `name` が一致することを検証する
- [ ] CI で frontmatter の YAML validation を行う
- [ ] CI に Python の syntax check または unit test を追加する
- [ ] CI に Markdown の local-link check を追加する
- [ ] CLI を macOS でも CI test するか、対応 OS を明記する

## P1 — GitHub 設定

- [ ] `main` に branch protection または ruleset を設定する
  - PR 経由を必須化する
  - CI 成功を必須化する
  - force push と branch deletion を禁止する
- [ ] GitHub Actions を full commit SHA で固定する
- [ ] Dependabot の `github-actions` update を有効にする
- [ ] `CONTRIBUTING.md` を追加する
- [ ] `SECURITY.md` を追加する
- [ ] 最小限の pull request template を追加する
- [ ] 使用しない GitHub Wiki を無効にする

## P2 — リリース

- [ ] `skills/weed-comment/SKILL.md` の未コミット変更を commit または退避する
- [ ] `bunx git-cliff` の version を固定する
- [ ] P0 と P1 の修正後に changelog を更新する
- [ ] 次の tag と GitHub Release を作成する

## 現在確認できていること

- [x] Bun tests: 10 tests passed
- [x] ShellCheck passed
- [x] Python syntax check passed
- [x] 最新の GitHub Actions run passed
- [x] MIT License がある
- [x] `ponytail-review` の upstream license が保持されている
- [x] README と skill 内の外部リンクが到達可能
- [x] GitHub secret scanning が有効
- [x] GitHub secret scanning push protection が有効
- [x] 現在および Git 履歴の一般的な credential pattern scanで該当なし

## 今回は不要

- CODE_OF_CONDUCT
- GitHub Discussions
- npm package としての公開
- 複雑な issue template
- unused feature や追加 abstraction
