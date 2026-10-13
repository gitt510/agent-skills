# hd が何も表示しない問題の修正

## 概要

先日の会話で報告があったとおり、main ブランチ上で untracked ファイルだけがある状態で `hd` を実行しても何も表示されないという問題がありました。正直なところ、これはかなり分かりにくい挙動だったと思います。

この PR では、`_hunk_diff_target` 関数を修正して、ahead のコミットが無い場合に working tree review へフォールバックできるようにしたいと思います。

## 実装の詳細

`_hunk_diff_target` はまず `git symbolic-ref` で origin のデフォルトブランチを取得します。次に `git rev-list --count origin/$base..HEAD` で ahead のコミット数を数え、これが 0 の場合は何も echo せずに return します。呼び出し側の `hunk_diff_all` では `$target` が空リストになるため、`hunk diff` が引数なしで実行され、working tree review モードになります。

ちなみに hunk の working tree review は untracked ファイルを含みます（`--exclude-untracked` オプションで除外することも可能です）。

## 関連 issue

- #42 (hunk の theme 設定を dotfiles で管理する)

## その他

- 検証は dotfiles repo と使い捨て repo で実施しました
- fish の abbr の仕組みについては README.md を参照してください。abbr は conf.d/abbr.fish で定義され、`hd` → `hunk_diff_all` のように展開されます
