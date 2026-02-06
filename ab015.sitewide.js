(() => {
  const SITE = 'DHF';
  const CORR_KEY = 'ab_corr_DHF';
  const CTA_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/cta';
  const AB_CONFIG_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/ab-config';
  const TRACK_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/track';
  const COOKIE_KEY = 'gfsr_sid';
  const AB_CONFIG_SLOTS = new Set([
    'hero_headline',
    'nav_cta',
    'primary_cta',
    'estimate_cta',
    'primary_button',
    'homepage_buttons',
    'blog_mid_segue',
    'blog_end_cta',
    'form_next',
    'form_submit',
    'lead_anchor'
  ]);
  const AB_CONFIG_SLOT_MAP = {
    hero_headline: 'heroHeadlineText',
    nav_cta: 'navCtaLabel',
    primary_cta: 'primaryCtaLabel',
    estimate_cta: 'primaryCtaLabel',
    primary_button: 'primaryCtaLabel',
    homepage_buttons: 'primaryCtaLabel',
    blog_mid_segue: 'blogSegueText',
    blog_end_cta: 'blogCtaText',
    form_next: 'formNextLabel',
    form_submit: 'formSubmitLabel',
    lead_anchor: 'leadAnchorLabel'
  };
  const AB_SCOPE_MAP = {
    hero_headline: 'hero_headline',
    nav_cta: 'nav_cta',
    primary_cta: 'homepage_buttons',
    estimate_cta: 'homepage_buttons',
    primary_button: 'homepage_buttons',
    homepage_buttons: 'homepage_buttons',
    blog_mid_segue: 'blog_mid_segue',
    blog_end_cta: 'blog_end_cta',
    form_next: 'form_next',
    form_submit: 'form_submit',
    lead_anchor: 'lead_anchor'
  };

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

  const hasLeadFlow = () => !!document.querySelector('#get-started, #leadGate, #leadForm, #lead-form');

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

  const getAbConfigLabel = (slotName, abConfig) => {
    if (!abConfig || !slotName) return null;
    const key = AB_CONFIG_SLOT_MAP[slotName];
    return key ? abConfig[key] : null;
  };

  const applyAbConfigToElements = (slotName, elements, abConfig) => {
    const label = getAbConfigLabel(slotName, abConfig);
    if (!label) return;
    elements.forEach((element) => {
      if (element.dataset && element.dataset.abConfigApplied) return;
      applyLabel(element, label);
      if (element.dataset) {
        element.dataset.abConfigApplied = 'true';
      }
    });
  };

  const applyAbConfigToNode = (node, abConfig) => {
    if (!node || !(node instanceof HTMLElement)) return;
    if (node.hasAttribute && node.hasAttribute('data-ab-slot')) {
      const slotName = node.getAttribute('data-ab-slot');
      if (slotName && AB_CONFIG_SLOTS.has(slotName)) {
        applyAbConfigToElements(slotName, [node], abConfig);
      }
    }
    const nested = node.querySelectorAll ? node.querySelectorAll('[data-ab-slot]') : [];
    nested.forEach((element) => {
      const slotName = element.getAttribute('data-ab-slot');
      if (slotName && AB_CONFIG_SLOTS.has(slotName)) {
        applyAbConfigToElements(slotName, [element], abConfig);
      }
    });
  };

  const setupAbConfigObserver = (abConfig) => {
    if (!abConfig || !document.body || window.__abConfigObserver) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => applyAbConfigToNode(node, abConfig));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__abConfigObserver = observer;
  };

  const fetchAbConfig = async (sessionId) => {
    if (!sessionId || sessionId.length < 8) return null;
    try {
      const params = new URLSearchParams({ sessionId, site: SITE });
      const response = await fetch(`${AB_CONFIG_ENDPOINT}?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (error) {
      return null;
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

    addElements('estimate_cta', 'a[data-role="estimate"]');
    addElements('lead_anchor', 'a[href*="#get-started"], a[href*="#leadGate"], a[href*="#leadForm"], a[href*="#lead-form"]');
    addElements('primary_button', 'a.button.primary, button.button.primary, a.primary');

    return slots;
  };

  const resolveSlot = async ({ slotName, elements, context }) => {
    if (context.skipBlogSlots && (slotName === 'blog_mid_segue' || slotName === 'blog_end_cta')) return;
    const scopeKey = AB_SCOPE_MAP[slotName] || null;
    const testId = scopeKey ? `dhf_${scopeKey}` : `dhf_${context.pageSlug}_${slotName}`;
    const scope = scopeKey || `debthelpform:${context.pageSlug}:${slotName}`;
    const abConfigKey = AB_CONFIG_SLOT_MAP[slotName];
    if (context.abConfig && abConfigKey && context.abConfig[abConfigKey]) {
      applyAbConfigToElements(slotName, elements, context.abConfig);
    }
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
        elements.forEach((element) => {
          if (element.dataset && element.dataset.abConfigApplied) return;
          applyLabel(element, label);
        });
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

  const getCookie = (name) => {
    try {
      const cookies = document.cookie ? document.cookie.split('; ') : [];
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === name) return value || '';
      }
    } catch (error) {
      // ignore
    }
    return '';
  };

  const setCookie = (name, value) => {
    try {
      document.cookie = `${name}=${value}; Path=/; SameSite=Lax`;
    } catch (error) {
      // ignore
    }
  };

  const getSessionId = () => {
    try {
      const existing = getCookie(COOKIE_KEY);
      if (existing) return existing;
      const created = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `sid_${crypto.randomUUID()}`
        : `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setCookie(COOKIE_KEY, created);
      return created;
    } catch (error) {
      return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  };

  const hasEmbeddedBlogAbConfig = () => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return scripts.some((script) => script.textContent && script.textContent.includes('/api/mesh/015-a-b-test-accelerator/ab-config'));
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
      correlationId: null,
      skipBlogSlots: false
    };

    context.funnelStage = getFunnelStage(context.pageType);
    try {
      context.correlationId = localStorage.getItem(CORR_KEY) || null;
    } catch (error) {
      context.correlationId = null;
    }
    context.skipBlogSlots = context.pageType === 'blog' && hasEmbeddedBlogAbConfig();
    const applySlots = () => {
      slots.forEach((elements, slotName) => {
        resolveSlot({ slotName, elements, context });
      });
    };

    fetchAbConfig(getSessionId())
      .then((abConfig) => {
        context.abConfig = abConfig;
        setupAbConfigObserver(abConfig);
        applySlots();
      })
      .catch(() => {
        context.abConfig = null;
        applySlots();
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
