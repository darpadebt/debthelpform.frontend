(function () {
  "use strict";

  var SITE = "DHF";
  var SESSION_COOKIE = "gfsr_sid";
  var VISITOR_KEY = "gfsr_vid";
  var FORM_START_KEY = "gfsr_form_start";
  var SHOW_FORM_KEY = "gfsr_show_form";
  var CTA_RATE_LIMIT = 10;
  var CTA_RATE_WINDOW_MS = 60 * 1000;
  var HEARTBEAT_INTERVAL_MS = 15 * 1000;
  var SCROLL_THRESHOLDS = [25, 50, 75];

  function nowMs() {
    return Date.now();
  }

  function safeGetCookie(name) {
    try {
      var cookies = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < cookies.length; i++) {
        var part = cookies[i].trim();
        if (part.indexOf(name + "=") === 0) {
          return part.substring(name.length + 1);
        }
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function safeSetCookie(name, value) {
    try {
      document.cookie =
        name +
        "=" +
        value +
        "; Path=/; SameSite=Lax";
    } catch (err) {
      return false;
    }
    return true;
  }

  function safeGetLocalStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeSetLocalStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeGetSessionStorage(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeSetSessionStorage(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function randomId(prefix) {
    return prefix + Math.random().toString(36).slice(2) + "_" + nowMs();
  }

  function getSessionId() {
    var existing = safeGetCookie(SESSION_COOKIE);
    if (existing) {
      return existing;
    }
    var sid = randomId("sid_");
    safeSetCookie(SESSION_COOKIE, sid);
    return sid;
  }

  function getVisitorId() {
    var existing = safeGetLocalStorage(VISITOR_KEY);
    if (existing) {
      return existing;
    }
    var vid = randomId("vid_");
    safeSetLocalStorage(VISITOR_KEY, vid);
    return vid;
  }

  function basePayload() {
    return {
      site: SITE,
      path: window.location.pathname + window.location.search + window.location.hash,
      referrer: document.referrer || "",
      ts: nowMs(),
      sessionId: getSessionId(),
      visitorId: getVisitorId()
    };
  }

  function dispatchShowForm(detail) {
    if (safeGetSessionStorage(SHOW_FORM_KEY)) {
      return;
    }
    safeSetSessionStorage(SHOW_FORM_KEY, "1");
    try {
      window.dispatchEvent(new CustomEvent("gfsr:showLeadForm", { detail: detail }));
    } catch (err) {
      return;
    }
  }

  function sendNow(payload) {
    try {
      fetch("/api/mesh/038-engagement-router/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        keepalive: true
      })
        .then(function (response) {
          if (!response || !response.ok) {
            return null;
          }
          return response
            .json()
            .then(function (data) {
              if (data && data.action === "show_form") {
                dispatchShowForm(data);
              }
              return null;
            })
            .catch(function () {
              return null;
            });
        })
        .catch(function () {
          return null;
        });
    } catch (err) {
      return;
    }
  }

  function send(payload, immediate) {
    if (immediate) {
      sendNow(payload);
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(
        function () {
          sendNow(payload);
        },
        { timeout: 2000 }
      );
    } else {
      window.setTimeout(function () {
        sendNow(payload);
      }, 0);
    }
  }

  function isLikelyCta(element) {
    if (!element) {
      return false;
    }
    var tag = (element.tagName || "").toLowerCase();
    if (tag !== "a" && tag !== "button") {
      return false;
    }
    var text = (element.textContent || "").toLowerCase();
    var textMatch =
      text.indexOf("start") !== -1 ||
      text.indexOf("free") !== -1 ||
      text.indexOf("eligibility") !== -1 ||
      text.indexOf("get started") !== -1 ||
      text.indexOf("check") !== -1;
    if (textMatch) {
      return true;
    }
    var attr =
      (element.getAttribute("id") || "") +
      " " +
      (element.getAttribute("class") || "");
    attr = attr.toLowerCase();
    return (
      attr.indexOf("cta") !== -1 ||
      attr.indexOf("start") !== -1 ||
      attr.indexOf("eligib") !== -1 ||
      attr.indexOf("form") !== -1 ||
      element.hasAttribute("data-cta")
    );
  }

  function selectorHint(element) {
    if (!element) {
      return "";
    }
    var hint = (element.tagName || "").toLowerCase();
    var id = element.getAttribute("id");
    var cls = element.getAttribute("class");
    if (id) {
      hint += "#" + id;
    }
    if (cls) {
      var firstClass = cls.trim().split(/\s+/)[0];
      if (firstClass) {
        hint += "." + firstClass;
      }
    }
    return hint;
  }

  function isLeadForm(form) {
    if (!form || form.nodeName !== "FORM") {
      return false;
    }
    var attr =
      (form.getAttribute("id") || "") +
      " " +
      (form.getAttribute("class") || "");
    attr = attr.toLowerCase();
    if (
      attr.indexOf("lead") !== -1 ||
      attr.indexOf("debt") !== -1 ||
      attr.indexOf("eligib") !== -1 ||
      attr.indexOf("form") !== -1 ||
      attr.indexOf("start") !== -1
    ) {
      return true;
    }
    var inputs = form.querySelectorAll("input, select, textarea");
    return inputs.length >= 2;
  }

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      var payload = basePayload();
      payload.kind = "page_view";
      send(payload, true);
    },
    { passive: true }
  );

  var heartbeatVisible = !document.hidden;
  var heartbeatLast = nowMs();
  var heartbeatAccum = 0;

  function handleVisibility() {
    heartbeatVisible = !document.hidden;
    heartbeatLast = nowMs();
  }

  document.addEventListener("visibilitychange", handleVisibility, { passive: true });

  window.setInterval(function () {
    if (!heartbeatVisible) {
      return;
    }
    var current = nowMs();
    var deltaSec = (current - heartbeatLast) / 1000;
    heartbeatLast = current;
    if (deltaSec <= 0) {
      return;
    }
    heartbeatAccum += deltaSec;
    var payload = basePayload();
    payload.kind = "heartbeat";
    payload.timeOnPageSec = Math.round(heartbeatAccum);
    heartbeatAccum = 0;
    send(payload, false);
  }, HEARTBEAT_INTERVAL_MS);

  var scrollMax = 0;
  var scrollTimeout = null;
  var scrollSent = {};

  function computeScrollPct() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
    var scrollHeight = Math.max(
      body.scrollHeight,
      doc.scrollHeight,
      body.offsetHeight,
      doc.offsetHeight,
      body.clientHeight,
      doc.clientHeight
    );
    var viewport = window.innerHeight || doc.clientHeight || 0;
    var denom = scrollHeight - viewport;
    if (denom <= 0) {
      return 100;
    }
    return Math.max(0, Math.min(100, (scrollTop / denom) * 100));
  }

  function handleScroll() {
    if (scrollTimeout) {
      window.clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(function () {
      var pct = computeScrollPct();
      if (pct > scrollMax) {
        scrollMax = pct;
      }
      SCROLL_THRESHOLDS.forEach(function (threshold) {
        if (scrollMax >= threshold && !scrollSent[threshold]) {
          scrollSent[threshold] = true;
          var payload = basePayload();
          payload.kind = "scroll";
          payload.scrollPct = threshold;
          send(payload, false);
        }
      });
    }, 200);
  }

  window.addEventListener("scroll", handleScroll, { passive: true });

  var ctaCount = 0;
  var ctaWindowStart = nowMs();

  function allowCta() {
    var current = nowMs();
    if (current - ctaWindowStart > CTA_RATE_WINDOW_MS) {
      ctaWindowStart = current;
      ctaCount = 0;
    }
    if (ctaCount >= CTA_RATE_LIMIT) {
      return false;
    }
    ctaCount += 1;
    return true;
  }

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!target) {
        return;
      }
      var element = target.closest("a, button");
      if (!element) {
        return;
      }
      if (!isLikelyCta(element)) {
        return;
      }
      if (!allowCta()) {
        return;
      }
      var payload = basePayload();
      payload.kind = "cta_click";
      payload.label = (element.textContent || "").trim().slice(0, 120);
      payload.selectorHint = selectorHint(element);
      send(payload, false);
    },
    { passive: true }
  );

  document.addEventListener(
    "focusin",
    function (event) {
      if (safeGetSessionStorage(FORM_START_KEY)) {
        return;
      }
      var target = event.target;
      if (!target) {
        return;
      }
      var form = target.closest ? target.closest("form") : null;
      if (!form || !isLeadForm(form)) {
        return;
      }
      safeSetSessionStorage(FORM_START_KEY, "1");
      var payload = basePayload();
      payload.kind = "form_start";
      send(payload, false);
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || !isLeadForm(form)) {
        return;
      }
      var payload = basePayload();
      payload.kind = "form_submit";
      send(payload, false);
    },
    { capture: true, passive: true }
  );
})();
