/* Foodie — a free, offline calorie tracker.
 * All data lives in localStorage on the device. No accounts, no servers. */
(function () {
  "use strict";

  var STORE_KEY = "foodie.v1";
  var RING_CIRC = 2 * Math.PI * 52; // must match r=52 in the SVG

  // ---- State ----------------------------------------------------------------
  var state = load();
  var viewDate = todayKey();

  var THEMES = ["auto", "black", "white", "blue", "pink"];
  var THEME_COLORS = { auto: null, black: "#000000", white: "#fafafa", blue: "#eef4fb", pink: "#fdf1f6" };

  function defaultState() {
    return { goal: 2000, days: {}, recents: [], weights: {}, weightUnit: "lb", theme: "auto" };
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
      // weights: day key ("YYYY-MM-DD") -> body weight in kg (canonical, unit-independent)
      parsed.weights = parsed.weights && typeof parsed.weights === "object" ? parsed.weights : {};
      parsed.weightUnit = parsed.weightUnit === "kg" ? "kg" : "lb";
      parsed.theme = THEMES.indexOf(parsed.theme) !== -1 ? parsed.theme : "auto";
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  // ---- Theme ------------------------------------------------------------
  function applyTheme(theme) {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);

    var metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
    var metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
    var forced = THEME_COLORS[theme];
    if (forced) {
      if (metaLight) metaLight.setAttribute("content", forced);
      if (metaDark) metaDark.setAttribute("content", forced);
    } else {
      if (metaLight) metaLight.setAttribute("content", "#16a34a");
      if (metaDark) metaDark.setAttribute("content", "#0b1220");
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
    trendsBtn: $("trendsBtn"),
    sheetBackdrop: $("sheetBackdrop"), goalInput: $("goalInput"),
    saveSettings: $("saveSettings"), themeSwatches: $("themeSwatches"),
    exportBtn: $("exportBtn"), importBtn: $("importBtn"), importFile: $("importFile"),
    searchBtn: $("searchBtn"), scanBtn: $("scanBtn"),
    searchSheet: $("searchSheet"), searchInput: $("searchInput"),
    searchScanBtn: $("searchScanBtn"), searchResults: $("searchResults"),
    searchClose: $("searchClose"),
    portionSheet: $("portionSheet"), portionName: $("portionName"), portionSub: $("portionSub"),
    portionSelect: $("portionSelect"), portionAmount: $("portionAmount"),
    portionAmountLabel: $("portionAmountLabel"), portionPreview: $("portionPreview"),
    portionAdd: $("portionAdd"), portionBack: $("portionBack"),
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

  // ---- Sheets ---------------------------------------------------------------
  function openSheet() {
    els.goalInput.value = state.goal;
    updateThemeSwatches();
    els.sheetBackdrop.hidden = false;
    els.settingsSheet.hidden = false;
  }

  function updateThemeSwatches() {
    var buttons = els.themeSwatches.querySelectorAll(".theme-swatch");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-swatch") === state.theme;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-checked", active ? "true" : "false");
    }
  }

  function setTheme(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    state.theme = theme;
    applyTheme(theme);
    save();
    updateThemeSwatches();
  }
  function closeSheet() {
    els.sheetBackdrop.hidden = true;
    els.settingsSheet.hidden = true;
  }
  /* Backdrop and Escape dismiss whichever sheet is on top. */
  function closeAllSheets() {
    closePortion();
    closeSearch();
    closeSheet();
    if (window.FoodieTrends) window.FoodieTrends.close();
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
          weights: data.weights && typeof data.weights === "object" ? data.weights : {},
          weightUnit: data.weightUnit === "kg" ? "kg" : "lb",
          theme: THEMES.indexOf(data.theme) !== -1 ? data.theme : "auto",
        };
        save();
        applyTheme(state.theme);
        render();
        closeSheet();
        if (window.FoodieTrends) window.FoodieTrends.refresh();
        toast("Data imported");
      } catch (e) {
        toast("Import failed — invalid file");
      }
    };
    reader.readAsText(file);
  }

  // ---- Search sheet ---------------------------------------------------------
  var searchTimer = null;
  var searchSeq = 0;          // guards against out-of-order network replies
  var pendingHit = null;      // the hit shown in the portion sheet

  function openSearch() {
    els.sheetBackdrop.hidden = false;
    els.searchSheet.hidden = false;
    els.searchInput.value = "";
    renderSearch([], [], "Search for a food, or scan a barcode.");
    els.searchInput.focus();
  }

  function closeSearch() {
    clearTimeout(searchTimer);
    searchSeq++;              // invalidate any in-flight request
    els.searchSheet.hidden = true;
    if (els.portionSheet.hidden) els.sheetBackdrop.hidden = true;
  }

  /* Bundled results update on every keystroke; the network call is debounced. */
  function onSearchInput() {
    var q = els.searchInput.value.trim();
    clearTimeout(searchTimer);
    var seq = ++searchSeq;

    var common = window.FoodieSearch.searchCommon(q);
    if (q.length < 2) {
      renderSearch([], [], "Type at least two letters.");
      return;
    }
    renderSearch(common, [], common.length ? "" : "Searching…");

    searchTimer = setTimeout(function () {
      window.FoodieSearch.searchProducts(q).then(function (branded) {
        if (seq !== searchSeq) return;
        renderSearch(common, branded,
          common.length || branded.length ? "" : "No matches. Try a shorter word or scan the barcode.");
      });
    }, 350);
  }

  function renderSearch(common, branded, note) {
    els.searchResults.innerHTML = "";

    function group(title, hits) {
      if (!hits.length) return;
      var h = document.createElement("div");
      h.className = "search-group";
      h.textContent = title;
      els.searchResults.appendChild(h);

      hits.forEach(function (hit) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "search-item";
        var sub = (hit.brand ? esc(hit.brand) + "  ·  " : "") +
          Math.round(hit.kcal) + " kcal / 100 g";
        b.innerHTML = '<div class="search-item-name">' + esc(hit.name) + "</div>" +
          '<div class="search-item-sub">' + sub + "</div>";
        b.addEventListener("click", function () { openPortion(hit); });
        els.searchResults.appendChild(b);
      });
    }

    group("Common foods", common);
    group("Branded products", branded);

    if (note) {
      var p = document.createElement("p");
      p.className = "search-note";
      p.textContent = note;
      els.searchResults.appendChild(p);
    }
  }

  // ---- Portion sheet --------------------------------------------------------
  function openPortion(hit) {
    pendingHit = hit;
    els.portionName.textContent = hit.name;
    els.portionSub.textContent = (hit.brand ? hit.brand + "  ·  " : "") +
      Math.round(hit.kcal) + " kcal per 100 g";

    var options = window.FoodieSearch.portionOptions(hit);
    els.portionSelect.innerHTML = "";
    options.forEach(function (o, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = window.FoodieSearch.portionLabel(o);
      els.portionSelect.appendChild(opt);
    });
    var custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom weight";
    els.portionSelect.appendChild(custom);

    els.portionSelect.value = "0";
    els.portionAmount.value = "1";
    updatePortion();

    els.sheetBackdrop.hidden = false;
    els.portionSheet.hidden = false;
  }

  function closePortion() {
    pendingHit = null;
    els.portionSheet.hidden = true;
    if (els.searchSheet.hidden) els.sheetBackdrop.hidden = true;
  }

  /* Grams for the current selection: either a multiple of a named serving, or a
     directly typed weight. Clamped so a stray keypress can't log 10^9 kcal. */
  function portionGrams() {
    if (!pendingHit) return 0;
    var amount = parseFloat(String(els.portionAmount.value).replace(",", "."));
    if (!isFinite(amount) || amount < 0) return 0;
    if (els.portionSelect.value === "custom") return Math.min(amount, 5000);
    var options = window.FoodieSearch.portionOptions(pendingHit);
    var serving = options[parseInt(els.portionSelect.value, 10)] || options[0];
    return Math.min(serving.grams * amount, 5000);
  }

  function updatePortion() {
    if (!pendingHit) return;
    var isCustom = els.portionSelect.value === "custom";
    els.portionAmountLabel.textContent = isCustom ? "Grams" : "How many";

    var grams = portionGrams();
    var e = window.FoodieSearch.entryFor(pendingHit, grams);
    els.portionPreview.innerHTML =
      e.kcal + " kcal  ·  " + Math.round(grams) + " g" +
      '<span class="portion-macros">P ' + e.p + "  ·  C " + e.c + "  ·  F " + e.f + " g</span>";
    els.portionAdd.disabled = e.kcal <= 0;
  }

  function addFromPortion() {
    if (!pendingHit) return;
    var e = window.FoodieSearch.entryFor(pendingHit, portionGrams());
    if (e.kcal <= 0) return;
    addEntry(e.name, e.kcal, e.p, e.c, e.f);
    closePortion();
    closeSearch();
    toast("Added " + e.name);
  }

  // ---- Barcode scanning -----------------------------------------------------
  function startScan() {
    window.FoodieScanner.open(function (code) {
      toast("Looking up…");
      window.FoodieSearch.lookupBarcode(code).then(function (hit) {
        if (els.searchSheet.hidden) {
          els.sheetBackdrop.hidden = false;
          els.searchSheet.hidden = false;
          els.searchInput.value = "";
          renderSearch([], [], "Scanned " + code);
        }
        openPortion(hit);
      }, function (err) {
        toast(err.message || "Couldn't look up that barcode.");
      });
    });
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

  els.searchBtn.addEventListener("click", openSearch);
  els.scanBtn.addEventListener("click", startScan);
  els.searchScanBtn.addEventListener("click", startScan);
  els.searchClose.addEventListener("click", closeSearch);
  els.searchInput.addEventListener("input", onSearchInput);

  els.portionSelect.addEventListener("change", updatePortion);
  els.portionAmount.addEventListener("input", updatePortion);
  els.portionAdd.addEventListener("click", addFromPortion);
  els.portionBack.addEventListener("click", closePortion);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!els.portionSheet.hidden) closePortion();
    else if (!els.searchSheet.hidden) closeSearch();
    else if (!els.settingsSheet.hidden) closeSheet();
    else if (window.FoodieTrends && window.FoodieTrends.isOpen()) window.FoodieTrends.close();
    else window.FoodieScanner.close();
  });

  if (els.trendsBtn) {
    els.trendsBtn.addEventListener("click", function () {
      if (window.FoodieTrends) window.FoodieTrends.open();
    });
  }

  els.settingsBtn.addEventListener("click", openSheet);
  els.sheetBackdrop.addEventListener("click", closeAllSheets);
  els.themeSwatches.addEventListener("click", function (e) {
    var btn = e.target.closest(".theme-swatch");
    if (btn) setTheme(btn.getAttribute("data-swatch"));
  });
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

  // ---- Shared-state API for trends.js ----------------------------------------
  // `state` gets reassigned wholesale on import, so hand out accessors rather
  // than the object itself.
  window.FoodieData = {
    getState: function () { return state; },
    save: save,
    todayKey: todayKey,
    totals: totals,
    openBackdrop: function () { els.sheetBackdrop.hidden = false; },
    closeBackdropIfNoSheets: function () {
      if (els.settingsSheet.hidden && els.searchSheet.hidden && els.portionSheet.hidden) {
        els.sheetBackdrop.hidden = true;
      }
    },
  };

  // ---- Go -------------------------------------------------------------------
  applyTheme(state.theme);
  render();
})();
