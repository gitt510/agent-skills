---
name: github-pr-reply-guard
description: >
  Operational guard against replying to the wrong thread when responding to GitHub PR review
  comments. Use when replying to review comments, reporting fixes, or resolving threads —
  especially when a comment URL and comment ID are involved: confirm the ID from
  pulls/:pr/comments and verify in_reply_to_id after replying. Also covers the GraphQL
  fallback for when a pending review makes the REST reply API fail.
---

# GitHub PR Reply Guard

## Goal

PR review thread への返信誤爆を防ぎ、返信結果を検証可能な形で残す。

## Workflow

1. PR と対象コメントを特定する

- 入力として PR 番号と対象コメント URL かコメント本文を受け取る。
- URL がある場合は `discussion_r<id>` から候補 ID を抽出する。

2. Review comment の一次情報を取得する

- 必ず `gh api repos/<owner>/<repo>/pulls/<pr>/comments` を使い、`id`,
  `in_reply_to_id`, `path`, `body`, `html_url` を取得する。
- `pull_request_read.get_review_comments`
  のみで完結させない。ID が欠落する可能性がある。
- URL が `discussion_r<id>` の場合も、最終的な親 comment ID はこの一覧で確定する。

3. 返信先 ID を確定する

- 優先順位:
  - `html_url` 完全一致
  - `id` 一致
  - `path` + 本文冒頭一致（最終手段）
- 候補が複数ある場合は推定返信しない。候補一覧を出してユーザー確認する。
- GraphQL fallback を使う可能性があるため、必要なら review thread ID も取得する。
  - `reviewThreads { nodes { id comments { nodes { databaseId url } } } }`
  - `databaseId == parent comment id` を含む thread を返信先 thread とする。

4. 返信を投稿する

- 既定は review comment への reply API を使う。
- ただし `user_id can only have one pending review per pull request` などで
  REST reply API が失敗した場合は、GraphQL の
  `addPullRequestReviewThreadReply` を使う。
- reply body は `\n` 文字列を埋め込まない。actual newline を渡す。
  - 推奨: here-doc で body を組み立てて `-F body="$body"` で渡す
  - 非推奨: `-f body='line1\n\nline2'`

5. 投稿結果を検証する

- REST reply API を使った場合:
  - 返却の `in_reply_to_id` が意図した親コメント ID と一致することを確認する。
- GraphQL thread reply を使った場合:
  - 返却の `comment.url` を記録する。
  - thread 再取得で、意図した thread に reply が追加されていることを確認する。
  - `author`, `body`, `url` を再取得して thread 取り違えがないことを確認する。
- `html_url` または `comment.url` を必ず記録して、ユーザーへ共有する。

## Guardrails

- 推測 ID で返信しない。
- PR 全体コメント (`issue comment`) で代替する場合は、thread
  reply 不能な理由を明記する。
- pending review に遭遇したら、黙って issue comment に逃げない。先に thread
  reply 可能な経路を試す。
- 返信後の検証を省略しない。
- body の改行は投稿前に actual newline になっていることを確認する。

## Output format

- `target`: owner/repo#pr, parent comment id
- `result`: posted / skipped / blocked
- `proof`: reply `html_url` or `comment.url`, `in_reply_to_id` or `thread id`
- `note`: fallback 実施時の理由

## Quick commands

```bash
# Review comment 一覧（ID付き）
gh api repos/<owner>/<repo>/pulls/<pr>/comments \
  --jq '.[] | {id,in_reply_to_id,path,html_url,body}'

# 特定IDの確認
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>

# review thread 一覧と parent comment の対応確認
gh api graphql -f query='
query {
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <pr>) {
      reviewThreads(first: 100) {
        nodes {
          id
          comments(first: 20) {
            nodes {
              databaseId
              url
            }
          }
        }
      }
    }
  }
}'

# actual newline を保って GraphQL thread reply
body=$(cat <<'"'"'EOF'"'"'
1行目

2行目
EOF
)
gh api graphql \
  -f query='mutation($thread:ID!, $body:String!) { addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$thread, body:$body}) { comment { url } } }' \
  -f thread='<thread_id>' \
  -F body="$body"
```
