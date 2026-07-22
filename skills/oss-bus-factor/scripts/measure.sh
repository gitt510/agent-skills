#!/usr/bin/env bash
# scripts/measure.sh — OSS bus factor の 3 軸生データを JSON で出す
#
# Usage: scripts/measure.sh <owner>/<repo>
#
# Output: stdout に単一 JSON object。LLM はこれを解釈するだけで、API
# 呼び出しや集計を自前でやり直さない。
#
# Axes:
#   org_meta — structural potential (静的 snapshot)
#   cadence  — actual liveness (直近 30d / 90d)
#   merger   — merge 権限の bus factor (bot 除外)

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <owner>/<repo>" >&2
  exit 2
fi

repo="$1"
owner="${repo%%/*}"

# BSD date (macOS) と GNU date (Linux) の両対応。
since_30d=$(date -u -v-30d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)
since_90d=$(date -u -v-90d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -d '90 days ago' +%Y-%m-%dT%H:%M:%SZ)

# --- 軸 1: org meta ---
# users/<owner> は User でも Organization でも created_at を返すので、owner_age
# はここから取る。org 固有 (description / blog / public_repos / members) は
# orgs/<owner> から取る。
owner_json=$(gh api "users/$owner" 2>/dev/null || echo '{}')
owner_type=$(echo "$owner_json" | jq -r '.type // "Unknown"')
owner_created_at=$(echo "$owner_json" | jq '.created_at // null')
if [ "$owner_type" = "Organization" ]; then
  org_meta=$(gh api "orgs/$owner" --jq '{description, blog, public_repos}')
  member_count=$(gh api "orgs/$owner/members" --paginate --jq 'length' \
    | awk '{s+=$1} END {print s+0}')
else
  org_meta='{}'
  member_count=0
fi

# --- 軸 2: cadence ---
# repo_created_at は project の track record、pushed_at は最終活動。両方欲しい。
repo_meta=$(gh api "repos/$repo" --jq '{repo_created_at: .created_at, pushed_at, archived, disabled}')
commits_30d=$(gh api "repos/$repo/commits?since=$since_30d&per_page=100" --paginate --jq 'length' \
  | awk '{s+=$1} END {print s+0}')
commits_90d=$(gh api "repos/$repo/commits?since=$since_90d&per_page=100" --paginate --jq 'length' \
  | awk '{s+=$1} END {print s+0}')
releases=$(gh api "repos/$repo/releases?per_page=10" \
  --jq '[.[] | {tag: .tag_name, at: .published_at, by: .author.login}]')

# --- 軸 3: merger 分布 (bot 除外) ---
# pulls の list API は merged_by を返さない (単体 PR endpoint のみ) ので、
# mergedBy を返せる gh pr list を使う。
merger_hist=$(gh pr list --repo "$repo" --state merged --limit 100 \
  --json mergedBy \
  --jq '[.[] | select(.mergedBy and (.mergedBy.is_bot | not)) | .mergedBy.login]
        | group_by(.) | map({login: .[0], count: length}) | sort_by(-.count)')
merger_total=$(echo "$merger_hist" | jq '[.[].count] | add // 0')
merger_top_share=$(echo "$merger_hist" | jq --argjson t "$merger_total" \
  'if $t == 0 then 0 else (.[0].count / $t * 100 | floor) end')

jq -n \
  --arg repo "$repo" --arg owner_type "$owner_type" \
  --argjson owner_created_at "$owner_created_at" \
  --argjson org_meta "$org_meta" --arg members "$member_count" \
  --argjson repo_meta "$repo_meta" --arg c30 "$commits_30d" --arg c90 "$commits_90d" \
  --argjson releases "$releases" \
  --argjson merger_hist "$merger_hist" --arg merger_total "$merger_total" --arg top_share "$merger_top_share" \
  '{
    repo: $repo,
    org_meta: ($org_meta + {owner_type: $owner_type, owner_created_at: $owner_created_at, public_members: ($members|tonumber)}),
    cadence: ($repo_meta + {commits_30d: ($c30|tonumber), commits_90d: ($c90|tonumber), releases: $releases}),
    merger: {distribution: $merger_hist, total: ($merger_total|tonumber), top_share_pct: ($top_share|tonumber)}
  }'
