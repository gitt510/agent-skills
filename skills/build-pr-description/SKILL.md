---
name: build-pr-description
description: >
  Write a PR description from scratch or fully rebuild an existing one. Why is written as an
  argument — the claims that make the change necessary, each backed by verifiable facts — and
  What / Test / Notes carry only the facts a reviewer needs to read the diff. Claims and facts
  are gathered from the diff, commits, and conversation; an existing body is broken down
  sentence by sentence and only what survives verification is kept. Use when creating or
  rewriting a PR body, including when running gh pr create or gh pr edit. Not for a few added
  lines to an existing description — a normal edit covers that.
---

# build-pr-description

PR description は reviewer が diff を読むための文書。**Why は論証、What / Test は fact の集合**
として書く。Why = 変更を必要とする主張（判断）+ それを支える検証可能な根拠。
根拠だけ並べて結論の復元を読み手に委ねない。骨子は PR template の de facto
（Google の CL description ガイド・Kubernetes template などが収束する Why → What → Test）に従う。
how の解説は diff 自身が語るので書かない。

**形式の規律は `writing-documents` に委譲する。** この skill が持つのは PR 固有の
allowlist・骨子・fact の収集経路・PR 固有のチェックだけ。
publish-pr（PR 作成 flow）は body の作成をこの skill に委譲する。

## ルール

### allowlist — 書いてよい文は5種だけ

1. **主張** — 変更を必要とする判断を現在形の叙述文で書く（「DB 移行に伴い legacy resource を
   解体する必要がある」「AWS が SLA で保証する可用性を自前で観測して metrics 化するのは無駄」）。
   1 PR に 1〜3 個。それ以上必要なら PR が大きすぎる
2. **根拠** — 主張を支える検証可能な客観事実。どの主張を支えるかが明示される位置
   （主張の直下）に置く
3. **変更の fact** — diff から観測できる変更と、変更後の対外契約
4. **検証結果** — 実行した確認コマンドと実測値
5. **reviewer への注記** — 却下した代替案・設計の前例・migration 上の注意など、
   レビューの一往復を先回りで減らすもの

主張の判定: **この主張が偽なら、この PR は不要になるか？** ならないなら動機ではない。
根拠のない主張はただの意見 — 根拠を見つけるか、主張ごと落とす。
どの主張も支えない fact は Why に置かない（Notes 行きか削除）。

削除テストの主体は **reviewer**: その文を消したとき、reviewer の diff の読み方や質問が変わるか。
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
- allowlist と section の対応: 主張 + 根拠 → Why、変更の fact → What、
  検証結果 → Test、注記 → Notes

### 形式 — PR の例外宣言

次の2つだけを例外として宣言する。

- **Why は主張 → 根拠の2段 bullet。** 主張が top-level、根拠をその直下に nest する。
  nest を使ってよいのは Why だけ
- **Notes の bullet は理由節をぶら下げてよい。** README では理由節は弁明の再侵入だが、
  Notes では rationale が fact そのもの（「Tavern も検証のうえ pure pytest を採用 —
  assertion が YAML から漏れるため」で1 fact）

What / Test は例外なし。

### 判断の住処 — 問いの向きと寿命で分ける

- 「なぜこの変更が要るか」→ Why の主張。「なぜ X という代替じゃないか」→ Notes に 1-2 bullet。
  What で説明したくなった rationale は観測可能な保証に変換し、できないものは Notes へ
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

- **事実の陳列** — 主張のない Why。根拠 fact だけが並び、それらがどの結論を支えるのかの
  復元が読み手の宿題になる。fact が2つ以上並んで違和感がないなら、主張が欠けている合図
- **意思の混入** — 「〜したい」「〜できるようにする」。意思は根拠で支えられない。
  根拠に支えられる判断（「〜する必要がある」「〜は無駄」）に変換する
- **how の解説 prose** — 実装の流れ・関数名・内部構造の説明。diff が語る
- **diff 内 doc の再掲** — README に書いた恒久 fact の丸写し。reviewer は diff で doc を読む
- **動機の取り違え** — assertion や実装が参照する issue を「関連 issue:」として
  動機に昇格させたもの。test が #N の契約を検証することと、PR の動機が #N であることは別

## 手順 — 主張と fact の収集・適用

1. `writing-documents` を invoke し、共通の判定方法・形式・書き換え技法を読み込む
2. 既存 body がある場合は `gh pr view --json body` で取得し、**文単位**で allowlist に照合する。
   section や構成は継承せず、生き残る文だけを候補にする
3. **What** — diff（`git diff` / `gh pr diff`）から観測できる変更と、変更後の対外契約を拾う。
   既存 body と diff が食い違う場合は diff を正とする
4. **Why の主張は diff から導出できない**。既存 body・会話・commit message・既存 issue に求め、
   無ければ user に確認する。根拠はコード・実 resource・実測で検証してから主張の下に置く。
   関連しそうな issue link を勝手に動機へ昇格させない
5. **Test** — session 中に実際に実行した検証コマンドと実測値を拾う。既存 body の記載値は
   信じず、安全に再実行できるもの（`--collect-only`・lint 等）は再実行して照合する。
   外部環境を叩くものは既存の実測値を使う
6. **Notes** — 既存 body・session から却下した代替案・設計の前例を拾う。
   merge 後に失われ、reviewer の一往復を減らす rationale だけを残す
7. 主張と fact を骨子に配置し、形式ルールを適用する
8. 完了チェックを1項目ずつ機械的に検査する
9. `gh pr create --body-file <file>` または `gh pr edit <num> --body-file <file>` で適用する
10. 以後 PR に commit を積んだら、What / Test に同じ規律で追記して同期する

## 完了チェック

`writing-documents` の共通チェックに、以下を足して検査する。

- [ ] Why の各 top-level bullet が主張（判断の叙述文）である — 事実の陳列になっていない
- [ ] 全主張が「偽なら PR が不要になる」を満たす
- [ ] 各主張の直下に検証済みの根拠が1つ以上 nest されている
- [ ] どの主張も支えない fact が Why に残っていない
- [ ] 主張が user 確認済みか、既存 body / commit / 会話に根拠がある
- [ ] 恒久 fact が diff 内 doc と重複していない（PR は参照のみ）
- [ ] 外部 SoT の値の snapshot に「現在値」の銘がある
- [ ] Test の数値・コマンドが実装・再実行と照合済み
- [ ] Notes が「reviewer が聞くであろう質問への先回り」だけで構成されている
