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

  var mobileQuery = window.matchMedia("(max-width: 640px)");

  function build(config) {
    var primary = (config && config.primaryColor) || "#14DAAA";
    var size = (config && config.bubbleSize) || 60;
    var rightSide = !config || config.position !== "bottom-left";

    // Bubble
    var bubble = document.createElement("button");
    bubble.setAttribute("aria-label", "Sohbeti aç");
    bubble.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' +
      ((config && config.bubbleIcon) || "#101216") +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    // Iframe panel
    var frame = document.createElement("iframe");
    frame.src = origin + "/widget/" + encodeURIComponent(merchantId);

    var open = false;

    // Responsive layout, re-applied on viewport changes:
    //  - mobile: bubble raised above store bottom bars ("Hesabım" row);
    //    panel opens full-screen (100dvh handles iOS URL-bar chrome).
    //  - desktop: classic floating 380x600 panel above the bubble.
    function layout() {
      var mobile = mobileQuery.matches;
      bubble.style.cssText =
        "position:fixed;" +
        "bottom:" + (mobile ? "84px" : "20px") + ";" +
        (rightSide ? "right:16px;" : "left:16px;") +
        "width:" + size + "px;height:" + size + "px;border:none;border-radius:9999px;" +
        "background:" + primary + ";box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;" +
        "z-index:2147483646;display:flex;align-items:center;justify-content:center;";
      frame.style.cssText =
        "position:fixed;border:none;background:#fff;z-index:2147483647;" +
        "display:" + (open ? "block" : "none") + ";" +
        (mobile
          ? "top:0;left:0;right:0;bottom:0;width:100vw;height:100%;height:100dvh;border-radius:0;"
          : "bottom:90px;" +
            (rightSide ? "right:20px;" : "left:20px;") +
            "width:380px;max-width:calc(100vw - 40px);height:600px;max-height:calc(100vh - 120px);" +
            "border-radius:24px;box-shadow:0 16px 48px rgba(0,0,0,.24);");
    }
    layout();
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener("change", layout);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(layout); // older Safari
    }

    function toggle() {
      open = !open;
      layout();
    }
    bubble.addEventListener("click", toggle);
    window.addEventListener("message", function (e) {
      if (e.data === "canceviz:close") {
        open = false;
        layout();
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
