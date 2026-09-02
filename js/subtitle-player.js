(function () {
  const VALID_LANGS = ["en", "ja", "ko", "th"];

  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") || "en";

  if (!VALID_LANGS.includes(lang)) {
    window.location.href = "index.html";
    return;
  }

  const langLabel = document.getElementById("lang-label");
  const subtitleText = document.getElementById("subtitle-text");
  const countdownHint = document.getElementById("countdown-hint");
  const countdownDisplay = document.getElementById("countdown-display");
  const timeDisplay = document.getElementById("time-display");
  const backBtn = document.getElementById("back-btn");
  const subtitleMain = document.getElementById("subtitle-main");

  let cues = [];
  let showConfig = null;
  let uiText = { countdownHint: "", backLabel: "", endMessage: "" };
  let rafId = null;
  let currentCueIndex = -1;
  let mode = "loading"; // loading | countdown | playing | ended

  const TZ_TO_IANA = {
    "+08:00": "Asia/Shanghai",
  };

  function getShowDurationSec() {
    if (!cues.length) return 0;
    return cues[cues.length - 1].end;
  }

  function getDateInTimezone(dayOffset, timezone) {
    const iana = TZ_TO_IANA[timezone] || "Asia/Shanghai";
    const target = new Date(Date.now() + dayOffset * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: iana,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(target);
  }

  function parseSessionStartMs(dateStr, timeStr, timezone) {
    const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${normalized}${timezone}`).getTime();
  }

  function getAllSessions(config, durationSec) {
    const durationMs = durationSec * 1000;

    if (config.dailyPerformances?.length) {
      const timezone = config.timezone || "+08:00";
      const sessions = [];

      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const dateStr = getDateInTimezone(dayOffset, timezone);
        for (const time of config.dailyPerformances) {
          const startMs = parseSessionStartMs(dateStr, time, timezone);
          sessions.push({ startMs, endMs: startMs + durationMs });
        }
      }

      return sessions;
    }

    if (config.performanceStart) {
      const startMs = new Date(config.performanceStart).getTime();
      if (!Number.isNaN(startMs)) {
        return [{ startMs, endMs: startMs + durationMs }];
      }
    }

    return [];
  }

  function resolveCurrentSession(config, durationSec) {
    const now = Date.now();
    const sessions = getAllSessions(config, durationSec);
    return sessions.find((session) => now < session.endMs) || null;
  }

  function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatCountdown(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function findCueIndex(time) {
    for (let i = 0; i < cues.length; i++) {
      if (time >= cues[i].start && time < cues[i].end) {
        return i;
      }
    }
    return -1;
  }

  function showCue(index) {
    if (index < 0 || index >= cues.length) {
      if (mode === "playing") {
        subtitleText.textContent = "";
      }
      currentCueIndex = -1;
      return;
    }
    if (index === currentCueIndex) return;

    subtitleText.classList.add("fade-out");
    setTimeout(() => {
      subtitleText.textContent = cues[index].text;
      subtitleText.classList.remove("fade-out");
      currentCueIndex = index;
    }, 150);
  }

  function setCountdownMode() {
    mode = "countdown";
    subtitleMain.classList.add("countdown-mode");
    subtitleMain.classList.remove("ended-mode");
    countdownHint.hidden = false;
    countdownDisplay.hidden = false;
    subtitleText.textContent = "";
    currentCueIndex = -1;
    timeDisplay.textContent = "—";
  }

  function setPlayingMode() {
    mode = "playing";
    subtitleMain.classList.remove("countdown-mode", "ended-mode");
    countdownHint.hidden = true;
    countdownDisplay.hidden = true;
  }

  function setEndedMode() {
    mode = "ended";
    subtitleMain.classList.add("ended-mode");
    subtitleMain.classList.remove("countdown-mode");
    countdownHint.hidden = true;
    countdownDisplay.hidden = true;
    subtitleText.textContent = "";
    timeDisplay.textContent = "—";
    currentCueIndex = -1;
  }

  function tick() {
    const durationSec = getShowDurationSec();
    const session = resolveCurrentSession(showConfig, durationSec);

    if (!session) {
      setEndedMode();
      subtitleText.textContent = uiText.endMessage || "";
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      return;
    }

    const now = Date.now();
    const untilStart = (session.startMs - now) / 1000;

    if (untilStart > 0) {
      setCountdownMode();
      countdownDisplay.textContent = formatCountdown(untilStart);
      rafId = requestAnimationFrame(tick);
      return;
    }

    const elapsed = (now - session.startMs) / 1000;

    if (elapsed >= durationSec && durationSec > 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    setPlayingMode();
    timeDisplay.textContent = formatElapsed(elapsed);
    showCue(findCueIndex(elapsed));

    rafId = requestAnimationFrame(tick);
  }

  function cacheBust(url) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}_=${Date.now()}`;
  }

  async function fetchJson(url) {
    const res = await fetch(cacheBust(url), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return res.json();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = cacheBust(src);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadShowConfig() {
    try {
      return await fetchJson("config/show.json");
    } catch {
      delete window.SHOW_CONFIG;
      await loadScript("config/show.js");
      if (!window.SHOW_CONFIG) {
        throw new Error("Show config missing");
      }
      return window.SHOW_CONFIG;
    }
  }

  async function loadSubtitleData() {
    try {
      return await fetchJson(`subtitles/${lang}.json`);
    } catch {
      delete window.SUBTITLE_BUNDLE;
      await loadScript(`subtitles/${lang}.js`);
      if (!window.SUBTITLE_BUNDLE) {
        throw new Error("Subtitle data missing");
      }
      return window.SUBTITLE_BUNDLE;
    }
  }

  async function loadData() {
    const [showConfig, subtitleData] = await Promise.all([
      loadShowConfig(),
      loadSubtitleData(),
    ]);
    return { showConfig, subtitleData };
  }

  async function init() {
    try {
      const { showConfig: loadedShowConfig, subtitleData } = await loadData();
      showConfig = loadedShowConfig;

      cues = subtitleData.cues || [];
      langLabel.textContent = subtitleData.label || lang;

      const ui = subtitleData.ui || {};
      uiText = {
        countdownHint: ui.countdownHint || "The performance will begin shortly",
        backLabel: ui.backLabel || "← Back",
        endMessage: ui.endMessage || "End of performance",
      };
      countdownHint.textContent = uiText.countdownHint;
      backBtn.textContent = uiText.backLabel;

      const durationSec = getShowDurationSec();
      if (
        !resolveCurrentSession(showConfig, durationSec) &&
        !showConfig.dailyPerformances?.length &&
        !showConfig.performanceStart
      ) {
        throw new Error("No performance schedule in show config");
      }

      rafId = requestAnimationFrame(tick);
    } catch (err) {
      subtitleText.textContent = "字幕加载失败，请检查配置文件";
      console.error(err);
    }
  }

  backBtn.addEventListener("click", () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.location.href = "index.html";
  });

  init();
})();
