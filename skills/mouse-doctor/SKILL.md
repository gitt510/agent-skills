---
name: mouse-doctor
description: >-
  macOS で全アプリのマウスクリックが突然効かなくなったときに、原因を event-tap chain
  （LinearMouse + Karabiner-Elements）の劣化として切り分け、優先順に復旧する診断医。
  「クリックが効かない」「クリックが効かなくなった」「マウスが効かない」「マウスクリックが反応しない」
  「mouse-doctor」と言われたとき、あるいは全アプリで click / mouse button が反応しないと
  報告されたときは、ツール名が挙がっていなくても迷わず使う。ハード故障や権限を疑う前に、
  まずこの skill で event-tap の劣化を切り分ける。
---

# Mouse Doctor

macOS で「全アプリでクリックが効かない」を直す。ハードや権限の前に、**入力が通る
event-tap chain の劣化**を第一に疑うための診断フロー。

## なぜクリックが死ぬのか（この理解が誤診を防ぐ）

マウスのクリックは macOS の **event tap（入力フックのチェーン）** を通ってアプリに届く。
たいちゃんの環境ではこのチェーンに **2つのツールが tap を差し込んでいる**：

- **LinearMouse** — ポインタ加速・速度・スクロール調整
- **Karabiner-Elements** — キー remap（Core-Service が入力を grab）

event tap には **timeout** があるのが肝。システムが重い（メモリ逼迫の swap thrash でも、
メモリに余裕があっても純粋な CPU 負荷スパイクでも起こる）と、
tap の callback を処理するプロセスが**時間内に CPU をもらえず**、callback が timeout を超過する。
すると macOS が「この tap は遅い」と判断して **tap を無効化** → アプリが tap を作り直す →
また間に合わない…をループし、**死んだ tap がリークして click が捨てられる**。

つまり犯人は「メモリ量」ではなく「**スケジューリング飢餓 → tap timeout**」。だから
軽量なツールでも巻き込まれるし、event tap を使う全ツール共通の macOS 仕様であって、
特定ツールの欠陥ではない。

## まず read-only で切り分ける

原因を決めてから直す。この診断ブロックはすべて非破壊：

```bash
echo "=== 1. LinearMouse: version / CPU累積 / uptime ==="
ps -Ao pid,%cpu,time,etime,comm | grep "[L]inearMouse"
defaults read /Applications/LinearMouse.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null

echo "=== 2. Karabiner Core-Service（正常形は root daemon + user agent の2本）==="
ps -Ao pid,user,etime,%cpu,comm | grep "[K]arabiner-Core-Service"

echo "=== 3. システム全体のメモリ / swap / load（tap timeout の引き金）==="
memory_pressure 2>/dev/null | grep -i "free percentage"
sysctl -n vm.swapusage
uptime
sysctl -n hw.ncpu   # load average はコア数と比べて読む

echo "=== 4. メモリを食っている上位プロセス（逼迫の主犯特定）==="
ps -Ao rss,pid,comm -r | head -6 | awk '{printf "%6.1f MB  %s\n",$1/1024,$3}'

echo "=== 5. CPU を食っている上位プロセス（飢餓の主犯特定）==="
ps -Ao %cpu,pid,comm -r | head -8
ps -Ao pid,%cpu,etime,comm -r | grep -c "[c]laude"   # claude セッション数
```

読み方：

- **LinearMouse の version が古い / `%CPU` が高止まり** → LinearMouse の tap latency が主犯の疑い
  （過去に古い版で 2.7秒/イベントの実測あり）。
- **Karabiner Core-Service が長時間 uptime のまま**（前回のクラッシュ以降ずっと同じ PID） →
  劣化した tap 状態を抱えている疑い。再起動でリセットできる。
- **空きメモリが低い / swap が大きく使われている** → メモリ逼迫が引き金。
  上位プロセス（ブラウザ等）が真の主犯。
- **load average がコア数を大きく超えている**（目安：数倍以上）→ メモリに余裕があっても
  **純粋な CPU 飢餓**で tap timeout する。1分平均 ≫ 15分平均なら直近スパイク中。
  実例（2026-07-22）：8コアで load 61、メモリ free 39% のままクリックが死んだ。
  主犯は claude セッション 9 個（うち 2 個が CPU 72%/44%）+ Chrome renderer 群。
  **claude セッションの積み上がりは典型犯** — 診断 #5 のセッション数を必ず見る。

計測の限界を正直に：**tap latency やリーク tap 数を直接測る手段は確立していない**。
上の proxy 指標（version・CPU累積・uptime・メモリ）で切り分ける。「Core-Service 再起動で
回復」は tap 劣化説と整合するが断定ではなく推定、という前提で進める。

## 直す（優先順）

### 0. まず「もう直っていないか」を確認する

負荷スパイクが去れば**操作なしで自己回復することがある**。実例（2026-07-22）：
load 61 → 3 に沈静化しただけで、Karabiner / LinearMouse の PID 据え置きのまま
クリックが復活した（timeout で無効化された tap をアプリが作り直し、負荷が去った後は
それが生き残る）。診断時点で load が既に下がっているなら、再起動の前にまず
クリックを試す。直っていれば以降の手は不要で、残る仕事は負荷の主犯の後始末だけ。

### 1. Karabiner Core-Service を再起動（最頻の当たり）

劣化した tap をリセットする、いちばん効く一手。以下のどれでもよい：

- 一番楽 → Karabiner メニューの **「Restart Karabiner-Elements」**
- user agent（**sudo 不要**）:
  ```bash
  launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Core-Service-rev2
  ```
- root daemon（**sudo が要る** → プロンプトで `!` 実行して user に叩いてもらう）:
  ```
  ! sudo launchctl kickstart -k system/org.pqrs.service.daemon.Karabiner-Core-Service
  ```

label が版で違うことがある。失敗したら `launchctl list | grep -i karabiner` で実 label を
確認してから叩き直す。

### 2. LinearMouse を再起動 / 更新

version が古い、または `%CPU` が高いとき：

```bash
open -a LinearMouse                    # 再起動で tap を作り直す
brew upgrade --cask linearmouse        # 更新（brew cask 管理）
```

### 3. 負荷を解消（真の引き金）

診断 #4（メモリ）/ #5（CPU）の上位プロセスを閉じる。典型はブラウザ（Firefox/Chrome）と
使っていない claude セッション。負荷が取れれば tap の timeout ループも止まる。
ここを放置すると tap をリセットしても再発する。

## やってはいけないこと（誤診の罠）

- ❌ **Core-Service が2本あるのを「重複」と誤認して kill しない。** root daemon
  （`org.pqrs.service.daemon.Karabiner-Core-Service`）と user agent
  （`...service.agent.Karabiner-Core-Service-rev2`）の**2本が正常形**。daemon は keepalive で
  即再湧きするので、片方 kill は混乱の元。直すなら「kill」ではなく上記の「clean restart」。
- ❌ **「メモリ逼迫 = Karabiner のメモリ」と説明しない。** Karabiner 一族の実 RSS は合計
  ~124MB（16GB の1%未満）で誤差。逼迫は**システム全体**（ブラウザ等）の話。
- ❌ **LinearMouse 設定を dotfiles で探さない。** SoT は `~/.config/linearmouse/linearmouse.json`
  で **dotfiles 管理外**。
- ❌ **dotfiles の `just apply-karabiner` を疑わない。** これは `karabiner_cli --select-profile` の
  ソフト reload だけで、daemon 再起動も tap leak も起こせない。
- ❌ **切り分け前に Karabiner の uninstall / 無効化を提案しない。** 本設定（hyper layer /
  F-key layer / tmux prefix / terminal 用 ⌘→⌃ 等）は代替困難。切る候補にするなら、latency の
  主犯になりやすい **LinearMouse** の側を先に検討する。
- ❌ **sudo を非対話で実行しようとしない。** このセッションでは sudo に password が要るので、
  root が必要な手は必ず `!` prefix コマンドとして user に提示する。

## 直ったら確認する

fix 後に**同じ read-only 診断を再実行**して、狙った指標（Core-Service の PID が新しくなった／
LinearMouse の CPU が落ちた／空きメモリが戻った）を確認し、実際にクリックできることを確かめる。

## 個別ボタンだけ効かないとき（別件）

「全アプリで全クリックが死ぬ」ではなく「特定マウスの特定ボタンだけ効かない」なら event-tap の
劣化ではなく **LinearMouse のボタン remap** を疑う。`~/.config/linearmouse/linearmouse.json` で
ERGO M575 / MX Ergo の **button 3 → Cmd+W** マッピングが入っている。意図しないボタンに
当たっていないか確認する。
