---
name: build-justfile
description: Create or restructure a justfile following the conventions of prominent open-source justfiles. Use when writing a new justfile, normalizing an existing one, or porting a Makefile to just.
---

# build-justfile

justfile を「just エコシステムの誰が読んでも予想通りに動く command runner」として書く。
基準は個人の慣習ではなく、著名 OSS の justfile から実測できる de-facto convention。

de-facto の出典は実測した justfile 群: `casey/just`(作者本人)・`oxc-project/oxc`・
`eza-community/eza`・`FuelLabs/sway` ほか。ルールはこれらに共通する形だけを採る。
どれかが独自にやっているだけの癖は採らない。

新規作成でも全面再構築でも、適用するルールは同じ。再構築のときは既存 recipe を
1 本ずつ convention に照合し、名前・引数・コメントを de-facto 側に寄せる。
挙動（何を実行するか）は変えない — 変えるのは並べ方・名前・見え方だけ。

## ルール

### 1. 先頭は private な `_default` で `just --list`

引数なしの `just` は「何ができるか」の一覧であるべきで、いきなり何かを実行してはいけない。
先頭 recipe が default として走るので、そこに一覧表示を置く。

```just
_default:
    @just --list
```

`_` 始まりにするのは、この案内用 recipe 自身を `just --list` の一覧から隠すため。
定義順が workflow 順を表すなら `@just --list --unsorted` でもよい。

### 2. recipe 名は verb / verb-noun kebab

recipe は「実行する動作」なので、名前は動詞で始めると `just build` のように命令として読める。
関連する recipe は共通の動詞・名詞を prefix にして kebab-case でまとめる
(`db-migrate` / `db-generate`、`test-unit` / `test-e2e`)。この prefix が緩い grouping も兼ねる。

例外は status / report を「見る」だけの recipe。これらは名詞のほうが自然に読める
(`doctor`・`status`・`ci`・`changelog`)。動詞を無理に付けない。

### 3. 可変長引数は小文字 `*args` で pass-through

下位ツールにフラグをそのまま渡したいときは末尾に `*args` を置く。
実測した OSS はすべて小文字 `*args` / `+args`。大文字 `*ARGS` は使わない
(位置引数 `server` / `version` などと casing を揃えるため)。

```just
# Run the test suite; extra flags pass through (e.g. just test -k slow)
test *args:
    pytest {{args}}
```

### 4. コメントは英語の 1 行 doc-comment

recipe 直上の `#` コメントは `just --list` にそのまま説明として表示される
— つまり recipe の UI。英語で、命令形の短い 1 行にする
("Run the test suite"、"Deploy the API to production")。何をするかだけを書き、
なぜその実装かの弁明は書かない (それは PR / コード側の管轄)。

### 5. `[group(...)]` は recipe が増えてから

grouping は `just --list` の見た目を整えるための presentation であって必須ではない。
recipe が数本のうちは group を付けず、増えて一覧が読みにくくなってから導入する。

```just
[group('db')]
db-migrate:
    ...
```

大型でも group 属性を使わず `# ---- db ----` のような section コメントだけで
区切る OSS もある (oxc がこれ)。どちらでもよいが、片方に統一する。

### 6. recipe にするのは手間を減らす動作だけ

native を 1 発叩くだけの recipe は作らない。recipe にするのは次のどれかに当たるものだけ:
(a) 複数コマンドの組み合わせ、(b) 忘れやすい flag / path を固定するもの、
(c) `just --list` に入口として並べたいもの (`build` / `test` / `check` のような定番動作)。
引数を転送するだけの recipe (`just add X` → `bun add X`) は just を覚える手間が増えるだけ。

```just
# bad: forwards args to a native subcommand, adds nothing
add *args:
    bun add {{args}}

# good: pins flags that are easy to forget
# Run the test suite; extra flags pass through
test *args:
    cargo test --all-features {{args}}
```

実測した OSS でも `*args` を取る recipe は必ず flag / env / path を足している
(oxc の `test` / `lint` / `doc` は flag・env、sway の `run-tests` は script path)。素の 1 行 recipe は
eza の `build: cargo build` のような入口用途 (c) だけ。再構築では既存 recipe を消さない
(挙動を変えない) — 該当しそうなものは削除候補として報告に留める。

## 手順

1. 対象を把握する。新規なら実行したい動作を洗い出す。既存なら recipe を 1 本ずつ読み、
   名前・引数・default・コメントを上の 6 ルールに照合する
2. 引数なし `just` で一覧が出るよう、先頭に private `_default` を置く (ルール 1)
3. 各 recipe 名を verb / verb-noun kebab に直す。status / report 系だけ noun を許す (ルール 2)
4. 下位ツールへ渡す可変長引数を小文字 `*args` に統一する (ルール 3)
5. 各 recipe 直上に英語 1 行の doc-comment を付ける (ルール 4)
6. recipe 数を見て group の要否を判断し、使うなら `[group(...)]` かコメント section の
   どちらかに統一する (ルール 5)
7. 新しく足す recipe がルール 6 の (a)(b)(c) のどれかに当たるか確かめ、引数を転送するだけの
   recipe は作らない。再構築では既存の該当 recipe を削除候補として報告する (ルール 6)
8. 提出前に「完了チェック」を 1 項目ずつ機械的に検査する

## 完了チェック

- [ ] 先頭に private な `_default` があり `just --list` を呼ぶ (裸の `just` が何も実行しない)
- [ ] recipe 名が verb / verb-noun kebab。名詞は status / report 系だけ
- [ ] 可変長引数がすべて小文字 `*args`。大文字 `*ARGS` が 1 つもない
- [ ] 各 recipe 直上に英語 1 行の doc-comment がある
- [ ] recipe が少数なら group なし。多いなら `[group(...)]` かコメント section の一方に統一
- [ ] 新しく足した recipe に、引数を転送するだけの recipe が無い
- [ ] 個人的な癖 (emoji の状態記号・罫線 divider・過剰な安全ガード) を持ち込んでいない
