/* Foodie — a free, offline calorie tracker.
 * All data lives in localStorage on the device. No accounts, no servers. */
(function () {
  "use strict";

  var STORE_KEY = "foodie.v1";
  var RING_CIRC = 2 * Math.PI * 52; // must match r=52 in the SVG

  // ---- State ----------------------------------------------------------------
  var state = load();
  var viewDate = todayKey();

  function defaultState() {
    return { goal: 2000, days: {}, recents: [] };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();
      parsed.goal = clampInt(parsed.goal, 500, 10000, 2000);
      parsed.days = parsed.days && typeof parsed.days === "object" ? parsed.days : {};
      parsed.recents = Array.isArray(parsed.recents) ? parsed.recents : [];
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("Couldn't save — storage full?");
    }
  }

  // ---- Date helpers ---------------------------------------------------------
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function shiftDate(key, delta) {
    var parts = key.split("-");
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function dateLabel(key) {
    if (key === todayKey()) return "Today";
    if (key === shiftDate(todayKey(), -1)) return "Yesterday";
    var parts = key.split("-");
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  // ---- Utils ----------------------------------------------------------------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function clampInt(v, min, max, fallback) {
    v = parseInt(v, 10);
    if (isNaN(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function entriesFor(key) { return state.days[key] || []; }

  function totals(key) {
    return entriesFor(key).reduce(function (t, e) {
      t.kcal += e.kcal; t.p += e.p || 0; t.c += e.c || 0; t.f += e.f || 0;
      return t;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }

  // ---- DOM refs -------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    dateBtn: $("dateBtn"), eaten: $("eaten"), goalLabel: $("goalLabel"),
    remaining: $("remaining"), ringFg: $("ringFg"),
    pVal: $("pVal"), cVal: $("cVal"), fVal: $("fVal"),
    log: $("log"), logCount: $("logCount"), emptyState: $("emptyState"),
    recents: $("recents"),
    addForm: $("addForm"), foodName: $("foodName"), foodKcal: $("foodKcal"),
    foodP: $("foodP"), foodC: $("foodC"), foodF: $("foodF"),
    settingsBtn: $("settingsBtn"), settingsSheet: $("settingsSheet"),
    sheetBackdrop: $("sheetBackdrop"), goalInput: $("goalInput"),
    saveSettings: $("saveSettings"),
    exportBtn: $("exportBtn"), importBtn: $("importBtn"), importFile: $("importFile"),
  };

  // ---- Render ---------------------------------------------------------------
  function render() {
    var t = totals(viewDate);
    var goal = state.goal;
    var remaining = goal - t.kcal;

    els.dateBtn.textContent = dateLabel(viewDate);
    els.eaten.textContent = t.kcal;
    els.goalLabel.textContent = goal;
    els.pVal.textContent = t.p;
    els.cVal.textContent = t.c;
    els.fVal.textContent = t.f;

    els.remaining.textContent = remaining >= 0
      ? remaining + " left"
      : Math.abs(remaining) + " over";
    els.remaining.style.color = remaining >= 0 ? "var(--brand)" : "var(--danger)";

    var pct = goal > 0 ? Math.min(t.kcal / goal, 1) : 0;
    els.ringFg.style.strokeDashoffset = String(RING_CIRC * (1 - pct));
    els.ringFg.style.stroke = t.kcal > goal ? "var(--danger)" : "var(--brand-2)";

    renderLog(t);
    renderRecents();
  }

  function renderLog(t) {
    var items = entriesFor(viewDate);
    els.logCount.textContent = items.length + (items.length === 1 ? " item" : " items");
    els.emptyState.hidden = items.length > 0;
    els.log.innerHTML = "";

    // newest first
    for (var i = items.length - 1; i >= 0; i--) {
      var e = items[i];
      var li = document.createElement("li");
      li.className = "log-item";
      var macros = [];
      if (e.p) macros.push("P " + e.p);
      if (e.c) macros.push("C " + e.c);
      if (e.f) macros.push("F " + e.f);
      li.innerHTML =
        '<div class="log-info">' +
          '<div class="log-name">' + esc(e.name) + "</div>" +
          (macros.length ? '<div class="log-macros">' + macros.join("  ·  ") + " g</div>" : "") +
        "</div>" +
        '<div class="log-kcal">' + e.kcal + " kcal</div>" +
        '<button class="del-btn" aria-label="Delete" data-id="' + e.id + '">&times;</button>';
      els.log.appendChild(li);
    }
  }

  function renderRecents() {
    els.recents.innerHTML = "";
    state.recents.slice(0, 6).forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.innerHTML = esc(r.name) + ' <span class="chip-kcal">' + r.kcal + "</span>";
      b.addEventListener("click", function () {
        addEntry(r.name, r.kcal, r.p || 0, r.c || 0, r.f || 0);
        toast("Added " + r.name);
      });
      els.recents.appendChild(b);
    });
  }

  // ---- Actions --------------------------------------------------------------
  function addEntry(name, kcal, p, c, f) {
    name = String(name).trim().slice(0, 60);
    if (!name || kcal <= 0) return;
    if (!state.days[viewDate]) state.days[viewDate] = [];
    state.days[viewDate].push({ id: uid(), name: name, kcal: kcal, p: p, c: c, f: f });
    rememberRecent(name, kcal, p, c, f);
    save();
    render();
  }

  function rememberRecent(name, kcal, p, c, f) {
    var key = name.toLowerCase();
    state.recents = state.recents.filter(function (r) { return r.name.toLowerCase() !== key; });
    state.recents.unshift({ name: name, kcal: kcal, p: p, c: c, f: f });
    state.recents = state.recents.slice(0, 12);
  }

  function deleteEntry(id) {
    var arr = state.days[viewDate];
    if (!arr) return;
    state.days[viewDate] = arr.filter(function (e) { return e.id !== id; });
    if (state.days[viewDate].length === 0) delete state.days[viewDate];
    save();
    render();
  }

  // ---- Toast ----------------------------------------------------------------
  var toastTimer;
  function toast(msg) {
    var el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    // force reflow so re-triggering the animation works
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1600);
  }

  // ---- Settings sheet -------------------------------------------------------
  function openSheet() {
    els.goalInput.value = state.goal;
    els.sheetBackdrop.hidden = false;
    els.settingsSheet.hidden = false;
  }
  function closeSheet() {
    els.sheetBackdrop.hidden = true;
    els.settingsSheet.hidden = true;
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "foodie-backup-" + todayKey() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !data.days) throw new Error("bad file");
        state = {
          goal: clampInt(data.goal, 500, 10000, 2000),
          days: data.days,
          recents: Array.isArray(data.recents) ? data.recents : [],
        };
        save();
        render();
        closeSheet();
        toast("Data imported");
      } catch (e) {
        toast("Import failed — invalid file");
      }
    };
    reader.readAsText(file);
  }

  // ---- Events ---------------------------------------------------------------
  els.addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = els.foodName.value;
    var kcal = num(els.foodKcal.value);
    if (!name.trim() || kcal <= 0) { toast("Enter a name and calories"); return; }
    addEntry(name, kcal, num(els.foodP.value), num(els.foodC.value), num(els.foodF.value));
    els.addForm.reset();
    els.foodName.focus();
  });

  els.log.addEventListener("click", function (e) {
    var btn = e.target.closest(".del-btn");
    if (btn) deleteEntry(btn.getAttribute("data-id"));
  });

  // Tap date to cycle to previous days; long-press / tap again returns to today
  els.dateBtn.addEventListener("click", function () {
    if (viewDate === todayKey()) {
      viewDate = shiftDate(viewDate, -1); // go back
    } else {
      var next = shiftDate(viewDate, 1);
      viewDate = next; // step forward toward today
    }
    render();
  });
  // Double-tap date jumps back to today
  els.dateBtn.addEventListener("dblclick", function () {
    viewDate = todayKey();
    render();
  });

  els.settingsBtn.addEventListener("click", openSheet);
  els.sheetBackdrop.addEventListener("click", closeSheet);
  els.saveSettings.addEventListener("click", function () {
    state.goal = clampInt(els.goalInput.value, 500, 10000, 2000);
    save();
    render();
    closeSheet();
  });
  els.exportBtn.addEventListener("click", exportData);
  els.importBtn.addEventListener("click", function () { els.importFile.click(); });
  els.importFile.addEventListener("change", function () {
    if (els.importFile.files[0]) importData(els.importFile.files[0]);
    els.importFile.value = "";
  });

  // ---- Service worker (offline) ---------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ---- Go -------------------------------------------------------------------
  render();
})();
