---
name: writing-documents
description: >
  The shared writing discipline for documents whose value is the facts a reader acts on —
  README, PR description, issue, handover, design note. Judges every sentence against an
  allowlist the caller defines instead of hunting smells, permits only three forms inside a
  section (bullet, table, code block) with paragraphs banned, converts rationale into
  observable guarantees, and separates writing from a mechanical final check. Use when
  writing or fully rebuilding such a document, and when asked to strip prose, 地の文,
  padding, or self-justification out of an existing draft. build-readme and
  build-pr-description delegate this layer and add their own allowlist and skeleton; this
  skill owns no document type of its own.
---

# writing-documents

読者が行動するための fact を運ぶ document に共通の規律。

**この skill が持つのは判定の方法と形式だけで、document 型は持たない。** allowlist の中身・
section 骨子・fact の収集経路は呼び出し側（`build-readme`・`build-pr-description` など）が定義する。
単独で呼ばれた場合は、対象 document の読者と「読者が取る行動」を先に確定させてから適用する。

## 呼び出し側との分担

| この skill が持つ | 呼び出し側が持つ |
| --- | --- |
| allowlist で判定するという方法 | allowlist の中身（許す文の種類） |
| 形式 — 3形式・paragraph 禁止・1 bullet 1 fact | section 骨子と header の決め方 |
| 書き換え技法 | fact の収集経路 |
| 削除テストの形 | 削除テストの主体（読者・reviewer・引き継ぎ先） |
| 共通の完了チェック | document 型固有の完了チェック |
| 例外を宣言できるという仕組み | 例外の宣言（理由節を許す section など） |

## 判定 — allowlist で書く

悪い文の variation は無限にあるため、匂い狩り（denylist）ではなく**書いてよい文の allowlist**
で判定する。該当しない文は書かない。呼び出し側の allowlist が数種類の文型を列挙するので、
候補の文をその型に照合し、どれにも当たらなければ落とす。

**削除テスト** — 判定に迷ったら: **その文を消したとき、読者の行動・期待・判断が変わるか？**
変わらないなら落とす。変わるなら残す。主体（読者か reviewer か）は呼び出し側が決める。

新規作成と全面再構築の差は **fact の収集経路だけ**。既存 document は文単位で allowlist に照合し、
section や構成は継承しない。生き残った文だけを候補にする。既存の記載を「正しい記載」として
継承しない。

## 形式 — section 内に置けるのは3形式のみ

- **bullet list** — 1 bullet = 1 fact。句点なし。「〜だが」「〜のため」で理由をぶら下げない
  （bullet は接続詞を持てないので、弁明の再侵入を構文で防げる）。fact とは
  **document の主題についての事実**。「以下は〜」のような document 自身への言及は
  bullet に形を変えた paragraph であり、fact ではない。section の意味は見出しと配置で示す
- **table** — 各行が fact で、列の比較に意味があるとき bullet より優先する
  （bullet 化すると比較可能性が落ちるもの）
- **code block** — コピペして実行できる verbatim 成果物

**paragraph（地の文）は禁止。** ordered list は順序に意味がある手順だけに使う。
nest と理由節は、呼び出し側が section を名指しで例外宣言したときだけ使える。

**1 fact = 1 home。** 同じ fact を2箇所に書かない。fact はそれが固有に属する場所に1回だけ書き、
他所からは名前で参照する。手で維持する概要 table・目次は見出しの再述であり、drift の温床。

## 書き換え技法

**操作 → 不変条件。** 手続き（上書きする・剥がす・付け直す）が書きにくいときは、結果の状態を書く。
冪等性・重複排除・掃除が1文に含意される。

- 悪: 更新のたびに label を上書きし、古い label を削除する
- 良: PR には常に、最新の変更量を反映した `size/*` が1つだけ付く

**rationale → 観測可能な保証。** 理由を説明したくなったら、読者から見える契約に変換する。

- 悪: `synchronize` では発火しない — push のたびに再付与すると人間の操作と競合するため
- 良: `synchronize` では付与せず、人間による assignee の付け替えを上書きしない

契約に変換できない rationale は、その document の管轄外（呼び出し側が行き先を決める）。

**曖昧動詞の対象を明示。** 削除する・更新する・作る は、何に対する操作か読者が誤読する
（「label を削除」= repo の label 定義の削除に読める）。対象を書くか不変条件に変換する。

## 落ちる典型

- **session leak** — 会話の文脈への言及・自己弁護 tone・「先ほどの指摘を反映し」型の編集履歴。
  document は成果物であり、それが作られた過程の記録ではない
- **meta-bullet** — 「以下は〜」「この section では〜」。document 自身についての言及は fact ではない

## 手順への組み込み

呼び出し側の手順に、次の2点を必ず含める。

1. 形式ルールの適用と、**提出前の完了チェックを1項目ずつ機械的に検査する行程**
   （grep / 目視走査）。書く行為と検査する行為を分けないと守れない
2. 会話・既存 document 由来の文の session leak 検査を**文単位**で行う

## 完了チェック（共通）

呼び出し側の document 型固有チェックに、以下を常に足す。

- [ ] paragraph（地の文）が1つも無い（呼び出し側が許した lead を除く）
- [ ] 各 bullet が単一の fact で、理由節をぶら下げていない（例外宣言された section を除く）
- [ ] 「以下は〜」型の meta-bullet がない
- [ ] 同じ fact が2箇所に書かれていない
- [ ] 会話への言及・自己弁護 tone が残っていない
- [ ] 消しても読者の行動・期待が変わらない文が残っていない
