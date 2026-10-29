"use strict";

const $ = (id) => document.getElementById(id);
const audio = $("audio");

const state = {
  lesson: APP_DATA.lessons[0].n,
  trackIndex: 0,
  page: null,      // currently displayed book page
  autoNext: true,
  followSub: true,
  furigana: true,
};

const lessonOf = (n) => APP_DATA.lessons.find((l) => l.n === n);
const lessonTracks = (n) => APP_DATA.tracks.filter((t) => t.lesson === n);
const pad3 = (n) => String(n).padStart(3, "0");
const pageImg = (p) => `../pdf_pages/page-${pad3(p)}.jpg`;

function fmt(sec) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- lesson tabs ---------- */
function renderTabs() {
  const nav = $("lessonTabs");
  nav.innerHTML = "";
  for (const l of APP_DATA.lessons) {
    const b = document.createElement("button");
    b.textContent = l.zh;
    b.title = `${l.title}（${l.topic}）`;
    b.classList.toggle("active", l.n === state.lesson);
    b.onclick = () => selectLesson(l.n);
    nav.appendChild(b);
  }
}

function selectLesson(n) {
  state.lesson = n;
  state.trackIndex = 0;
  renderTabs();
  renderTrackList();
  renderPageStrip();
  const first = lessonTracks(n)[0];
  if (first) loadTrack(first, false);
}

/* ---------- track list ---------- */
function renderTrackList() {
  const l = lessonOf(state.lesson);
  $("lessonTitle").textContent = l.zh;
  const mainPages = l.pages.filter((p) => p < 116);
  const candoPages = l.pages.filter((p) => p >= 116);
  const range = `课本 p.${mainPages[0]}–${mainPages[mainPages.length - 1]}`;
  const extra = candoPages.length ? ` ・ Can-do p.${candoPages.join("/")}` : "";
  $("lessonMeta").textContent = `${l.title} ・ ${l.topic} ・ ${range}${extra}`;

  const list = $("trackList");
  list.innerHTML = "";
  lessonTracks(state.lesson).forEach((t, i) => {
    const b = document.createElement("button");
    b.className = "track-item";
    b.setAttribute("role", "option");
    const trackName = t.canDo
      ? `Can-do ${t.canDo}（${pad3(t.track)}）`
      : `${pad3(t.track)}${t.part ? "-" + t.part : ""}`;
    b.innerHTML = `
      <span class="row1">
        <span class="track-id">${trackName}</span>
        <span class="track-dur">p.${t.page} ・ ${fmt(t.duration)}</span>
      </span>
      <span class="track-label">${escapeHtml(t.label)}</span>`;
    b.onclick = () => loadTrack(t, true);
    if (i === state.trackIndex) b.classList.add("active");
    list.appendChild(b);
  });
}

function markActiveTrack() {
  const items = document.querySelectorAll(".track-item");
  items.forEach((el, i) => el.classList.toggle("active", i === state.trackIndex));
  const cur = items[state.trackIndex];
  if (cur) cur.scrollIntoView({ block: "nearest" });
}

/* ---------- track loading & subtitles ---------- */
function currentTrack() {
  return lessonTracks(state.lesson)[state.trackIndex] || null;
}

function loadTrack(t, autoplay) {
  const arr = lessonTracks(state.lesson);
  state.trackIndex = arr.indexOf(t);
  audio.src = "../" + t.audio;
  audio.playbackRate = parseFloat($("rate").value);

  const name = t.canDo ? `Can-do ${t.canDo}　（音轨 ${pad3(t.track)}）` : `音轨 ${pad3(t.track)}${t.part ? "-" + t.part : ""}`;
  $("trackTitle").textContent = name;
  $("trackMeta").textContent = `${lessonOf(t.lesson).zh} ・ 课本第 ${t.page} 页`;

  renderSubtitles(t);
  markActiveTrack();
  showPage(t.page);
  markPlayingChip();
  setPlayIcon(false);
  $("timeCur").textContent = "0:00";
  setSeek(0);
  if (autoplay) audio.play().catch(() => {});
}

function renderSubtitles(t) {
  const box = $("subtitles");
  box.innerHTML = "";
  if (!t.segments.length) {
    box.innerHTML = '<p class="sub-empty">（无字幕）</p>';
    return;
  }
  t.segments.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "seg";
    div.dataset.idx = idx;
    const time = document.createElement("div");
    time.className = "seg-time";
    time.textContent = `${fmt(s.s)} → ${fmt(s.e)}`;
    const text = document.createElement("div");
    text.className = "seg-text";
    if (s.w && s.w.length) {
      s.w.forEach((wd, wi) => {
        const span = document.createElement("span");
        span.className = "w";
        span.dataset.widx = wi;
        const surface = wd[2];
        const reading = wd[3] || null;
        if (reading && reading !== surface && /[一-鿿㐀-䶿]/.test(surface)) {
          const rb = document.createElement("ruby");
          const base = document.createElement("span");
          base.className = "w-base";
          base.textContent = surface;
          const rt = document.createElement("rt");
          rt.textContent = reading;
          rb.appendChild(base);
          rb.appendChild(rt);
          span.appendChild(rb);
        } else {
          span.textContent = surface;
        }
        text.appendChild(span);
      });
    } else {
      text.textContent = s.t;
    }
    div.appendChild(time);
    div.appendChild(text);
    div.onclick = () => { audio.currentTime = s.s + 0.01; audio.play().catch(() => {}); };
    box.appendChild(div);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- playback sync ---------- */
let lastSeg = -1;

audio.addEventListener("timeupdate", () => {
  const t = currentTrack();
  const cur = audio.currentTime;
  $("timeCur").textContent = fmt(cur);
  if (audio.duration) setSeek(Math.round((cur / audio.duration) * 1000));
  if (!t) return;

  let segIdx = -1;
  for (let i = 0; i < t.segments.length; i++) {
    const s = t.segments[i];
    if (cur >= s.s - 0.05 && cur <= s.e + 0.35) { segIdx = i; break; }
    if (s.s > cur) break;
  }
  if (segIdx !== lastSeg) {
    document.querySelectorAll(".seg").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.idx) === segIdx);
    });
    if (segIdx >= 0 && state.followSub) {
      const el = document.querySelector(`.seg[data-idx="${segIdx}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    lastSeg = segIdx;
  }
  if (segIdx >= 0) {
    const seg = t.segments[segIdx];
    const spans = document.querySelectorAll(`.seg[data-idx="${segIdx}"] .w`);
    spans.forEach((sp) => {
      const wd = seg.w[Number(sp.dataset.widx)];
      sp.classList.toggle("on", cur >= wd[0] - 0.05 && cur <= wd[1] + 0.15);
    });
  }
});

audio.addEventListener("loadedmetadata", () => {
  $("timeDur").textContent = fmt(audio.duration);
});

audio.addEventListener("play", () => setPlayIcon(true));
audio.addEventListener("pause", () => setPlayIcon(false));

audio.addEventListener("ended", () => {
  if (!state.autoNext) return;
  const arr = lessonTracks(state.lesson);
  if (state.trackIndex + 1 < arr.length) loadTrack(arr[state.trackIndex + 1], true);
});

function setPlayIcon(playing) {
  $("iconPlay").style.display = playing ? "none" : "";
  $("iconPause").style.display = playing ? "" : "none";
}

/* ---------- player controls ---------- */
$("playPause").onclick = () => {
  if (!audio.src) {
    const t = currentTrack();
    if (t) loadTrack(t, true);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
};
$("prevTrack").onclick = () => stepTrack(-1);
$("nextTrack").onclick = () => stepTrack(1);

function stepTrack(d) {
  const arr = lessonTracks(state.lesson);
  const i = Math.min(Math.max(state.trackIndex + d, 0), arr.length - 1);
  loadTrack(arr[i], true);
}

$("seek").addEventListener("input", () => {
  if (audio.duration) audio.currentTime = ($("seek").value / 1000) * audio.duration;
});

// Keep the slider's filled portion in sync (custom webkit styling has no
// native "progress" color, so the fill is painted as a track background).
function setSeek(v) {
  const seek = $("seek");
  seek.value = v;
  seek.style.background = `linear-gradient(to right, var(--accent) ${v / 10}%, var(--line) ${v / 10}%)`;
}
$("rate").onchange = () => { audio.playbackRate = parseFloat($("rate").value); };
$("autoNext").onchange = (e) => { state.autoNext = e.target.checked; };
$("followSub").onchange = (e) => { state.followSub = e.target.checked; };
$("furigana").onchange = (e) => {
  state.furigana = e.target.checked;
  document.body.classList.toggle("hide-furi", !state.furigana);
};

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); $("playPause").click(); }
  else if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 5); }
  else if (e.key === "ArrowRight") { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); }
  else if (e.key === "ArrowUp") { e.preventDefault(); stepTrack(-1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); stepTrack(1); }
});

/* ---------- book pages ---------- */
function showPage(p) {
  state.page = p;
  const img = $("pageImg");
  img.src = pageImg(p);
  const pages = lessonOf(state.lesson).pages;
  const i = pages.indexOf(p);
  $("pageIndicator").textContent = `p.${p}（${i + 1}/${pages.length}）`;
  document.querySelectorAll(".page-strip button").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.page) === p);
  });
  const active = document.querySelector(".page-strip button.active");
  if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
  renderPageMarks();
}

/* ---------- audio chip markers on the book page ---------- */
// Every track mapped to the visible page gets a round marker on the page
// image: solid red dot at the chip's printed position when OCR located it,
// outlined dot in a stack along the left edge otherwise. Clicking plays the
// track (or toggles play/pause if it is already the current one).
function renderPageMarks() {
  const box = $("pageMarks");
  box.innerHTML = "";
  const pg = String(state.page);
  const ranges = (APP_DATA.rangeMarks || {})[pg] || [];
  for (const range of ranges) {
    const list = APP_DATA.tracks.filter(
      (t) => t.lesson === state.lesson && t.track >= range.lo && t.track <= range.hi);
    if (list.length) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-mark range";
      btn.dataset.lo = range.lo;
      btn.dataset.hi = range.hi;
      btn.style.left = (range.x * 100) + "%";
      btn.style.top = (range.y * 100) + "%";
      btn.textContent = `${pad3(range.lo)}-${pad3(range.hi)}`;
      btn.title = "\u64ad\u653e\u97f3\u8f68 " + range.lo + "-" + range.hi;
      btn.onclick = () => {
        const cur = currentTrack();
        if (cur && list.includes(cur)) {
          if (audio.paused) audio.play().catch(() => {}); else audio.pause();
        } else {
          loadTrack(list[0], true);
        }
      };
      box.appendChild(btn);
    }
  }
  const marks = (APP_DATA.pageMarks || {})[pg] || [];
  for (const m of marks) {
    if (ranges.some((r) => m.tr >= r.lo && m.tr <= r.hi)) continue;
    const list = tracksOnPage(m.tr);
    if (!list.length) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-mark" + (m.o ? "" : " approx");
    btn.dataset.track = m.tr;
    btn.style.left = (m.x * 100) + "%";
    btn.style.top = (m.y * 100) + "%";
    btn.textContent = pad3(m.tr);
    btn.title = "\u64ad\u653e\u97f3\u8f68 " + m.tr;
    btn.onclick = () => {
      const cur = currentTrack();
      if (cur && list.includes(cur)) {
        if (audio.paused) audio.play().catch(() => {}); else audio.pause();
      } else {
        loadTrack(list[0], true);
      }
    };
    box.appendChild(btn);
  }
  markPlayingChip();
}

function tracksOnPage(num) {
  return APP_DATA.tracks.filter(
    (t) => t.lesson === state.lesson && t.track === num && t.page === state.page);
}

function markPlayingChip() {
  const cur = currentTrack();
  document.querySelectorAll("#pageMarks .chip-mark").forEach((b) => {
    let on = false;
    if (cur) {
      if (b.dataset.track) on = Number(b.dataset.track) === cur.track;
      else if (b.dataset.lo) on = cur.track >= Number(b.dataset.lo) && cur.track <= Number(b.dataset.hi);
    }
    b.classList.toggle("playing", on);
  });
}

function renderPageStrip() {
  const strip = $("pageStrip");
  strip.innerHTML = "";
  for (const p of lessonOf(state.lesson).pages) {
    const b = document.createElement("button");
    b.dataset.page = p;
    b.title = `第 ${p} 页`;
    const img = document.createElement("img");
    img.src = pageImg(p);
    img.alt = `p.${p}`;
    img.loading = "lazy";
    b.appendChild(img);
    b.onclick = () => showPage(p);
    strip.appendChild(b);
  }
}

$("prevPage").onclick = () => stepPage(-1);
$("nextPage").onclick = () => stepPage(1);

function stepPage(d) {
  const pages = lessonOf(state.lesson).pages;
  const i = pages.indexOf(state.page);
  const n = Math.min(Math.max(i + d, 0), pages.length - 1);
  showPage(pages[n]);
}

/* ---------- furigana drill ---------- */
// Pool of kanji-bearing words seen in the current lesson's transcripts.
function drillPool() {
  const pool = new Map();
  for (const t of lessonTracks(state.lesson)) {
    for (const s of t.segments) {
      const ws = s.w || [];
      ws.forEach((w, wi) => {
        const surf = (w[2] || "").trim();
        const read = w[3];
        if (!surf || !read || !/[一-鿿]/.test(surf) || /\d/.test(surf)) return;
        if (!/^[ぁ-ゖー]+$/.test(read)) return;
        if (!pool.has(surf)) pool.set(surf, { read, sent: s.t, count: 0 });
        pool.get(surf).count++;
      });
    }
  }
  return [...pool.entries()].map(([surf, v]) => ({ surf, ...v }));
}

const drill = {
  items: [],
  idx: 0,
  correct: 0,
  wrong: 0,
  locked: false,
};

const DRILL_LEN = 10;

function openDrill() {
  const pool = drillPool();
  if (!pool.length) {
    $("drillSub").textContent = "本课还没有可练习的汉字";
  } else {
    $("drillSub").textContent = "看汉字，输入假名读音";
  }
  const shuffled = pool.sort(() => Math.random() - 0.5);
  // prefer frequent words, then random sample
  const top = shuffled.sort((a, b) => b.count - a.count).slice(0, 40);
  drill.items = top.sort(() => Math.random() - 0.5).slice(0, DRILL_LEN);
  drill.idx = 0;
  drill.correct = 0;
  drill.wrong = 0;
  $("drillResult").hidden = true;
  $("drillOverlay").hidden = false;
  $("drillTitle").textContent = `${lessonOf(state.lesson).zh} · 汉字假名练习`;
  showDrillItem();
  $("drillInput").focus();
}

function showDrillItem() {
  drill.locked = false;
  const it = drill.items[drill.idx];
  $("drillProgress").textContent = `${drill.idx + 1} / ${drill.items.length}　✓ ${drill.correct}　✗ ${drill.wrong}`;
  $("drillKanji").textContent = it ? it.surf : "";
  // sentence with the target highlighted
  const sEl = $("drillSentence");
  sEl.innerHTML = "";
  if (it) {
    const sent = it.sent;
    const at = sent.indexOf(it.surf);
    if (at >= 0) {
      sEl.append(sent.slice(0, at));
      const mark = document.createElement("span");
      mark.className = "drill-target";
      mark.textContent = it.surf;
      sEl.appendChild(mark);
      sEl.append(sent.slice(at + it.surf.length));
    } else {
      sEl.textContent = sent;
    }
  }
  const inp = $("drillInput");
  inp.value = "";
  inp.classList.remove("ok", "ng");
  $("drillMark").textContent = "";
  $("drillMark").className = "drill-mark";
}

function normKana(s) {
  // accept katakana answers too; strip whitespace
  return [...s.replace(/\s+/g, "")].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c;
  }).join("");
}

function submitDrill() {
  if (drill.locked) {  // already correct, Enter = next
    nextDrill();
    return;
  }
  const it = drill.items[drill.idx];
  if (!it) return;
  const inp = $("drillInput");
  const ans = normKana(inp.value);
  if (!ans) return;
  if (ans === it.read) {
    drill.correct++;
    drill.locked = true;
    inp.classList.add("ok");
    inp.classList.remove("ng");
    $("drillMark").textContent = "✓";
    $("drillMark").classList.add("ok");
    // show the reading above the kanji now
    $("drillKanji").innerHTML = "";
    const rb = document.createElement("ruby");
    rb.textContent = it.surf;
    const rt = document.createElement("rt");
    rt.textContent = it.read;
    rb.appendChild(rt);
    $("drillKanji").appendChild(rb);
    $("drillProgress").textContent = `${drill.idx + 1} / ${drill.items.length}　✓ ${drill.correct}　✗ ${drill.wrong}`;
    setTimeout(nextDrill, 700);
  } else {
    drill.wrong++;
    inp.classList.add("ng");
    inp.classList.remove("ok");
    $("drillMark").textContent = "✗";
    $("drillMark").classList.add("ng");
    $("drillProgress").textContent = `${drill.idx + 1} / ${drill.items.length}　✓ ${drill.correct}　✗ ${drill.wrong}`;
    inp.select();
  }
}

function nextDrill() {
  drill.idx++;
  if (drill.idx >= drill.items.length) {
    $("drillScore").textContent =
      `完成！共 ${drill.items.length} 词，答对 ${drill.correct}，答错 ${drill.wrong}`;
    $("drillResult").hidden = false;
    $("drillKanji").textContent = "おつかれさま！";
    $("drillSentence").textContent = "";
    return;
  }
  showDrillItem();
  $("drillInput").focus();
}

$("drillBtn").onclick = openDrill;
$("drillClose").onclick = () => { $("drillOverlay").hidden = true; };
$("drillSubmit").onclick = submitDrill;
$("drillRetry").onclick = () => { $("drillResult").hidden = true; openDrill(); };
$("drillInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); submitDrill(); }
});
$("drillOverlay").addEventListener("click", (e) => {
  if (e.target === $("drillOverlay")) $("drillOverlay").hidden = true;
});

/* ---------- init ---------- */
renderTabs();
renderTrackList();
renderPageStrip();
const first = lessonTracks(state.lesson)[0];
if (first) loadTrack(first, false);
