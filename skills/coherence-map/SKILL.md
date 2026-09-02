---
name: coherence-map
description: >
  Map a codebase's implicit design decisions as questions and answers, and surface where the
  same question is answered differently in different places (forked error-handling shapes,
  competing data-fetching strategies, parallel helpers that diverge). Each question gets a
  state — unified / forked / documented-fork — and the map accumulates in the target repo's
  docs/coherence-map.md so later runs and reviews can check new code against recorded
  decisions. Use when the user wants to audit coherence, inventory design decisions, hunt
  slop debt, asks 「設計判断を棚卸しして」「coherence-map 作って/更新して」 "where is this
  codebase incoherent", or before letting an agent make broad changes to an unfamiliar repo.
  Detection and decision-demand only — it never applies fixes; over-engineering hunting
  belongs to ponytail-review, correctness to a normal review.
---

# coherence-map

Codebase に埋まっている設計判断を「問い → 答え → 状態」の一覧に起こし、
**同じ問いに複数の答えが存在する箇所（fork）**を可視化する。
成果物は対象 repo の `docs/coherence-map.md`。fix は行わず、fork には decision を要求する。

## 中心概念

- **問い** — codebase が答えを持たざるを得ない設計上の質問。
  例:「期待される失敗はどう返す?」「view はどうデータを取る?」「URL の同一性はどう判定する?」
- **答え** — 実装が実際に採っている方式。必ず `file:line` の出現箇所を伴う
- **incoherence** — 1つの問いに対して、場所によって違う答えが返る状態。
  各答えは単体では正しい（incorrect ではない）ので、lint にも test にも diff にも映らない。
  だから明示的に照合して初めて見える

**重複と fork を区別する。** 同一コードのコピーが2つあるのは consistent な重複であり、
この skill の警報対象ではない（過剰な重複は over-engineering として ponytail-review の管轄）。
警報を鳴らすのは**分岐** — 既に答えのある問いに、別の答えが追加されている状態だけ。

## 状態は3値

| 状態 | 意味 | 要求すること |
| --- | --- | --- |
| 🟢 `unified` | 答えが1つ。理由の明文化は有無を併記 | なし（未明文化なら1行コメント化を提案） |
| 🟡 `forked` | 複数の答えが並存し、選ばれた記録がない | decision: 統一するか、別問題である理由を書くか |
| 🔵 `documented-fork` | 複数の答えがあるが、意図と理由が明文化済み | なし |

`forked` → `documented-fork` の昇格条件は「理由がコード内 comment・ADR・docs のどこかに
書かれていること」。会話や記憶は明文化に数えない。

## map の形式

`docs/coherence-map.md` に以下の形式で書く。既存 map がある場合は全面上書きせず、
問いを単位に更新する（消えた fork は状態を更新、新しい問いは追記）。

```markdown
# coherence-map

<生成日と対象 commit の1行>

## 問い: <codebase への質問形>

- 状態: 🟡 forked
- 答え A: <方式の一行要約> — `path/to/file.ts:12`
- 答え B: <方式の一行要約> — `another/file.vue:34`
- 判断待ち: <A に統一 / B に統一 / 別問題として理由を明文化、のいずれかを促す一行>
```

- 問いは必ず**質問形**で書く。「error handling」ではなく「期待される失敗はどう返す?」。
  質問形にしないと答えの比較ができない
- 答えの要約には**観測できる差**を書く（「trailing slash を同一視する / しない」）。
  「似た関数がある」だけでは fork の根拠にならない
- `判断待ち` は選択肢の提示まで。どれを選ぶかは書かない（それは owner の decision）

## 手順

1. 対象 repo の `docs/coherence-map.md` を読む。あればその問いのリストが照合の起点。
   なければ空から始める
2. Codebase を調査して問いを**コードから導出**する。固定 checklist は持たない。
   探索の起点として有効な次元: error の返し方と伝播、データの取得・cache 戦略、
   validation の置き場所、同じ入力変換（正規化・parse・format）の並存、
   設定値・定数の SoT、命名と層の切り方。
   ただし列挙はここで終わらせず、「同じ処理を書きそうな場所を2つ開いて突き合わせる」
   ことで repo 固有の問いを拾う
3. 各問いについて答えを全出現箇所つきで収集する。`file:line` が確認できないものは書かない
4. 状態を3値で分類する。documented-fork の判定は明文化の実在（comment / ADR / docs）を
   確認してから
5. `docs/coherence-map.md` を作成または更新する
6. 会話には要約だけ返す: 問いの総数、状態の内訳、そして 🟡 forked の一覧
   （これだけが action を要する）。🟢 と 🔵 の詳細は map に任せる
7. 実行環境に HTML を提示する手段（artifact の publish・browser で開ける一時 file）が
   あれば、map を1枚の HTML view にして提示する。状態での filter と、
   各答えの `file:line` を目で追える一覧が目的。
   **HTML は使い捨ての提示層であり、repo には commit しない。** SoT はあくまで
   `docs/coherence-map.md`（diff・grep でき、次回実行の照合起点になるのは md の方）

## 境界

- **fix しない。** 統一の実施・comment の追記は別の作業。促すのは decision まで
- **重複そのものは報告しない。** byte-identical なコピーは fork ではない
- **correctness・security・performance は対象外。** 通常の review に回す
- **over-engineering は対象外。** ponytail-review の管轄
- **docs と実装の乖離は対象外。** README・docs が古いファイル名や廃止済みの方式を指しているのは
  staleness であって fork ではない。問いの答えは**実装同士**から集める。docs は
  documented-fork の「明文化の実在」を確認する材料としてだけ読む
- 問いが1つも fork していない repo では、その旨と 🟢 の一覧だけを map に書いて終える。
  fork を無理に発明しない
