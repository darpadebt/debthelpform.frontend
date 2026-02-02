(() => {
  const SITE = 'DHF';
  const CORR_KEY = 'ab_corr_DHF';
  const CTA_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/cta';
  const TRACK_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/track';

  const getBucket = () => {
    try {
      let bucket = localStorage.getItem('ab_bucket');
      if (!bucket) {
        const generated = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        bucket = generated;
        localStorage.setItem('ab_bucket', bucket);
      }
      return bucket;
    } catch (error) {
      return `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  };

  const getVisitorType = () => {
    try {
      const seen = localStorage.getItem('ab_seen');
      if (!seen) {
        localStorage.setItem('ab_seen', '1');
        return 'new';
      }
      return 'returning';
    } catch (error) {
      return 'new';
    }
  };

  const getDeviceType = () => (window.matchMedia('(max-width: 860px)').matches ? 'mobile' : 'desktop');

  const getTrafficSource = () => {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const gclid = params.get('gclid');
    const fbclid = params.get('fbclid');

    if (utmSource || utmMedium || utmCampaign) {
      return [utmSource || 'utm', utmMedium || 'unknown', utmCampaign || ''].filter(Boolean).join(':');
    }
    if (gclid) return 'paid:google';
    if (fbclid) return 'paid:facebook';
    if (document.referrer) {
      try {
        const refHost = new URL(document.referrer).hostname.toLowerCase();
        if (/(google|bing|yahoo|duckduckgo)\./.test(refHost)) return 'search';
        if (/(facebook|instagram|tiktok|linkedin|twitter|x)\./.test(refHost)) return 'social';
        return `referral:${refHost}`;
      } catch (error) {
        return 'referral';
      }
    }
    return 'direct';
  };

  const getPageType = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('blog')) return 'blog';
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    return 'info';
  };

  const hasLeadFlow = () => !!document.querySelector('#get-started, #leadGate, #leadForm');

  const getFunnelStage = (pageType) => {
    if (pageType === 'blog') return 'blog';
    if (hasLeadFlow()) return 'leadflow';
    return 'info';
  };

  const getStepIndex = () => {
    const candidates = ['stepIndex', 'step_index', 'leadStep', 'leadStepIndex', 'currentStep'];
    for (const key of candidates) {
      const value = window[key];
      if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
        return String(value);
      }
    }
    return '0';
  };

  const getPageSlug = () => {
    if (window.__ab && window.__ab.pageKey) {
      return String(window.__ab.pageKey).replace(/:/g, '-');
    }
    const path = window.location.pathname.replace(/\?.*$/, '').replace(/\.html$/, '');
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    return trimmed ? trimmed.replace(/\//g, '-') : 'home';
  };

  const applyLabel = (element, label) => {
    if (!label || !element) return;
    element.setAttribute('aria-label', label);
    if (element.tagName === 'INPUT') return;
    if (element.childElementCount === 0) {
      element.textContent = label;
      return;
    }
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = label;
        return;
      }
    }
  };

  const sendTrack = (payload) => {
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (error) {
      // silent
    }
  };

  const buildSlotsFromAttributes = () => {
    const slots = new Map();
    const elements = Array.from(document.querySelectorAll('[data-ab-slot]'));
    elements.forEach((element, index) => {
      const raw = element.getAttribute('data-ab-slot');
      if (!raw) return;
      const slotName = raw.trim();
      if (!slotName) return;
      if (!slots.has(slotName)) slots.set(slotName, []);
      slots.get(slotName).push(element);
    });
    return slots;
  };

  const buildSlotsFromConfig = () => {
    const slots = new Map();
    if (!window.__ab || !window.__ab.slots) return slots;

    Object.entries(window.__ab.slots).forEach(([slotName, selector]) => {
      if (!selector || typeof selector !== 'string') return;
      const elements = Array.from(document.querySelectorAll(selector));
      if (!elements.length) return;
      slots.set(slotName, elements);
    });

    return slots;
  };

  const buildFallbackSlots = () => {
    const slots = new Map();
    const seen = new Set();

    const addElements = (baseName, selector, allowMultiple = true) => {
      const elements = Array.from(document.querySelectorAll(selector)).filter((el) => {
        if (seen.has(el)) return false;
        seen.add(el);
        return true;
      });
      if (!elements.length) return;
      elements.forEach((el, index) => {
        const name = allowMultiple && elements.length > 1 ? `${baseName}_${index + 1}` : baseName;
        if (!slots.has(name)) slots.set(name, []);
        slots.get(name).push(el);
      });
    };

    addElements('nav_call', '.site-nav .links a.call', false);
    addElements('tel_link', 'a[href^="tel:"]');
    addElements('estimate_cta', 'a[data-role="estimate"]');
    addElements('lead_anchor', 'a[href*="#get-started"], a[href*="#leadGate"], a[href*="#leadForm"]');
    addElements('primary_button', 'a.button.primary, button.button.primary, a.primary');

    return slots;
  };

  const resolveSlot = async ({ slotName, elements, context }) => {
    const testId = `dhf_${context.pageSlug}_${slotName}`;
    const scope = `debthelpform:${context.pageSlug}:${slotName}`;
    const params = new URLSearchParams({
      bucket: context.bucket,
      scope,
      site: SITE,
      test_id: testId,
      page_type: context.pageType,
      funnel_stage: context.funnelStage,
      step_index: context.stepIndex,
      device_type: context.deviceType,
      traffic_source: context.trafficSource,
      time_bucket: context.timeBucket,
      visitor_type: context.visitorType,
      page_path: context.pagePath
    });

    if (context.correlationId) {
      params.set('correlation_id', context.correlationId);
    }

    try {
      const response = await fetch(`${CTA_ENDPOINT}?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.correlation_id) {
        try {
          localStorage.setItem(CORR_KEY, data.correlation_id);
        } catch (error) {
          // ignore
        }
      }
      const label = data && data.meta ? (data.meta.label || data.meta.text) : null;
      const variant = data && data.variant ? data.variant : 'control';
      if (label) {
        elements.forEach((element) => applyLabel(element, label));
      }

      elements.forEach((element) => {
        if (element.dataset && element.dataset.abClick === 'false') return;
        element.addEventListener('click', () => {
          sendTrack({
            bucket: context.bucket,
            scope,
            variant,
            event: 'click',
            site: SITE,
            test_id: testId,
            page_type: context.pageType,
            funnel_stage: context.funnelStage,
            step_index: context.stepIndex,
            device_type: context.deviceType,
            traffic_source: context.trafficSource,
            time_bucket: context.timeBucket,
            visitor_type: context.visitorType,
            page_path: context.pagePath,
            correlation_id: data && data.correlation_id ? data.correlation_id : context.correlationId
          });
        }, { passive: true });
      });
    } catch (error) {
      // silent
    }
  };

  const init = () => {
    const slots = new Map();
    const attrSlots = buildSlotsFromAttributes();
    attrSlots.forEach((elements, slotName) => slots.set(slotName, elements));

    if (window.__ab && window.__ab.slots) {
      buildSlotsFromConfig().forEach((elements, slotName) => {
        if (!slots.has(slotName)) slots.set(slotName, elements);
      });
    }

    if (!slots.size) {
      buildFallbackSlots().forEach((elements, slotName) => slots.set(slotName, elements));
    }
    if (!slots.size) return;

    const context = {
      bucket: getBucket(),
      visitorType: getVisitorType(),
      deviceType: getDeviceType(),
      trafficSource: getTrafficSource(),
      timeBucket: String(new Date().getHours()),
      pagePath: `${window.location.pathname}${window.location.search}`,
      pageType: getPageType(),
      funnelStage: null,
      stepIndex: getStepIndex(),
      pageSlug: getPageSlug(),
      correlationId: null
    };

    context.funnelStage = getFunnelStage(context.pageType);
    try {
      context.correlationId = localStorage.getItem(CORR_KEY) || null;
    } catch (error) {
      context.correlationId = null;
    }

    slots.forEach((elements, slotName) => {
      resolveSlot({ slotName, elements, context });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
