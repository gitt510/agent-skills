---
name: build-readme
description: >
  component / stack の README を新規作成または全面再構築する。
  system そのもの（code・terraform・実際の挙動）から観測可能な fact を収集し、
  fact から section を構成して 1 fact 1 bullet で書く。既存 README は文単位で解体し、
  実装と照合できた fact だけを救出する。決定理由の弁明・内部 how は書かない。
  「README 書いて」「README 作って」「README 起こして」「README 刷新して」
  「README 書き直して」「README 圧縮して」「README 再構築」と言われたときに使う。
  既存 README への数行の追記・修正だけなら通常編集でよい。
---

# build-readme

README を「system が何であるか」の観測可能な事実の集合として書く。
決定の物語・レビューへの弁明・実装の how は README の管轄外（PR / ADR / code の管轄）。

悪い文の variation は無限にあるため、匂い狩り（denylist）ではなく
**書いてよい文の allowlist** で判定する。該当しない文は書かない。

README の有無で変えるのは fact の収集経路だけ。新規作成では system から収集し、
全面再構築では既存 README を文単位で解体して候補を救出する。
どちらも同じ allowlist・section composition・形式・完了チェックを適用する。

## ルール

### allowlist — 書いてよい文は4種だけ

1. **観測可能な挙動** — system の外から black-box で確認できる事実。現在形の叙述文
2. **値と限界** — threshold・timeout・保持期間・課金・上限。表にできるもの。
   ただし**読者が観測・体感できる値に限る**（request が切られる timeout、課金に効く保持期間
   など）。管理下 component の内部 config（queue の batch window・visibility timeout 等）は
   terraform / code が SoT。「値だから」は内部実装を列挙する免罪符にならない
3. **外部依存の宣言** — system が前提とするが**管理しない**外部リソース
   （GitHub App・org project・手動作成の secret など）。管理下のリソースは
   terraform / code が SoT なので列挙しない
4. **読者の操作** — setup / run / deploy / rotate / repository edit で読者自身が行う手順

例外として、値の出典 link 1行（例: threshold は Prow size plugin の default）は
bikeshedding 防止として許可する。

判定に迷ったら: **その文を消したとき、読者の行動や期待が変わるか？**
変わらないなら弁明なので落とす。変わるなら（保証・非自明な挙動）残す。

### section composition

```markdown
# <name>

<prose は h1 直下の lead 1-2文のみ>

<fact から必要な section だけを選んで構成する>
```

allowlist は「その fact を書いてよいか」、section は「読者がその fact をどこで探すか」を決める。
両者を1対1に対応させない。必須なのは h1 と lead だけで、固定骨子は持たない。

1. allowlist を通った fact を、読者の関心ごとに cluster 化する
2. 各 cluster の内容を最も具体的に表す header を付ける
3. 内容がない section は作らない
4. 同じ関心を generic header と specific header に分けない
5. README の主要な利用 task に沿って section を並べる
   （例: 理解 → 前提 → 操作 → 結果・影響 → 保守。対象に合わない段階は省く）

#### canonical section palette

以下は必須の一覧でも closed set でもない。意味が合う場合は表記を揃え、対象固有のまとまりには
`Targets`・`Coverage`・`Failure output` のような具体的な header を付ける。

| Header | 採用条件 |
| --- | --- |
| `Behavior` | より具体的な名前を付けにくい、外から観測できる挙動 |
| `Usage` / `Running` | 繰り返し行う操作や実行 command。実行可能な tool / test は `Running` |
| `Setup` | 初回だけ必要な準備 |
| `Configuration` | 読者が選択・変更できる入力 |
| `Requirements` | 実行前に満たす状態・権限 |
| `Resources` | identity が重要な、system が管理しない外部 resource |
| `Cost` | 金銭・quota に直接関係する fact |
| `Execution impact` | 実行時間・外部 call・log・mutation など、実行に伴う影響 |
| `Development` | contributor が守る repository 上の制約 |
| `Troubleshooting` | 観測できる症状と読者が行う対処 |

**Resources** は宣言、**Setup** は一度だけ行う操作、**Usage / Running** は繰り返す操作。
前提・準備・日常操作を同じ section に混ぜない。順序に意味がある手順だけ ordered list を使う。

### 形式 — section 内に置けるのは3形式のみ

- **bullet list** — 1 bullet = 1 fact。句点なし。「〜だが」「〜のため」で理由をぶら下げない
  （bullet は接続詞を持てないので、弁明の再侵入を構文で防げる）。
  fact とは **system についての事実**。「以下は〜」のような document 自身への言及は
  bullet に形を変えた paragraph であり、fact ではない。section の意味は見出しと配置で示す
- **table** — 各行が fact で、列の比較に意味があるとき bullet より優先する
  （threshold 表・課金表など。bullet 化すると比較可能性が落ちる）
- **code block** — コピペして実行する verbatim 成果物（deploy commands など）

paragraph（地の文）は禁止。ordered list は順序に意味がある手順だけに使う。

**1 fact = 1 home。** 同じ fact を2箇所に書かない。手で維持する概要 table・目次は
subsection 見出しの再述になり、drift の温床（機能の列挙は `##`/`###` 見出し自体が担う）。
fact はそれが固有に属する場所に1回だけ書き、他所からは名前で参照する。

### 書き換え技法

**操作 → 不変条件。** 手続き（上書きする・剥がす・付け直す）が書きにくいときは、
結果の状態を書く。冪等性・重複排除・掃除が1文に含意される。

- 悪: 更新のたびに label を上書きし、古い label を削除する
- 良: PR には常に、最新の変更量を反映した `size/*` が1つだけ付く

**rationale → 観測可能な保証。** 理由を説明したくなったら、読者から見える契約に変換する。

- 悪: `synchronize` では発火しない — push のたびに再付与すると人間の操作と競合するため
- 良: `synchronize` では付与せず、人間による assignee の付け替えを上書きしない

**曖昧動詞の対象を明示。** 削除する・更新する・作る は、何に対する操作か読者が誤読する
（「label を削除」= repo の label 定義の削除に読める）。対象を書くか不変条件に変換する。

### 落ちる典型（allowlist が自動で弾くもの）

- **弁明** — 想定反論への防御。「public だが署名検証で安全」「LLM 解析は行わない」
  「黙って skip しない」。決定を擁護する文は PR / ADR に書く
- **内部 how** — flow 図・API 名・REST / GraphQL の区別。black-box から観測できない
- **他システムの挙動** — 別 repo の script や外部サービスの挙動の解説。この system の
  README の管轄外
- **PR の決定理由の漂着** — 「〜は…が管理する」型の境界説明。変更した PR の説明文が
  README に残ったもの
- **管理下リソースの列挙** — stack が作る Lambda・log group・IAM role の一覧。
  terraform / code が SoT。課金に関わるものだけが Cost に現れる
- **内部 config の table 化** — 内部 pipeline の設定値（batch window・retry 回数等）を
  「値と限界」だと言い張って表にしたもの。読者が体感しない値は how の一種

## 手順

1. 対象 README の状態に応じて fact の候補を収集する
   - README がない場合: 実装（code・terraform・justfile 等）から収集する
   - README がある場合: 現 README を**文単位**で allowlist に照合する。既存 section や構成は
     継承せず、生き残る文だけを候補にする
2. 候補を実装と照合する。README の prose・記憶・推測・会話の記載を根拠にしない。
   内部 pipeline は、読者が観測できる結果（不変条件）に変換するか落とす
3. 読者が体感する値と限界を抽出する。cost は
   常時課金 resource の有無 → 従量課金の軸（何に比例するか）→ 上限・抑制の仕組みの順に確認する
4. system が前提とするが管理しない外部リソースを抽出する
5. 読者自身が行う操作を抽出し、初回の準備・繰り返す操作・保守操作を区別する
6. allowlist を通った fact を読者の関心ごとに cluster 化し、section composition のルールと
   canonical section palette を使って header と順序を決める
7. 形式ルールを適用し、**提出前に「完了チェック」を1項目ずつ機械的に検査する**
   （grep / 目視走査）。書く行為と検査する行為を分けないと守れない

## 完了チェック

- [ ] section 内に paragraph がない（prose は h1 lead のみ）
- [ ] 内容がない section や、固定骨子を埋めるためだけの section がない
- [ ] 各 header が配下の fact に対する読者の関心を具体的に表している
- [ ] 前提・一度だけ行う準備・繰り返す操作が同じ section に混ざっていない
- [ ] 各 bullet が単一の fact で、理由節をぶら下げていない
- [ ] 「以下は〜」型の meta-bullet（document への言及）がない
- [ ] 同じ fact が2箇所に書かれていない（概要 table・再掲・重複 link）
- [ ] 読者が体感しない内部 config 値（batch window 等）が table や bullet に紛れていない
- [ ] Cost がある場合、その数値・上限が実装と一致している
- [ ] 「消しても読者の行動・期待が変わらない文」が残っていない
