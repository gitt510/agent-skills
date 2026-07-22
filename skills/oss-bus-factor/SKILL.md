---
name: oss-bus-factor
description:
  GitHub 公開情報のみから OSS の bus factor を 3 軸 (org meta / commit
  cadence / PR merger 分布) で推定し、採用判断や PR comment 用の
  governance / 活発度メモを生成する。「bus factor 見て」「OSS の継続性 / 死活
  見て」「`<owner>/<repo>` の活発度調べて」、複数 OSS の比較で governance や
  maintainership や採用判断を求められたとき、"bus factor" / "maintenance
  health" / "is this OSS dead" 系の英語表現でも発火する。
---

# OSS Bus Factor

## Goal

GitHub に公開されている情報だけを使って、OSS の継続性リスクを 3 軸で
verifiable に評価する。主観的な「コードの質」や「community 文化」は扱わない。

## なぜ 3 軸か

| 軸 | 測るもの | 役割 |
|---|---|---|
| 1. org meta | structural potential (人を回せる素地) | 静的 snapshot |
| 2. commit / release cadence | actual liveness (今動いてるか) | dynamic 直近 |
| 3. PR merger 分布 | merge 権限の bus factor (誰が抜けたら詰むか) | 人間集約構造 |

軸 3 が bus factor の本体。contributor 分布は外部 PR が混ざって signal が弱
いので採用しない。merger は GitHub 権限モデル上 write 権限以上の人しか出ない
ので signal が強い。bot は `.merged_by.type != "User"` で除外する。

## Workflow

### 1) 入力を確定する

- `<owner>/<repo>` 形式で 1 件以上受け取る。複数なら比較ブロックを縦に並べる。
- option: `--comment` が指定されたら、PR comment 用 Markdown を出力する。

### 2) `scripts/measure.sh` を走らせる

3 軸の生データはすべてここで取る。LLM は JSON を解釈するだけで、API 呼び出しや
集計を自前でやり直さない。

```bash
scripts/measure.sh <owner>/<repo>
```

出力 JSON の構造:

- `org_meta.{owner_type, owner_created_at, public_members, description, public_repos, blog}`
  - `owner_created_at` は User / Org いずれも入る (account の age)
  - `description / public_repos / blog` は Org のときだけ入る
- `cadence.{repo_created_at, pushed_at, commits_30d, commits_90d, releases[], archived}`
  - `repo_created_at` は project 自体の age (主要 signal)
  - `owner_created_at` は org 分類の補助情報
- `merger.{distribution[], total, top_share_pct}`

### 3) org 型を分類する

`org_meta` を見て次のいずれかに振る:

- `owner_type == "User"` → **personal**
- `Organization` ∧ `description` に foundation 語 (Apache, CNCF, Eclipse,
  Linux Foundation 等) → **foundation**
- `Organization` ∧ `public_repos >= 100` ∧ `public_members >= 50`
  → **corporate umbrella**
- その他 `Organization` → **single-product vehicle**

### 4) 各軸を rating する

| 軸 | 健全 | 注意 | 危険 |
|---|---|---|---|
| 軸 1 | foundation / corporate umbrella | single-product ∧ members ≥ 10 | personal もしくは members < 10 |
| 軸 2 | `pushed_at` < 90 日 ∧ `commits_30d > 0` | `pushed_at` < 365 日 | それ以上、または `archived == true` |
| 軸 3 | `top_share_pct` < 50 | 50 〜 80 | > 80 |

軸 3 の例外: `merger.total < 10` のときは sample が小さすぎて分布から bus
factor を推定できないので、**判定不能 (n=<N>)** として明示する。personal repo
で owner が直接 push してて PR を経由しない pattern では普通に起きる
(これ自体が「bus factor が極端に小さい」signal なので、総合 take でその点を補
う)。

### 5) 総合 take を 2-3 行で書く

各軸の rating を踏まえた所見。例えば「活発だが merge 権限が 1 人寡占。fork 維
持の覚悟がない採用は避けたい」のような、採用判断に直結する一言を添える。数字
を盛らない — JSON にない事実は書かない。

### 6) `--comment` mode のときの整形

PR comment 用の Markdown skeleton:

```markdown
## OSS governance / 活発度の調査メモ

PR 比較表に載せきれない governance 観点を、GitHub 公開情報だけから verifiable
な範囲で記録。

### 1. org meta
(表)

### 2. contributor / maintenance
(merger 分布)

### 3. actual liveness
(commits / releases)
```

複数 repo なら、上記の各セクションに repo 列を並べた表で出す。

## Output format (default mode)

単一 repo:

```
### usebruno/bruno
- 軸 1 (org meta): single-product / members 3 / repo age 3.5 年 → 注意
- 軸 2 (cadence): pushed 今日 / 30d 83 commits / 週次 release → 健全
- 軸 3 (merger 分布): top 1 人で 87% (n=100) → 危険

総合: 活発だが merge 権限が 1 人寡占。fork 維持の覚悟がない採用は避けたい。
```

軸 1 の age 表示は `repo_created_at` を基準にする。`owner_created_at` は分類
判定の補助で、output には基本出さない (account 年齢と project 年齢が大きく乖
離してて言及する価値があるときだけ書く)。

複数 repo: 上記ブロックを順に並べる。1 枚 table に詰めると軸の rating が読み
にくくなるので、ブロック並列にする。

## Scope 外

- private repo
- GitHub 以外の forge (GitLab / Codeberg / sourcehut) — 将来拡張
- 主観評価 (コードの質、community 文化)

## 依存

- `gh` CLI (auth 済み)
- `jq`
- `date` (BSD / GNU いずれでも動く。script 側で `-v-30d` ‖ `-d '30 days ago'`
  を fallback している)
