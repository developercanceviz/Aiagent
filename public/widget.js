/**
 * Canceviz AI — embeddable Web Chat loader.
 * Usage on the store:
 *   <script src="https://YOUR_DEPLOY/widget.js" data-merchant="MERCHANT_ID"></script>
 *
 * Injects a floating bubble + an iframe pointing at /widget/<merchantId>.
 * Themed via the public widget config endpoint.
 */
(function () {
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var merchantId = script.getAttribute("data-merchant");
  if (!merchantId) {
    console.error("[canceviz-widget] data-merchant is required");
    return;
  }
  var origin = new URL(script.src).origin;

  function build(config) {
    var primary = (config && config.primaryColor) || "#14DAAA";
    var size = (config && config.bubbleSize) || 60;
    var rightSide = !config || config.position !== "bottom-left";

    // Bubble
    var bubble = document.createElement("button");
    bubble.setAttribute("aria-label", "Sohbeti aç");
    bubble.style.cssText =
      "position:fixed;bottom:20px;" +
      (rightSide ? "right:20px;" : "left:20px;") +
      "width:" + size + "px;height:" + size + "px;border:none;border-radius:9999px;" +
      "background:" + primary + ";box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;" +
      "z-index:2147483646;display:flex;align-items:center;justify-content:center;";
    bubble.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' +
      ((config && config.bubbleIcon) || "#101216") +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    // Iframe panel
    var frame = document.createElement("iframe");
    frame.src = origin + "/widget/" + encodeURIComponent(merchantId);
    frame.style.cssText =
      "position:fixed;bottom:90px;" +
      (rightSide ? "right:20px;" : "left:20px;") +
      "width:380px;max-width:calc(100vw - 40px);height:600px;max-height:calc(100vh - 120px);" +
      "border:none;border-radius:24px;box-shadow:0 16px 48px rgba(0,0,0,.24);" +
      "z-index:2147483647;display:none;background:#fff;";

    var open = false;
    function toggle() {
      open = !open;
      frame.style.display = open ? "block" : "none";
    }
    bubble.addEventListener("click", toggle);
    window.addEventListener("message", function (e) {
      if (e.data === "canceviz:close") {
        open = false;
        frame.style.display = "none";
      }
    });

    document.body.appendChild(frame);
    document.body.appendChild(bubble);
  }

  fetch(origin + "/api/widget/" + encodeURIComponent(merchantId) + "/config")
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (cfg) {
      if (cfg && cfg.active === false) return;
      build(cfg);
    })
    .catch(function () {
      build(null);
    });
})();
