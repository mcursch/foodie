/* Foodie — food lookup.
 *
 * Two sources, both free and key-less:
 *   1. foods.js — a bundled table of common whole foods. Instant and offline.
 *   2. Open Food Facts — branded products and barcodes.
 *
 * Only the CORS-enabled Open Food Facts hosts are used here. The faster
 * search.openfoodfacts.org endpoint sends no Access-Control-Allow-Origin, so
 * browsers can't reach it; the legacy cgi/search.pl can, but sheds load with a
 * 503 under pressure, hence the retry below. Barcode lookups use the v2 product
 * endpoint, which is both CORS-enabled and reliable.
 *
 * Everything is normalised to per-100 g macros so one portion calculation
 * serves both sources.
 */
window.FoodieSearch = (function () {
  "use strict";

  var SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
  var PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/";
  var FIELDS = "code,product_name,brands,nutriments,serving_size";
  var TIMEOUT_MS = 12000;

  // Barcodes never change their nutrition, so remember them for this page load.
  var barcodeCache = {};

  // ---- Bundled table --------------------------------------------------------

  // Rows: [id, name, kcal, p, c, f, servings]
  var COMMON = (window.FOODIE_COMMON_FOODS || []).map(function (r) {
    return {
      id: "common:" + r[0],
      name: r[1],
      brand: "",
      kcal: r[2], p: r[3], c: r[4], f: r[5],
      servings: (r[6] || []).map(function (s) { return { label: s[0], grams: s[1] }; }),
      source: "common",
    };
  });

  function normalize(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* Higher is better, 0 means no match. Whole-name prefixes beat word starts,
     so "chick" ranks "Chicken breast" above "Chickpeas". Shorter names win ties. */
  function score(name, q) {
    var n = normalize(name);
    var i = n.indexOf(q);
    if (i < 0) return 0;
    var base = i === 0 ? 100 : (/[\s,\-]/.test(n.charAt(i - 1)) ? 60 : 20);
    return base - Math.floor(n.length / 4);
  }

  function searchCommon(query, limit) {
    var q = normalize(String(query).trim());
    if (q.length < 2) return [];
    var scored = [];
    for (var i = 0; i < COMMON.length; i++) {
      var s = score(COMMON[i].name, q);
      if (s > 0) scored.push({ food: COMMON[i], s: s, i: i });
    }
    scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return scored.slice(0, limit || 8).map(function (x) { return x.food; });
  }

  // ---- Open Food Facts ------------------------------------------------------

  function fetchJson(url) {
    // AbortController keeps a stalled request from hanging the search forever.
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      headers: { Accept: "application/json" },
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = new Error("http " + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function num(nutriments, key) {
    if (!nutriments) return null;
    var v = nutriments[key];
    if (typeof v === "string") v = parseFloat(v);
    if (typeof v !== "number" || !isFinite(v) || v < 0) return null;
    return v;
  }

  /* "30 g", "1 cup (240ml)", "50g" -> grams. null when there's no gram figure. */
  function parseGrams(text) {
    if (!text) return null;
    var m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    if (!m) return null;
    var v = parseFloat(m[1].replace(",", "."));
    return isFinite(v) && v > 0 && v <= 2000 ? v : null;
  }

  /* `brands` is a comma-joined string on the product endpoint and an array on
     the search endpoint. Take the first name either way. */
  function firstBrand(brands) {
    if (Array.isArray(brands)) return brands.length ? String(brands[0]).trim() : "";
    if (typeof brands === "string") return brands.split(",")[0].trim();
    return "";
  }

  /* Normalise one OFF product, or null when it has no usable calorie figure. */
  function toHit(p, codeOverride) {
    if (!p) return null;
    var name = String(p.product_name || "").trim();
    if (!name) return null;

    var n = p.nutriments;
    var kcal = num(n, "energy-kcal_100g");
    if (kcal === null) kcal = num(n, "energy-kcal");
    if (kcal === null) {
      var kj = num(n, "energy_100g");
      if (kj === null) kj = num(n, "energy");
      if (kj === null) return null;
      kcal = kj / 4.184;
    }
    // Nothing edible exceeds ~900 kcal/100 g (pure fat); above that the entry is bad data.
    if (!(kcal > 0) || kcal > 900) return null;

    var servings = [];
    var grams = parseGrams(p.serving_size);
    if (grams) servings.push({ label: String(p.serving_size).trim(), grams: grams });

    return {
      id: "off:" + (codeOverride || p.code || name),
      name: name,
      brand: firstBrand(p.brands),
      kcal: kcal,
      p: num(n, "proteins_100g") || num(n, "proteins") || 0,
      c: num(n, "carbohydrates_100g") || num(n, "carbohydrates") || 0,
      f: num(n, "fat_100g") || num(n, "fat") || 0,
      servings: servings,
      source: "off",
    };
  }

  /* Branded matches. Resolves to [] on any failure — bundled results still show. */
  function searchProducts(query, limit) {
    var q = String(query).trim();
    if (q.length < 2) return Promise.resolve([]);
    var url = SEARCH_URL +
      "?search_terms=" + encodeURIComponent(q) +
      "&search_simple=1&action=process&json=1" +
      "&page_size=" + (limit || 20) +
      "&fields=" + FIELDS;

    function attempt(retriesLeft) {
      return fetchJson(url).catch(function (e) {
        // 503 means the shared instance is shedding load; one retry usually lands.
        if (retriesLeft > 0 && e.status === 503) {
          return new Promise(function (r) { setTimeout(r, 600); }).then(function () {
            return attempt(retriesLeft - 1);
          });
        }
        throw e;
      });
    }

    return attempt(1).then(function (data) {
      var products = (data && data.products) || [];
      var out = [];
      // OFF holds one entry per country/packaging, so a popular product comes
      // back a dozen times. Collapse rows that agree on brand, name and kcal.
      var seen = {};
      for (var i = 0; i < products.length; i++) {
        var hit = toHit(products[i]);
        if (!hit) continue;
        var key = normalize(hit.brand + "|" + hit.name) + "|" + Math.round(hit.kcal);
        if (seen[key]) continue;
        seen[key] = true;
        out.push(hit);
      }
      return out;
    }, function () {
      return [];
    });
  }

  /* Barcode lookup. Rejects with a user-facing `.message` so the UI can show it. */
  function lookupBarcode(code) {
    var c = String(code).trim();
    if (!/^\d{6,14}$/.test(c)) {
      return Promise.reject(new Error("That doesn't look like a barcode."));
    }
    if (barcodeCache[c]) return Promise.resolve(barcodeCache[c]);

    return fetchJson(PRODUCT_URL + encodeURIComponent(c) + ".json?fields=" + FIELDS)
      .catch(function (e) {
        if (e.status === 404) throw new Error("No product found for that barcode.");
        throw new Error(
          navigator.onLine
            ? "Food database is busy. Try again in a moment."
            : "You're offline — bundled foods still work."
        );
      })
      .then(function (data) {
        if (!data || data.status !== 1 || !data.product) {
          throw new Error("No product found for that barcode.");
        }
        var hit = toHit(data.product, c);
        if (!hit) throw new Error("That product has no nutrition data yet.");
        barcodeCache[c] = hit;
        return hit;
      });
  }

  // ---- Portions -------------------------------------------------------------

  /* Portions offered in the picker: the food's own servings, then 100 g. */
  function portionOptions(hit) {
    return (hit.servings || []).concat([{ label: "100 g", grams: 100 }]);
  }

  /* Picker text for a serving. Open Food Facts labels often already spell out
     the weight ("1 portion (40 g)"), so only append it when it's missing. */
  function portionLabel(serving) {
    if (/\d\s*g\b/i.test(serving.label)) return serving.label;
    return serving.label + " (" + Math.round(serving.grams) + " g)";
  }

  /* Scale a hit to a gram weight and round into the integer log-entry shape. */
  function entryFor(hit, grams) {
    var k = grams / 100;
    var title = hit.brand ? hit.brand + " " + hit.name : hit.name;
    return {
      name: title,
      kcal: Math.round(hit.kcal * k),
      p: Math.round(hit.p * k),
      c: Math.round(hit.c * k),
      f: Math.round(hit.f * k),
    };
  }

  return {
    searchCommon: searchCommon,
    searchProducts: searchProducts,
    lookupBarcode: lookupBarcode,
    portionOptions: portionOptions,
    portionLabel: portionLabel,
    entryFor: entryFor,
  };
})();
