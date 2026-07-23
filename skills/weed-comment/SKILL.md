---
name: weed-comment
description: >
  Weed context-leak comments out of AI-agent-written code. Deletes comments that
  narrate the coding session — edit-history narration ("added", "now handles"),
  reviewer-directed self-justification ("this is safe because"), session references
  ("as discussed", "as requested"), design-decision narration, restating the code —
  while preserving durable ones: constraints the code cannot express, non-obvious
  rationale, business rules, TODO/FIXME, tool directives. Each comment is judged by
  one test: does it still make sense to a reader who never saw the session? Use after
  an agent coding session, before committing agent-written changes, when a diff review
  flags comment noise, or when the user says "clean up the comments", "remove AI
  comments", "comment slop", "コメント整理して", "コメント抜いて", or invokes
  /weed-comment. Edits comments only — never executable code; not a general
  simplify pass.
---

# weed-comment

コメントは変更の弁明ではなく、次にコードを読む人への申し送りである。
agent は session の文脈をコメントに漏らしがち — 変更の語り、レビュワーへの正当化、
会話への参照。これらは PR description の管轄であり、merge された瞬間にノイズになる。

## 判定 test（唯一の基準）

**session を見ていない第三者として、そのコメントだけを読む。**
コードと付き合わせて意味が完結すれば keeper。「どの変更の話？」「誰に言ってる？」
と感じたら weed。以下のリストはこの test の近似にすぎない — 迷ったら test に戻る。

## Scope

default は **diff-only**: staged + unstaged の patch が導入・変更したコメント
（docstring の説明文を含む）だけを対象にする。変更された file の既存コメントは
対象外 — 頼まれていない editorializing を避ける。
repo 全体や named directory は明示的に頼まれたときだけ。その場合は既存コメントにも
同じ基準を適用する。

## Weeds（抜く）

- **編集履歴の語り** — "added" / "removed" / "changed" / "updated" / "now handles" /
  "previously"。git log が既に持っている情報
- **レビュワーへの自己正当化** — "this is safe because…" / "correctly handles…"。
  変更が正しい根拠は PR に書く。merge 後は誰に向けた文かわからなくなる
- **session 参照** — "as discussed" / "as requested" / "per review feedback"。
  会話は読者に見えない
- **設計判断の語り** — コードが既に示している構造を宣言し直すだけの文
  （「X を Y として宣言する」「〜で自然に分離される」）
- **コードの言い換え** — コード・関数名をなぞるだけのコメント
- **commented-out code** — git が持っている

## Keepers（残す）

- **コードが示せない制約** — 「この重複は偶然、DRY するな」「完全一致でないと誤検知する」。
  消すと将来の編集者が壊す情報
- **非自明な理由・business rule**
- **導線** — 出所が魔法に見えるものへの pointer（fixture の生成元、暗黙の呼び出し元など）
- **TODO / FIXME 等の work marker**
- **linter / formatter / coverage / generated-code の directive**

## 圧縮 — 全削除の前に

weed の文中に keeper の一句が埋まっていることがある。コメント単位ではなく
**文単位**で判定し、制約だけ残して圧縮する。

❌ 「site_id は各 target の持ち物として宣言する（値の一致は偶然で、共有は前提に
しない）。site は stg「…」、prd「…」。mode 設定は {target}-gptConfig にある。」

✅ 「stg / prd の site_id の一致は偶然で、共有は前提にしない」

## Boundaries

- コメントだけを編集する。executable code・挙動・無関係な整形には触れない
- 削除で必須 scope が空になる場合（`pass` だけの block 等）は残す
- 抜くものが無ければ「weed なし」と言って終わる — 無理に指摘を作らない
- simplify / over-engineering review は別 skill の管轄。コメント以外の指摘はしない
