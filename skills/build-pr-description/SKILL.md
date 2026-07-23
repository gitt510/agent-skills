---
name: build-pr-description
description: >
  Write a PR description from scratch or fully rebuild an existing one. Gathers facts from the
  diff, commits, and conversation, then writes only the facts a reviewer needs to read the
  diff, as a Why / What / Test / Notes outline with one fact per bullet. An existing body is
  broken down sentence by sentence and only facts corroborated by other evidence survive. Use
  when creating or rewriting a PR body, including when running gh pr create or gh pr edit. Not
  for a few added lines to an existing description — a normal edit covers that.
---

# build-pr-description

PR description を「reviewer が diff を読むために必要な fact の集合」として書く。
骨子は PR template の de facto（Google の CL description ガイド・Kubernetes template
などが収束する Why → What → Test）に従う。how の解説は diff 自身が語るので書かない。

build-readme と同じく、匂い狩り（denylist）ではなく
**書いてよい文の allowlist** で判定する。該当しない文は書かない。

publish-pr（PR 作成 flow）は body の作成をこの skill に委譲する。
body の有無で変えるのは fact の収集経路だけ。既存 body は候補の入手元にはするが、
正しい記載として継承しない。新規作成と全面再構築に同じ骨子・形式・完了チェックを適用する。

## ルール

### allowlist — 書いてよい文は4種だけ

1. **動機** — 変更を必要とする客観事実。反復する要求・現状の欠落・守るべき契約を
   **現在形の叙述文**で書く（「〜の確認が必要」「〜するレイヤーが存在しない」）
2. **変更の fact** — diff から観測できる変更と、変更後の対外契約
3. **検証結果** — 実行した確認コマンドと実測値
4. **reviewer への注記** — 却下した代替案・設計の前例・migration 上の注意など、
   レビューの一往復を先回りで減らすもの

判定に迷ったら: **その文を消したとき、reviewer の diff の読み方や質問が変わるか？**
変わらないなら落とす。

### 骨子

```markdown
## Why

## What
### <変更の面ごとに subsection>

## Test

## Notes
```

- section は **h2 で切る**（GitHub の PR body では h1 が過大に render される）
- Notes は任意。書くことが無ければ section ごと落とす
- allowlist の4種と section が1対1に対応する: 動機 → Why、変更の fact → What、
  検証結果 → Test、注記 → Notes

### 形式

build-readme と同じ3形式（bullet list / table / code block）+ 1 fact 1 bullet。
paragraph（地の文）は全面禁止 — Why も bullet で書く（動機1つ = 1 bullet に分解できないなら
動機を理解できていない）。table は test 一覧・endpoint と契約の対応など、
行の比較に意味があるとき bullet より優先する。

例外: **Notes の bullet は理由節をぶら下げてよい**。README では理由節は弁明の
再侵入だが、Notes では rationale が fact そのもの
（「Tavern も検証のうえ pure pytest を採用 — assertion が YAML から漏れるため」で1 fact）。

### 判断の住処 — 決定の寿命で分ける

- diff レビューの一往復を減らす情報（「なぜ X じゃないの？」への先回り）→ Notes に 1-2 bullet
- 将来コードを触る人が必要とする決定 → ADR / code comment。PR は merge 後に
  発掘されにくく、寿命の長い決定の恒久の家にならない
- フル装備の「Rationale and alternatives」section を PR に張らない（RFC / ADR の形式）

### 1 fact = 1 home — diff 内 doc との重複

- 恒久的な fact（resource の所在・設定値・運用手順）の home は diff 内の README / doc。
  PR には参照 1 bullet だけ置く
- 変更の要約（test 一覧 table 等）は doc と重複してよい。PR は merge 後に凍結される
  change record で、living doc 間の drift 防止ルールの射程外
- 外部 SoT（DynamoDB config・実 resource 等）の値を書くときは「現在値」と銘打つ。
  snapshot 自体は凍結 record として許されるが、無銘だと恒久 fact に読まれる

### 落ちる典型（allowlist が自動で弾くもの）

- **意思の混入** — 「〜したい」「〜できるようにする」。変更を必要とする客観事実
  （要求・欠落）に変換する
- **how の解説 prose** — 実装の流れ・関数名・内部構造の説明。diff が語る
- **diff 内 doc の再掲** — README に書いた恒久 fact の丸写し。reviewer は diff で doc を読む
- **動機の取り違え** — assertion や実装が参照する issue を「関連 issue:」として
  動機に昇格させたもの。test が #N の契約を検証することと、PR の動機が #N であることは別
- **session leak** — 会話の文脈への言及・自己弁護 tone

## 手順 — fact の収集と適用

1. 既存 body がある場合は `gh pr view --json body` で取得し、**文単位**で allowlist に照合する。
   section や構成は継承せず、生き残る文だけを候補にする
2. **What** — diff（`git diff` / `gh pr diff`）から観測できる変更と、変更後の対外契約を拾う。
   既存 body と diff が食い違う場合は diff を正とする
3. **Why は diff から導出できない**。既存 body・会話・commit message・既存 issue に根拠を求め、
   無ければ user に確認する。関連しそうな issue link を勝手に動機へ昇格させない
4. **Test** — session 中に実際に実行した検証コマンドと実測値を拾う。既存 body の記載値は
   信じず、安全に再実行できるもの（`--collect-only`・lint 等）は再実行して照合する。
   外部環境を叩くものは既存の実測値を使う
5. **Notes** — 既存 body・session から却下した代替案・設計の前例を拾う。
   merge 後に失われ、reviewer の一往復を減らす rationale だけを残す
6. fact を骨子に配置し、形式ルールを適用する。既存 body・会話由来の文は session leak を
   **文単位**で検査する
7. **適用前に「完了チェック」を1項目ずつ機械的に検査する**。書く行為と検査する行為を
   分けないと守れない
8. `gh pr create --body-file <file>` または `gh pr edit <num> --body-file <file>` で適用する
9. 以後 PR に commit を積んだら、What / Test に同じ規律で追記して同期する

## 完了チェック

- [ ] paragraph（地の文）が1つも無い
- [ ] 各 bullet が単一の fact（Notes 以外は理由節なし）
- [ ] 恒久 fact が diff 内 doc と重複していない（PR は参照のみ）
- [ ] 外部 SoT の値の snapshot に「現在値」の銘がある
- [ ] Test の数値・コマンドが実装・再実行と照合済み
- [ ] Notes が「reviewer が聞くであろう質問への先回り」だけで構成されている
- [ ] Why が user 確認済みか、既存 body / commit / 会話に根拠がある
- [ ] 消しても reviewer の読み方が変わらない文が残っていない
