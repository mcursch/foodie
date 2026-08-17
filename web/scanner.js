/* Foodie — camera barcode scanner.
 *
 * Uses the native BarcodeDetector API where it exists (Chrome, Edge, Android).
 * Safari has no BarcodeDetector, so iOS falls back to the vendored ZXing build,
 * which is loaded lazily the first time you scan rather than on page load.
 *
 * Requires a secure context (https or localhost) for camera access.
 */
window.FoodieScanner = (function () {
  "use strict";

  var ZXING_SRC = "vendor/zxing.min.js";
  var FRAME_INTERVAL_MS = 120;   // ~8 decode attempts a second is plenty
  var MAX_EDGE = 640;            // downscale frames; barcodes decode fine small

  var ui = null;          // active overlay, or null when closed
  var zxingPromise = null;

  // ---- ZXing (lazy) ---------------------------------------------------------

  function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (zxingPromise) return zxingPromise;
    zxingPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = ZXING_SRC;
      s.async = true;
      s.onload = function () {
        window.ZXing ? resolve(window.ZXing) : reject(new Error("ZXing failed to load"));
      };
      s.onerror = function () {
        zxingPromise = null;
        reject(new Error("ZXing failed to load"));
      };
      document.head.appendChild(s);
    });
    return zxingPromise;
  }

  function makeZXingReader(Z) {
    var hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
      Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E,
      Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39,
      Z.BarcodeFormat.ITF,
    ]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    var reader = new Z.MultiFormatReader();
    reader.setHints(hints);

    return function decode(canvas) {
      try {
        var source = new Z.HTMLCanvasElementLuminanceSource(canvas);
        var bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
        var result = reader.decode(bitmap);
        return result ? result.getText() : null;
      } catch (e) {
        return null;   // NotFoundException on every frame without a barcode
      } finally {
        reader.reset();
      }
    };
  }

  // ---- Overlay --------------------------------------------------------------

  function buildOverlay() {
    var root = document.createElement("div");
    root.className = "scanner";
    root.innerHTML =
      '<div class="scanner-video-wrap">' +
        '<video class="scanner-video" playsinline muted autoplay></video>' +
        '<div class="scanner-reticle"></div>' +
      "</div>" +
      '<p class="scanner-hint">Point the camera at a product barcode</p>' +
      '<div class="scanner-manual" hidden>' +
        '<label for="scanManual">Or type the barcode number</label>' +
        '<input id="scanManual" class="in" type="text" inputmode="numeric" ' +
               'autocomplete="off" placeholder="e.g. 5010251953760" maxlength="14" />' +
        '<button type="button" class="btn-primary scanner-lookup">Look up</button>' +
      "</div>" +
      '<div class="scanner-actions">' +
        '<button type="button" class="btn-ghost scanner-torch" hidden>💡 Light</button>' +
        '<button type="button" class="btn-ghost scanner-close">Cancel</button>' +
      "</div>";
    document.body.appendChild(root);
    return root;
  }

  function showManualEntry(root, message) {
    root.querySelector(".scanner-video-wrap").hidden = true;
    root.querySelector(".scanner-torch").hidden = true;
    root.querySelector(".scanner-hint").textContent = message;
    root.querySelector(".scanner-manual").hidden = false;
    root.querySelector("#scanManual").focus();
  }

  // ---- Public API -----------------------------------------------------------

  /* Opens the scanner. `onCode(code)` fires once with the barcode, then the
     scanner closes itself. */
  function open(onCode) {
    close();

    var root = buildOverlay();
    var video = root.querySelector(".scanner-video");
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var stream = null;
    var timer = null;
    var done = false;

    ui = {
      root: root,
      stop: function () {
        done = true;
        clearTimeout(timer);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        video.srcObject = null;
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };

    function finish(code) {
      if (done) return;
      if (navigator.vibrate) navigator.vibrate(40);
      close();
      onCode(String(code).trim());
    }

    function manual() {
      var input = root.querySelector("#scanManual");
      var submit = function () {
        var v = input.value.replace(/\D/g, "");
        if (v.length >= 6) finish(v);
      };
      root.querySelector(".scanner-lookup").addEventListener("click", submit);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
    }
    manual();

    root.querySelector(".scanner-close").addEventListener("click", function () { close(); });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showManualEntry(root, window.isSecureContext === false
        ? "Camera needs a secure (https) connection."
        : "This browser can't use the camera.");
      return;
    }

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
    }).then(function (s) {
      if (done) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      setUpTorch(root, s);
      return video.play().catch(function () { /* autoplay policies; frames still arrive */ });
    }).then(function () {
      if (done || !stream) return;
      return getDecoder();
    }).then(function (decode) {
      if (done || !decode) return;
      tick(decode);
    }).catch(function (err) {
      if (done) return;
      var denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      showManualEntry(root, denied
        ? "Camera access was blocked. Type the number instead."
        : "Couldn't start the camera. Type the number instead.");
    });

    /* Native detector when available, otherwise the lazily-loaded ZXing one. */
    function getDecoder() {
      if ("BarcodeDetector" in window) {
        var detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
        });
        return Promise.resolve(function (source) {
          return detector.detect(source).then(function (codes) {
            return codes.length ? codes[0].rawValue : null;
          });
        });
      }
      return loadZXing().then(function (Z) {
        var zdecode = makeZXingReader(Z);
        return function (source) { return Promise.resolve(zdecode(source)); };
      });
    }

    function tick(decode) {
      if (done) return;
      var w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) { timer = setTimeout(function () { tick(decode); }, FRAME_INTERVAL_MS); return; }

      var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      Promise.resolve(decode(canvas)).then(function (code) {
        if (done) return;
        if (code) finish(code);
        else timer = setTimeout(function () { tick(decode); }, FRAME_INTERVAL_MS);
      }).catch(function () {
        if (!done) timer = setTimeout(function () { tick(decode); }, FRAME_INTERVAL_MS);
      });
    }
  }

  /* Offer the torch only when the camera track actually supports it. */
  function setUpTorch(root, stream) {
    var track = stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    var caps;
    try { caps = track.getCapabilities(); } catch (e) { return; }
    if (!caps || !caps.torch) return;

    var btn = root.querySelector(".scanner-torch");
    var on = false;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      on = !on;
      track.applyConstraints({ advanced: [{ torch: on }] }).catch(function () {});
      btn.classList.toggle("is-on", on);
    });
  }

  function close() {
    if (ui) { ui.stop(); ui = null; }
  }

  return { open: open, close: close };
})();
