# Marugoto 听力字幕网页播放器 — 交接文档

## 当前状态（2026-10-27）：全 18 课已完成并验证；字幕已规范化，UI 已美化

网页播放器可用，地址：http://127.0.0.1:8765/web/index.html
（本地服务器：`python3 -m http.server 8765 --bind 127.0.0.1`，需从项目根目录启动；若端口失效需重启）

## 2026-10-27 新增：字幕文本规范化（数字阿拉伯化 + 大小写统一）

### tools/normalize_transcripts.py（已 --apply，80 个文件改动）

- 跨度替换引擎：所有规则产出文本区间 (start,end,repl)，同一区间同时应用到 seg.text 和 words 词列表（跨词区间合并 token、词内区间原地改），全语料 1834 段已验证 `text == "".join(words)`，两者必然一致；改后有断言复查
- 规则1 汉字数字→阿拉伯：七時半→7時半、四人→4人、十月二十八日→10月28日；跨 token 数字（二|十|八）合并成 28；与阿拉伯数字相邻不动（5万円 保持）；固定词保护：一緒/一度/一番/万一/一流/同一/一人/二人/新一（田中新一是人名）
- 规则2 假名数字报幕→数字：仅限整句是纯数字（なな→7，含 な+な 分词）或段首+顿号/空格（に こんにちは→2 こんにちは）；句中助词/敬称不动（キムさん、お先に失礼します 已验证未误伤）；五十音背诵（か 木 ク ケ コ）不动
- 规则2b 片假名数字：ページ 前（サンページ→3ページ）、Can-do 报幕尾（キャンローキュー→キャンドゥー9）
- 规则3 孤立小写拉丁字母→大写（f 公園で→F、t シャツ→T シャツ、sa113_2 的 f/g/h/i 选项→F/G/H/I）
- 规则4 Can-do 听写统一 キャンドゥー（キャンデュー/キャンドゥ/キャンロー）
- 改了转录后必须依次重跑：`build_app_data.py` → `build_readings.py`（后者原地追加注音）

### 配套修复

- `build_app_data.py` 末尾自动把 `web/index.html` 里 `data.js` 引用打上 `?v=<时间戳>`，重建数据后浏览器普通刷新即可拿到新数据（WKWebView 子资源缓存很顽固，之前刷新拿不到新字幕）
- `build_readings.py` 的 `WORD_FIX` 增补汉字+数字混合词：第1→だいいち、1個→いっこ；当前覆盖率 annotated 10752/11737，kanji 3066/3066

### 验证

- dry-run 全量人工审过两轮；应用后浏览器实测：002-1「第1か。…1、…2、」+ ruby だいいち、L9「A 6時半におきます」「1時、2時…12時」、假名开关与练习弹窗正常
- data.js 反向扫描：残留汉字数字仅剩保护词（一番/一度/一人/二人/一緒/新一）与 5万円

## 2026-10-27 新增：UI 美化（暖纸底色 + Marugoto 品牌红）

- `web/style.css` 整体重写：设计令牌集中在 `:root`（--bg #f3f1ec 暖纸底、--accent #c2255c 品牌红、--accent-2 #3b5bdb 注音靛蓝、--accent-soft 粉色高亮）；面板白底 12px 圆角 + 分层阴影
- 顶栏：`::before` 画红底「ま」logo 方块（index.html 品牌文字已包进 div 配合）；三个开关改大号自定义 switch；课程 tab 改分段控件（灰底容器 + 白底激活 pill，横向滚动）
- 音轨列表：当前轨粉色底 + 左侧红条 + ♪；字幕句 19px、激活句粉底红条、逐词黄色高亮（--active-word）；ruby 注音靛蓝
- 播放条：播放键 46px 圆形红底带阴影；seek 条自定义 webkit 样式，因无原生填充色，由 `app.js` 的 `setSeek(v)` 用 linear-gradient 背景画红色填充（timeupdate 与切轨时都调它）
- 练习弹窗：backdrop-filter 模糊背景，答错红框 + ✗，答对绿框 + ✓
- 修复 bug：切课/切轨后 seek 滑块与渐变填充停留在上一轨位置（timeupdate 未触发时不复位）——`loadTrack` 里重置 `timeCur` 并 `setSeek(0)`
- 宽屏（>1020px）三栏 288px/1.1fr/1.3fr，窄屏单列堆叠；已浏览器实测：播放高亮、假名开关、练习对错流程、连播、切轨 seek 归零均正常
- 注意：改 css/js 后必须递增 `index.html` 里的 `?v=`（当前 style/app 为 20261027-2），否则 WKWebView 拿旧缓存

## 2026-10-26 新增：假名注音 + 汉字练习游戏

### 功能

- 字幕中所有含汉字的词以 `<ruby>` 显示假名注音；顶栏「假名」开关（#furigana）切换显隐（`.hide-furi rt { visibility:hidden }`，保留占位不跳动）
- 课本面板「练习」按钮（#drillBtn）打开汉字假名练习弹窗：每课从 transcript 收集含汉字且有读音的词，按出现频率取 top40 再随机抽 10 题；答对显示 ✓ + ruby 读音 + 700ms 自动下一题；答错显示 ✗ + shake 动画 + 选中输入框重输；结束页显示得分与「再来一次」；片假名答案自动转平假名判定

### 注音数据生成（tools/build_readings.py）

- 在 build_app_data.py 生成的 data.js 上原地追加每词第 4 元素（平假名读音或 null）；若重跑 build_app_data.py 必须再跑 build_readings.py
- 机制：fugashi/MeCab(unidic-lite) 对拼接 surface 分词，whisper 词按字符偏移对齐 token；用 `feature.kana`（とうきょう）而非 pron（とーきょー）
- `kana_spans()`：等长 1:1；否则送り仮名前后缀对齐 + 中间汉字块比例切分；`token_chars()`：纯汉字多字 token 用每字单独读音在 pool 匹配，`KANJI_ALT` 提供音读候选（東→とう、午→ご、前→ぜん、人→にん、日→か 等），命中前的 kana 前缀按比例分给前面未匹配字（東京→東=とう、京=きょう）
- `WORD_FIX` 修词典默认与课堂读音差异：私→わたし、僕→ぼく、昨日→きのう、今日→きょう、明日→あした；数字词不注音
- 覆盖率：annotated 10954/11830 words，kanji words 3138/3138
- 语境验证：午前→前=ぜん、土曜→土=ど、土産→土=みや、人形→人=にん、来週→来=らい、来ます→来=き、1日目→日=か、九→ここの

### 验证结果

- 字幕 ruby 渲染正常（如「国際交 流 基金、…丸ごと日本の言葉と文化、入門、活動」全部注音正确）；「假名」开关切换显隐即时生效
- 练习弹窗：打开/关闭（X 按钮）正常；答错显示 ✗ 红色 + ✗计数 + 输入框选中重输；答对显示 ✓ 绿色 + ruby 注音 + 自动下一题；进度 `1 / 10　✓ 1　✗ 1` 正确
- 修复：`.drill-overlay` 的 `display:flex` 覆盖 `[hidden]`，补 `.drill-overlay[hidden]{display:none}`

## 覆盖范围

- 全部 18 课 + Can-do 复习（p.116-125），共 385 个音轨（sa001-sa271，部分拆分为 _1/_2 条）
- 每课音轨数：L1=12, L2=20, L3=26, L4=25, L5=24, L6=24, L7=19, L8=24, L9=27, L10=14, L11=16, L12=19, L13=21, L14=19, L15=23, L16=29, L17=23, L18=20
- 正课页码窗口：L1=22-25, L2=26-30, L3=31-35, L4=36-40, L5=41-45, L6=46-50, L7=51-55, L8=56-60, L9=61-65, L10=66-70, L11=73-77, L12=78-83, L13=84-87, L14=88-93, L15=94-97, L16=98-103, L17=104-107, L18=108-113
- 每课 Can-do 页已并入课程的浏览页列表（页码指示器与缩略图条可翻到 Can-do 页）

## 产出

- `web/index.html` / `style.css` / `app.js`：三栏播放器（音轨列表 | 同步字幕 | 课本页面图），底部播放条；连播、跟随滚动、变速、快捷键（空格/方向键）
- `web/data.js`：385 音轨数据（whisper 词级时间戳 + 课本页码映射），由 `tools/build_app_data.py` 生成（487KB）
- `transcripts/sa*.json`：385 个 mp3 的 whisper small 转录（language=ja, word_timestamps）
- `audio_files/MarugotoStarterActivitiesMp3Lesson01..18/`：每课一文件夹，共 385 个唯一 mp3
- `pdf_pages/page-001..147.jpg`：课本扫描页图，PDF 页码 = 课本印刷页码
- `docs/ocr_pages.json`：147 页 Vision OCR 结果

## 页码映射机制（build_app_data.py）

- `build_chip_pages()` 从 OCR 文本提取课本上的音轨编号 chip（"045" 独立行 / "047-051" / "111・112" 等范围写法）
- 正课页 chip 须整行匹配（fullmatch），防止误匹配正文价格等三位数；页脚页码本身等于三位数文本时跳过
- Can-do 页（p.116-125）chip 混入正文，用 search 任意位置；分隔符 `-–~・.。` 均按范围展开（如 "241.243" = 241–243）
- `track_page()` 限定在当课页码窗口内选页；Can-do 轨（sa233-271）映射到 p.116-125
- 人工补漏：`MANUAL_PAGE = {1:22, 22:29, 23:29, 111:58, 112:58}`（OCR 漏 chip）
- 校验：385 轨全部有页码、正课 0 条出窗、41 条 Can-do 全部落在 116-125

## 已验证（浏览器实测）

- 18 个课程 tab 渲染正常（横向滚动），第 9/16/18 课抽查通过
- 自动播放推进、当前句高亮 + 跟随滚动、页面图随音轨切换（sa113_1→p.62、sa224_2→p.109、sa266_1→Can-do p.124、sa271→p.125）
- 页码指示器与缩略图条含 Can-do 页（p.125（7/7））；课程元信息行格式 `课本 p.108–113 ・ Can-do p.125`
- 注：自动化点击 `#playPause` 的"播放"分支会被沙箱拦截（真实用户手势不受影响）；自动播放路径正常

## 环境要点

- Python 必须用 bundled：`/Users/sylvan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`（系统 python3 缺 Xcode CLT）
- 无系统 ffmpeg；`tools/bin/ffmpeg` 是 imageio-ffmpeg 静态二进制的 symlink，转录时须 `export PATH="$PWD/tools/bin:$PATH"`
- 后台进程陷阱：exec_command 里 `nohup ... &` 会被杀；长任务用持久会话 + write_stdin 轮询
- `rm -f` 会被沙箱拒绝，避免使用；路径含空格需加引号

## 未完成 / 已知限制

- 部分短音轨首段是题号报幕（如"3"），属音频真实内容，未剔除
- 教材为扫描版无文本层，字幕全部来自 whisper 听写，个别助词可能有误（如 059"この人を誰ですか"应为"は"）

## 2026-10-27 新增：课本页音频 chip 标注（可点击对照播放）

### 功能

课本页面图上叠加可点击的圆形/胶囊标注，定位每条音轨对应的课本 chip，点击即播放，方便老师对照学生听到的位置：

- `web/index.html`：`pageStage` 内已有 `<div class="page-marks" id="pageMarks">`（绝对定位叠在页面图上，容器 `pointer-events:none`，chip 自身 `auto`）
- `web/app.js`：
  - `renderPageMarks()` 在 `showPage()` 末尾调用。先画 `APP_DATA.rangeMarks[page]`（范围 chip，胶囊形，文本 `lo-hi`），再画 `APP_DATA.pageMarks[page]`（单 chip，圆形）；落在某 range 内的单 chip 跳过避免重叠
  - 每个 chip `onclick`：若当前音轨已在该 chip 范围内则切换播放/暂停，否则 `loadTrack(list[0], true)` 播放该 chip 第一条音轨
  - `markPlayingChip()` 给当前播放音轨对应 chip 加 `.playing`（放大 + 光晕）；`loadTrack`/`renderPageMarks` 都调用
- `web/style.css`：`.chip-mark`（红底白字圆点 26px、白描边、阴影、hover 放大）、`.chip-mark.range`（胶囊形自适应宽度）、`.chip-mark.approx`（OCR 未定位到时的左缘空心堆叠点，白底红字）、`.chip-mark.playing`（实色 + 4px 光晕 + 放大）

### 定位数据生成（tools/build_app_data.py）

- `build_chip_boxes()`：从 `docs/ocr_pages.json`（Vision OCR，含每个 token 的归一化 bounding box）提取印刷 chip 坐标。正课页须整行 fullmatch 三位数 / 范围 / 并列写法，并跳过等于页脚页码的 token；Can-do 页取 2[3-7]x 范围/并列，且要求 x>0.62（chip 在表格右侧列）。产出 track -> {page: [box,...]}
- `build_page_marks()`：每条 part0 音轨在映射页得到一个标注。OCR 在该页恰好定位到一次且坐标在合理区内则精确点（o=1）；被多条音轨共享的坐标（一个范围 token 展开成多 chip）丢弃；无可靠坐标的音轨沿左缘竖排堆叠（o=0）
- `build_range_marks()`：课本把多条 chip 印成一个共享 token（练习标题 002-010、Can-do 表格 236・237）时，生成一个范围标注，正课页要求号码连续

### 覆盖与验证

- 167 条 part0 音轨 100% 有课本标注：精确点 11 + 左缘堆叠 1 + 47 个范围 chip（范围 chip 覆盖绝大多数，因课本一页常只印 1 个范围 chip 涵盖多条音轨）
- 浏览器实测：p.22 显示范围 chip 3-10 + 导入轨 1（playing 紫色高亮）；点击 3-10 切到 sa003 并播放；点击精确 chip、连播切轨后 chip 高亮跟随均正常
- 注意：本功能只读 data.js 现有 pageMarks/rangeMarks，无新增数据文件；改了 build_app_data.py 后需重跑它 + build_readings.py 才刷新 data.js

### 2026-10-27 微调：chip 文本补零对齐课本印刷格式

- app.js 的 range chip 文本由 `3-10` 改为 `003-010`，单 chip 由 `1` 改为 `001`，与课本上印刷的 chip 编号格式一致，对照更直观；app.js cache-buster 升至 20261027-6
