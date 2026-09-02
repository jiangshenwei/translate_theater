(function () {
  const btn = document.getElementById("fullscreen-btn");
  if (!btn) return;

  function isNativeFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function isPseudoFullscreen() {
    return document.documentElement.classList.contains("pseudo-fullscreen");
  }

  function isActive() {
    return isNativeFullscreen() || isPseudoFullscreen();
  }

  function updateButton() {
    const active = isActive();
    btn.classList.toggle("is-active", active);
    btn.setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen"
    );
  }

  function enterPseudo() {
    document.documentElement.classList.add("pseudo-fullscreen");
    document.body.classList.add("pseudo-fullscreen");
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 1), 0);
    updateButton();
  }

  function exitPseudo() {
    document.documentElement.classList.remove("pseudo-fullscreen");
    document.body.classList.remove("pseudo-fullscreen");
    updateButton();
  }

  async function enterNative() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else {
        throw new Error("Fullscreen API not supported");
      }
      exitPseudo();
    } catch {
      enterPseudo();
    }
    updateButton();
  }

  async function exitNative() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
    updateButton();
  }

  async function toggle() {
    if (isActive()) {
      exitPseudo();
      if (isNativeFullscreen()) {
        await exitNative();
      }
    } else {
      await enterNative();
    }
    updateButton();
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  ["fullscreenchange", "webkitfullscreenchange"].forEach((eventName) => {
    document.addEventListener(eventName, updateButton);
  });

  updateButton();
})();
