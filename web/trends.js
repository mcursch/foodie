/* Foodie trends — body-weight history and calorie-goal consistency, both as
 * small inline SVG charts. Reads/writes the same localStorage state as app.js
 * via the window.FoodieData accessors it exposes. */
(function () {
  "use strict";

  var KG_PER_LB = 0.45359237;

  // ---- Unit helpers -----------------------------------------------------------
  function kgToUnit(kg, unit) { return unit === "kg" ? kg : kg / KG_PER_LB; }
  function unitToKg(v, unit) { return unit === "kg" ? v : v * KG_PER_LB; }
  function fmt1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  // ---- Date helpers -------------------------------------------------------------
  function keyToDate(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function shortLabel(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---- DOM refs -----------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    sheet: $("trendsSheet"),
    tabs: $("trendsTabs"),
    panelWeight: $("trendsPanelWeight"),
    panelCalories: $("trendsPanelCalories"),
    weightInput: $("weightInput"),
    weightUnitToggle: $("weightUnitToggle"),
    weightLogBtn: $("weightLogBtn"),
    weightRangeToggle: $("weightRangeToggle"),
    weightChart: $("weightChart"),
    weightChartWrap: $("weightChartWrap"),
    weightEmpty: $("weightEmpty"),
    weightStats: $("weightStats"),
    calorieRangeToggle: $("calorieRangeToggle"),
    calorieChart: $("calorieChart"),
    calorieChartWrap: $("calorieChartWrap"),
    calorieEmpty: $("calorieEmpty"),
    calorieAdherence: $("calorieAdherence"),
    close: $("trendsClose"),
  };
  if (!els.sheet) return; // markup not present (shouldn't happen, but stay safe)

  var weightRangeDays = 90;
  var calorieRangeDays = 14;

  // ---- Open / close ---------------------------------------------------------
  function open() {
    window.FoodieData.openBackdrop();
    els.sheet.hidden = false;
    refresh();
  }
  function close() {
    els.sheet.hidden = true;
    window.FoodieData.closeBackdropIfNoSheets();
  }
  function isOpen() { return !els.sheet.hidden; }

  function refresh() {
    var unit = window.FoodieData.getState().weightUnit;
    setActive(els.weightUnitToggle, "unit", unit);
    els.weightInput.placeholder = unit === "kg" ? "Weight (kg)" : "Weight (lb)";
    prefillWeightInput();
    renderWeight();
    renderCalories();
  }

  // ---- Tabs -------------------------------------------------------------------
  els.tabs.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    var tab = btn.getAttribute("data-tab");
    setActive(els.tabs, "tab", tab);
    els.panelWeight.hidden = tab !== "weight";
    els.panelCalories.hidden = tab !== "calories";
  });

  function setActive(container, dataAttr, value) {
    var buttons = container.querySelectorAll(".seg-btn, .range-btn");
    for (var i = 0; i < buttons.length; i++) {
      var match = buttons[i].getAttribute("data-" + dataAttr) === value;
      buttons[i].classList.toggle("is-active", match);
      if (buttons[i].hasAttribute("aria-selected")) {
        buttons[i].setAttribute("aria-selected", match ? "true" : "false");
      }
    }
  }

  // ---- Weight -----------------------------------------------------------------
  function weightEntries() {
    var weights = window.FoodieData.getState().weights;
    return Object.keys(weights)
      .map(function (k) { return { key: k, date: keyToDate(k), kg: weights[k] }; })
      .sort(function (a, b) { return a.date - b.date; });
  }

  function prefillWeightInput() {
    var today = window.FoodieData.todayKey();
    var kg = window.FoodieData.getState().weights[today];
    var unit = window.FoodieData.getState().weightUnit;
    els.weightInput.value = kg == null ? "" : fmt1(kgToUnit(kg, unit));
  }

  function logWeight() {
    var v = parseFloat(String(els.weightInput.value).replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    var unit = window.FoodieData.getState().weightUnit;
    var kg = unitToKg(v, unit);
    if (kg <= 0 || kg >= 700) return;
    var state = window.FoodieData.getState();
    state.weights[window.FoodieData.todayKey()] = kg;
    window.FoodieData.save();
    renderWeight();
  }

  function renderWeight() {
    var all = weightEntries();
    var unit = window.FoodieData.getState().weightUnit;
    var entries = all;
    if (weightRangeDays > 0) {
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weightRangeDays);
      entries = all.filter(function (e) { return e.date >= cutoff; });
    }

    els.weightEmpty.hidden = all.length > 0;
    els.weightChartWrap.hidden = all.length === 0;
    els.weightStats.hidden = all.length === 0;
    if (all.length === 0) { els.weightStats.innerHTML = ""; return; }

    var values = entries.map(function (e) { return kgToUnit(e.kg, unit); });
    drawLineChart(els.weightChart, entries.map(function (e) { return e.date; }), values);

    var current = values.length ? values[values.length - 1] : null;
    var first = values.length ? values[0] : null;
    var change = current != null && first != null ? current - first : null;
    els.weightStats.innerHTML =
      statBlock("Current", current == null ? "—" : fmt1(current) + " " + unit) +
      statBlock("Change", change == null ? "—" : (change > 0 ? "+" : "") + fmt1(change) + " " + unit,
        change != null && change > 0 ? "stat-bad" : "stat-good");
  }

  function statBlock(label, value, cls) {
    return '<div class="trend-stat"><div class="trend-stat-val ' + (cls || "") + '">' + value + "</div>" +
      '<div class="trend-stat-label">' + label + "</div></div>";
  }

  els.weightLogBtn.addEventListener("click", logWeight);
  els.weightInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") logWeight();
  });
  els.weightUnitToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    window.FoodieData.getState().weightUnit = btn.getAttribute("data-unit");
    window.FoodieData.save();
    refresh();
  });
  els.weightRangeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".range-btn");
    if (!btn) return;
    weightRangeDays = parseInt(btn.getAttribute("data-range"), 10) || 0;
    setActive(els.weightRangeToggle, "range", btn.getAttribute("data-range"));
    renderWeight();
  });

  // ---- Calories -----------------------------------------------------------------
  function dailyTotals(count) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var out = [];
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      out.push({ date: d, kcal: window.FoodieData.totals(key).kcal });
    }
    return out;
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function renderCalories() {
    var data = dailyTotals(calorieRangeDays);
    var logged = data.filter(function (d) { return d.kcal > 0; });
    var goal = window.FoodieData.getState().goal;

    els.calorieEmpty.hidden = logged.length > 0;
    els.calorieChartWrap.hidden = logged.length === 0;
    els.calorieAdherence.hidden = logged.length === 0;
    if (logged.length === 0) { els.calorieAdherence.textContent = ""; return; }

    drawBarChart(els.calorieChart, data, goal);
    var onGoal = logged.filter(function (d) { return d.kcal <= goal; }).length;
    els.calorieAdherence.textContent = onGoal + " of " + logged.length + " logged " +
      (logged.length === 1 ? "day" : "days") + " at or under goal";
  }

  els.calorieRangeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".range-btn");
    if (!btn) return;
    calorieRangeDays = parseInt(btn.getAttribute("data-range"), 10) || 14;
    setActive(els.calorieRangeToggle, "range", btn.getAttribute("data-range"));
    renderCalories();
  });

  els.close.addEventListener("click", close);

  // ---- SVG chart rendering -------------------------------------------------------
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  var PAD_L = 38, PAD_R = 10, PAD_T = 14, PAD_B = 22, W = 300, H = 160;

  function drawLineChart(svg, dates, values) {
    svg.innerHTML = "";
    if (!values.length) return;

    var minV = Math.min.apply(null, values);
    var maxV = Math.max.apply(null, values);
    if (minV === maxV) { minV -= 1; maxV += 1; }
    var pad = (maxV - minV) * 0.1;
    minV -= pad; maxV += pad;

    var minD = dates[0].getTime(), maxD = dates[dates.length - 1].getTime();
    if (minD === maxD) { minD -= 1; maxD += 1; }

    function x(d) { return PAD_L + ((d.getTime() - minD) / (maxD - minD)) * (W - PAD_L - PAD_R); }
    function y(v) { return PAD_T + (1 - (v - minV) / (maxV - minV)) * (H - PAD_T - PAD_B); }

    // gridlines + y labels (min/max)
    [minV + pad, maxV - pad].forEach(function (v) {
      svg.appendChild(svgEl("line", {
        x1: PAD_L, x2: W - PAD_R, y1: y(v), y2: y(v),
        class: "chart-grid",
      }));
      svg.appendChild(svgEl("text", {
        x: PAD_L - 6, y: y(v) + 3, class: "chart-axis-label", "text-anchor": "end",
      })).textContent = fmt1(v);
    });

    // x labels: first + last date
    svg.appendChild(svgEl("text", {
      x: x(dates[0]), y: H - 4, class: "chart-axis-label", "text-anchor": "start",
    })).textContent = shortLabel(dates[0]);
    svg.appendChild(svgEl("text", {
      x: x(dates[dates.length - 1]), y: H - 4, class: "chart-axis-label", "text-anchor": "end",
    })).textContent = shortLabel(dates[dates.length - 1]);

    var points = values.map(function (v, i) { return x(dates[i]) + "," + y(v); });

    // area fill under the line
    var area = "M" + points[0] + " L" + points.join(" L") +
      " L" + x(dates[dates.length - 1]) + "," + y(minV) + " L" + x(dates[0]) + "," + y(minV) + " Z";
    svg.appendChild(svgEl("path", { d: area, class: "chart-area" }));

    svg.appendChild(svgEl("polyline", { points: points.join(" "), class: "chart-line" }));

    values.forEach(function (v, i) {
      var r = i === values.length - 1 ? 3.5 : 2.5;
      svg.appendChild(svgEl("circle", {
        cx: x(dates[i]), cy: y(v), r: r,
        class: i === values.length - 1 ? "chart-point chart-point-last" : "chart-point",
      }));
    });
  }

  function drawBarChart(svg, data, goal) {
    svg.innerHTML = "";
    var maxV = Math.max(goal, Math.max.apply(null, data.map(function (d) { return d.kcal; }))) * 1.08;
    if (maxV <= 0) maxV = goal || 1;

    var innerW = W - PAD_L - PAD_R;
    var innerH = H - PAD_T - PAD_B;
    var gap = 2;
    var barW = Math.max(1, innerW / data.length - gap);

    function y(v) { return PAD_T + (1 - v / maxV) * innerH; }

    // goal line
    var gy = y(goal);
    svg.appendChild(svgEl("line", {
      x1: PAD_L, x2: W - PAD_R, y1: gy, y2: gy, class: "chart-goal-line",
    }));
    svg.appendChild(svgEl("text", {
      x: W - PAD_R, y: gy - 4, class: "chart-axis-label", "text-anchor": "end",
    })).textContent = "Goal";

    data.forEach(function (d, i) {
      var bx = PAD_L + i * (innerW / data.length) + gap / 2;
      var barH = Math.max(0, innerH - (y(d.kcal) - PAD_T));
      var cls = d.kcal === 0 ? "bar-none" : (d.kcal <= goal ? "bar-good" : "bar-over");
      svg.appendChild(svgEl("rect", {
        x: bx, y: y(d.kcal), width: barW, height: d.kcal === 0 ? 0 : barH,
        class: "chart-bar " + cls, rx: 1.5,
      }));
    });

    svg.appendChild(svgEl("text", {
      x: PAD_L, y: H - 4, class: "chart-axis-label", "text-anchor": "start",
    })).textContent = shortLabel(data[0].date);
    svg.appendChild(svgEl("text", {
      x: W - PAD_R, y: H - 4, class: "chart-axis-label", "text-anchor": "end",
    })).textContent = shortLabel(data[data.length - 1].date);
  }

  window.FoodieTrends = { open: open, close: close, isOpen: isOpen, refresh: refresh };
})();
