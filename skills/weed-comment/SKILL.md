---
name: weed-comment
description: >
  Remove context-leak prose from comments and docstrings in AI-agent-written code:
  edit-history narration, reviewer-directed self-justification, session references,
  redundant code restatement, and commented-out code. Preserve durable contract
  documentation, constraints, non-obvious rationale, business rules, TODO/FIXME, and
  tool directives. Use after an agent coding session, before committing agent-written
  changes, when a diff review flags comment noise, or when the user says "clean up the
  comments", "remove AI comments", "comment slop", "コメント整理して",
  "コメント抜いて", or invokes /weed-comment. Edit comments and docstrings only;
  never change executable code or perform a general simplify pass.
---

# weed-comment

コメントと docstring は、変更の弁明ではなく次の読者へ残す documentation として扱う。
session にしか意味のない文を削り、コードだけでは伝わらない情報を残す。

## Core test

各文を、session を見ていない第三者としてコードと一緒に読む。

- コードの利用・保守に必要で、文だけで意味が完結するなら残す
- 「どの変更の話か」「誰に説明しているのか」が必要なら削る
- 名前・signature・処理を言い換えるだけなら削る

迷ったら、この test に戻る。

## Scope

default は **diff-only** とする。staged + unstaged の patch が追加・変更した comment /
docstring だけを対象にし、同じ file の既存 documentation へscopeを広げない。

repo 全体やnamed directoryは、明示的に頼まれた場合だけ対象にする。

## Workflow

1. 対象scopeのdiffを読み、追加・変更されたcommentとdocstringを拾う。
2. block単位ではなく文単位でCore testを適用する。
3. weedだけのblockは削除し、keeperが混在するblockは最小限のdocumentationへ圧縮する。
4. keeperの文言は維持する。混在文からkeeper部分を切り出す場合だけ、文として成立する
   最小限の書き直しを行う。
5. final diffを読み、executable codeと無関係なformattingが変わっていないことを確認する。
6. weedがなければ変更を作らず、「weedなし」と報告する。

## Remove

- **編集履歴** — "added" / "removed" / "changed" / "updated" / "now handles" /
  "previously"。履歴はgitが保持する
- **レビュワーへの自己正当化** — "this is safe because…" / "correctly handles…"
- **session参照** — "as discussed" / "as requested" / "per review feedback"
- **コードの言い換え** — 名前・signature・制御構造から明らかな説明
- **commented-out code** — 復元可能な履歴はgitが保持する

## Preserve

- コードが表現できない制約やinvariant
- 非自明な理由、business rule、side effect
- public contractのうち、signatureだけでは明らかでないbehavior、error、usage
- fixtureの生成元や暗黙の呼び出し元など、SoTへの導線
- TODO / FIXMEなどのwork marker
- linter / formatter / coverage / generated-codeのdirective

## Docstrings

docstringにもCore testをそのまま適用する。public APIだから無条件に残すのではなく、
利用者に必要なcontractだけを保持する。conventionやtoolが形式を要求する場合は、その要件を
満たす最小のdocstringを残す。

internal objectの名前やsignatureを言い換えるだけで、tooling上も不要なら、docstring全体を
削除してよい。逆に、meaningfulなpublic contractを機械的に一行へ縮めない。

## Compression example

❌ 「site_id は各 target の持ち物として宣言する（値の一致は偶然で、共有は前提に
しない）。site は stg「…」、prd「…」。mode 設定は {target}-gptConfig にある。」

✅ 「stg / prd の site_id の一致は偶然で、共有は前提にしない」

## Boundaries

- commentとdocstringだけを編集する。executable code、挙動、無関係なformattingに触れない
- 削除すると必須blockが空になる場合（`pass`だけのblockなど）は、syntaxを壊さない
- simplify / over-engineering reviewへscopeを広げない
