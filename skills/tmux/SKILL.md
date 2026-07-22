---
name: tmux
description: "Control tmux panes for interactive CLIs: capture pane output and send keys/text. Targets the current window by default."
metadata:
  openclaw:
    emoji: "🧵"
    os:
      - darwin
      - linux
    requires:
      bins:
        - tmux
    install:
      - id: brew
        kind: brew
        formula: tmux
        bins:
          - tmux
        label: "Install tmux (brew)"
---

# tmux

Use for existing interactive tmux sessions. For one-shot commands, use normal shell. For new non-interactive background jobs, use background execution.

## Target

Target the **window where this session runs** — not the session's active window.

A bare relative target like `.1` is a trap. tmux fills the omitted window with the session's **current (active) window** — whatever window the attached client is showing — which is usually NOT the window Claude runs in. `$TMUX_PANE` only fixes the *session*, never the window. So `.1` silently drifts to another window's pane 1 whenever the user is looking elsewhere.

Anchor to Claude's own pane instead. `$TMUX_PANE` is set in this session's env; resolve it to a `session:window` prefix and build an absolute target:

```bash
W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')
# then target panes as "$W.1", "$W.2", ...
```

Each Bash call is a fresh shell, so set `W` in the same command block where you use it.

To reach a different window or session on purpose, use an explicit `session:window.pane`, e.g. `shared:0.0`.

List the panes in Claude's window:

```bash
W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')
tmux list-panes -t "$W"
```

## See

```bash
W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')
tmux capture-pane -t "$W.1" -p          # current screen
tmux capture-pane -t "$W.1" -p -S -     # full scrollback
tmux capture-pane -t "$W.1" -p | tail -20
```

`-p` prints to stdout. `-S -` includes scrollback (bounded by `history-limit`). Full-screen apps (vim, less) show only the current screen, not past output.

## Send

Send literal text and Enter separately, to avoid paste/newline surprises:

```bash
W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')
tmux send-keys -t "$W.1" -l -- "Please continue"
tmux send-keys -t "$W.1" Enter
```

Special keys (set `W` first, as above):

```bash
tmux send-keys -t "$W.1" C-c
tmux send-keys -t "$W.1" C-d
tmux send-keys -t "$W.1" Escape
```

Use `-l --` for arbitrary literal text. Approve or select a prompt only after reading it:

```bash
W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')
tmux capture-pane -t "$W.1" -p | tail -20   # read first
tmux send-keys -t "$W.1" -l -- "y"
tmux send-keys -t "$W.1" Enter
```

## Notes

- Target format is `session:window.pane`. A bare `.pane` resolves the omitted window to the session's **active window**, NOT to `$TMUX_PANE`'s window — so it drifts. Always anchor with `W=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}')` and target `"$W.pane"`.
- `capture-pane -p` prints to stdout. `-S -` captures full scrollback.
