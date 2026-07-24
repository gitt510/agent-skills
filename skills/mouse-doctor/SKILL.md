---
name: mouse-doctor
description: >
  Diagnose and recover mouse clicks that suddenly stop working across macOS apps in setups
  using LinearMouse or Karabiner-Elements. Inspect system load and the relevant input processes
  before restarting anything, then restore them in priority order. Use when clicks stop
  responding app-wide and at least one of those tools is installed.
---

# Mouse Doctor

macOS で「全アプリでクリックが効かない」を直すための診断フロー。LinearMouse または
Karabiner-Elements が入っている環境を対象に、**macOS の入力経路の劣化**を
有力候補として切り分ける。どちらも入っていない場合は、この runbook の対象外として
hardware・接続・権限の通常診断へ切り替える。

## なぜクリックが死ぬのか（この理解が誤診を防ぐ）

LinearMouse と Karabiner-Elements は、異なる方法で macOS の入力経路に入る：

- **LinearMouse** — event tap を使ったポインタ加速・速度・スクロール調整
- **Karabiner-Elements** — Core-Service による device grab とキー remap

システム負荷や swap thrash で event-tap callback が遅れると、macOS が tap を無効化する
ことがある。アプリが tap を再作成しても負荷が続けば再発するため、click が失われている
ように見える。これは有力な作業仮説であり、特定ツールの欠陥や唯一の原因と断定しない。

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
```

読み方：

- **LinearMouse の version が古い / `%CPU` が高止まり** → LinearMouse の tap latency が主犯の疑い
  がある。
- **Karabiner Core-Service が長時間 uptime のまま**（前回のクラッシュ以降ずっと同じ PID） →
  劣化した tap 状態を抱えている疑い。再起動でリセットできる。
- **空きメモリが低い / swap が大きく使われている** → メモリ逼迫が引き金。
  上位プロセス（ブラウザ等）が真の主犯。
- **load average がコア数を大きく超えている**（目安：数倍以上）→ メモリに余裕があっても
  **純粋な CPU 飢餓**で tap timeout する。1分平均 ≫ 15分平均なら直近スパイク中。
  browser renderer、terminal session、agent process など、同種の process が積み上がって
  いないか診断 #5 で確認する。

計測の限界を正直に：**tap latency やリーク tap 数を直接測る手段は確立していない**。
上の proxy 指標（version・CPU累積・uptime・メモリ）で切り分ける。「Core-Service 再起動で
回復」は tap 劣化説と整合するが断定ではなく推定、という前提で進める。

## 直す（優先順）

### 0. まず「もう直っていないか」を確認する

負荷スパイクが去れば**操作なしで自己回復することがある**。診断時点で load が既に
下がっているなら、再起動の前にまずクリックを試す。直っていれば以降の手は不要で、
残る仕事は負荷の主犯の後始末だけ。

### 1. Karabiner Core-Service を再起動（最頻の当たり）

劣化した tap をリセットする、いちばん効く一手。以下のどれでもよい：

- 一番楽 → Karabiner メニューの **「Restart Karabiner-Elements」**
- user agent（**sudo 不要**）:
  ```bash
  launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Core-Service-rev2
  ```
- root daemon（**sudo が要る**ため、理由を説明して user 自身に実行してもらう）:
  ```bash
  sudo launchctl kickstart -k system/org.pqrs.service.daemon.Karabiner-Core-Service
  ```

label が版で違うことがある。失敗したら `launchctl list | grep -i karabiner` で実 label を
確認してから叩き直す。

### 2. LinearMouse を再起動 / 更新

version が古い、または `%CPU` が高いときは、app を終了してから開き直す。更新する場合は
package manager で管理されていることを先に確認する：

```bash
open -a LinearMouse
brew upgrade --cask linearmouse
```

### 3. 負荷を解消（真の引き金）

診断 #4（メモリ）/ #5（CPU）の上位プロセスを確認し、不要なものだけを user の同意を得て
閉じる。負荷が取れれば tap の timeout ループも止まる。ここを放置すると tap を
リセットしても再発する。

## やってはいけないこと（誤診の罠）

- ❌ **Core-Service が2本あるのを「重複」と誤認して kill しない。** root daemon
  （`org.pqrs.service.daemon.Karabiner-Core-Service`）と user agent
  （`...service.agent.Karabiner-Core-Service-rev2`）の**2本が正常形**。daemon は keepalive で
  即再湧きするので、片方 kill は混乱の元。直すなら「kill」ではなく上記の「clean restart」。
- ❌ **「メモリ逼迫 = Karabiner のメモリ」と説明しない。** Karabiner 関連 process の RSS が
  上位に現れていなければ、逼迫は**システム全体**の話として上位プロセスを調べる。
- ❌ **設定の管理場所や適用方法を推測しない。** 実際の config path と管理手段を
  read-only で確認してから判断する。
- ❌ **設定の reload と service の再起動を同一視しない。** reload command が event tap を
  作り直すかは、その command の実装を確認する。
- ❌ **切り分け前に Karabiner の uninstall / 無効化を提案しない。** 既存 remap の影響を
  確認し、より限定的な service restart を先に試す。
- ❌ **sudo を非対話で実行しない。** root が必要な command は理由と影響を説明し、
  user 自身に実行してもらう。

## 直ったら確認する

fix 後に**同じ read-only 診断を再実行**して、狙った指標（Core-Service の PID が新しくなった／
LinearMouse の CPU が落ちた／空きメモリが戻った）を確認し、実際にクリックできることを確かめる。

## 個別ボタンだけ効かないとき（別件）

「全アプリで全クリックが死ぬ」ではなく「特定マウスの特定ボタンだけ効かない」なら event-tap の
劣化ではなく **button remap** を疑う。対象 device の実際の設定を read-only で確認し、
button identifier と割り当て先が意図どおりか調べる。device model、config path、
button number、割り当て内容を固定値として仮定しない。
