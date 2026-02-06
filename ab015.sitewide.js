(() => {
  const resolveSite = () => {
    try {
      const host = window.location.hostname.toLowerCase();
      if (host.includes('debtreliefguard')) return 'DRG';
    } catch (error) {
      // ignore
    }
    return 'DHF';
  };
  const SITE = resolveSite();
  const CORR_KEY = `ab_corr_${SITE}`;
  const DEFAULT_BASE_ENDPOINT = '/api/mesh/015-a-b-test-accelerator';
  const resolveBaseEndpoint = () => {
    if (typeof window !== 'undefined' && window.__ab015BaseEndpoint) {
      return String(window.__ab015BaseEndpoint);
    }
    const meta = document.querySelector('meta[name="ab015-endpoint"]');
    if (meta && meta.content) return meta.content;
    return DEFAULT_BASE_ENDPOINT;
  };
  const BASE_ENDPOINT = resolveBaseEndpoint();
  const CTA_ENDPOINT = `${BASE_ENDPOINT}/variant`;
  const AB_CONFIG_ENDPOINT = `${BASE_ENDPOINT}/ab-config`;
  const TRACK_ENDPOINT = `${BASE_ENDPOINT}/track`;
  const COOKIE_KEY = 'gfsr_sid';
  const AB_CONFIG_CACHE_KEY = 'ab015_ab_config';
  const AB_CONFIG_SLOTS = new Set([
    'hero_headline',
    'nav_cta',
    'homepage_buttons',
    'blog_mid_segue',
    'blog_end_cta',
    'form_next',
    'form_submit',
    'lead_anchor'
  ]);
  const CANONICAL_SLOTS = new Set(AB_CONFIG_SLOTS);
  const ALIAS_SLOT_MAP = {
    headline: 'hero_headline',
    nav_call: 'nav_cta',
    page_title: 'hero_headline',
    primary: 'homepage_buttons',
    primary_cta: 'homepage_buttons',
    primary_button: 'homepage_buttons',
    primaryCta: 'homepage_buttons',
    estimate_cta: 'homepage_buttons',
    secondary_cta: 'homepage_buttons'
  };
  const AB_CONFIG_SLOT_MAP = {
    hero_headline: 'heroHeadlineText',
    nav_cta: 'navCtaLabel',
    homepage_buttons: 'primaryCtaLabel',
    blog_mid_segue: 'blogSegueText',
    blog_end_cta: 'blogCtaText',
    form_next: 'formNextLabel',
    form_submit: 'formSubmitLabel',
    lead_anchor: 'leadAnchorLabel'
  };

  const getDebugState = () => {
    if (!window.__ab015DebugState) {
      window.__ab015DebugState = { variants: {} };
    }
    return window.__ab015DebugState;
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
      const canonicalSlot = resolveCanonicalSlot(slotName);
      if (canonicalSlot) {
        applyAbConfigToElements(canonicalSlot, [node], abConfig);
      }
    }
    const nested = node.querySelectorAll ? node.querySelectorAll('[data-ab-slot]') : [];
    nested.forEach((element) => {
      const slotName = element.getAttribute('data-ab-slot');
      const canonicalSlot = resolveCanonicalSlot(slotName);
      if (canonicalSlot) {
        applyAbConfigToElements(canonicalSlot, [element], abConfig);
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

  const readCachedAbConfig = (sessionId) => {
    if (!sessionId) return null;
    try {
      const raw = localStorage.getItem(AB_CONFIG_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || cached.sessionId !== sessionId) return null;
      if (cached.expiresAt && Date.now() > cached.expiresAt) return null;
      return cached.data || null;
    } catch (error) {
      return null;
    }
  };

  const writeCachedAbConfig = (sessionId, data) => {
    if (!sessionId || !data) return;
    const ttlSeconds = Number(data.ttlSeconds);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
    try {
      const payload = {
        sessionId,
        expiresAt: Date.now() + ttlSeconds * 1000,
        data
      };
      localStorage.setItem(AB_CONFIG_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      // ignore
    }
  };

  const fetchAbConfig = async (sessionId) => {
    if (!sessionId || sessionId.length < 8) return null;
    const cached = readCachedAbConfig(sessionId);
    if (cached) return cached;
    try {
      const params = new URLSearchParams({ sessionId, site: SITE });
      const response = await fetch(`${AB_CONFIG_ENDPOINT}?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;
      writeCachedAbConfig(sessionId, data);
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

  const resolveCanonicalSlot = (slotName) => {
    if (!slotName) return null;
    if (CANONICAL_SLOTS.has(slotName)) return slotName;
    const alias = ALIAS_SLOT_MAP[slotName];
    return CANONICAL_SLOTS.has(alias) ? alias : null;
  };

  const isTelLink = (element) => {
    if (!element || element.tagName !== 'A') return false;
    const href = (element.getAttribute('href') || '').trim().toLowerCase();
    return href.startsWith('tel:');
  };

  const buildSlotsFromAttributes = () => {
    const slots = new Map();
    const elements = Array.from(document.querySelectorAll('[data-ab-slot]'));
    elements.forEach((element) => {
      if (isTelLink(element)) return;
      const raw = element.getAttribute('data-ab-slot');
      if (!raw) return;
      const slotName = resolveCanonicalSlot(raw.trim());
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
      const canonicalSlot = resolveCanonicalSlot(slotName);
      if (!canonicalSlot) return;
      const elements = Array.from(document.querySelectorAll(selector)).filter((element) => !isTelLink(element));
      if (!elements.length) return;
      slots.set(canonicalSlot, elements);
    });

    return slots;
  };

  const buildFallbackSlots = () => {
    const slots = new Map();
    const seen = new Set();

    const addElements = (baseName, selector) => {
      const elements = Array.from(document.querySelectorAll(selector)).filter((el) => {
        if (seen.has(el)) return false;
        seen.add(el);
        if (isTelLink(el)) return false;
        return true;
      });
      if (!elements.length) return;
      elements.forEach((el) => {
        if (!slots.has(baseName)) slots.set(baseName, []);
        slots.get(baseName).push(el);
      });
    };

    addElements('homepage_buttons', 'a[data-role="estimate"]');
    addElements('lead_anchor', 'a[href*="#get-started"], a[href*="#leadGate"], a[href*="#leadForm"], a[href*="#lead-form"]');
    addElements('homepage_buttons', 'a.button.primary, button.button.primary, a.primary');

    return slots;
  };

  const resolveSlot = async ({ slotName, elements, context }) => {
    if (!CANONICAL_SLOTS.has(slotName)) return;
    if (context.skipBlogSlots && (slotName === 'blog_mid_segue' || slotName === 'blog_end_cta')) return;
    const testId = slotName;
    const scope = slotName;
    const abConfigKey = AB_CONFIG_SLOT_MAP[slotName];
    if (context.abConfig && abConfigKey && context.abConfig[abConfigKey]) {
      applyAbConfigToElements(slotName, elements, context.abConfig);
    }
    const params = new URLSearchParams({
      bucket: context.sessionId,
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

    const debugState = getDebugState();
    if (debugState.variants) {
      debugState.variants[slotName] = { status: 'pending' };
    }

    try {
      const response = await fetch(`${CTA_ENDPOINT}?${params.toString()}`);
      if (!response.ok) {
        if (debugState.variants) {
          debugState.variants[slotName] = { status: `error:${response.status}` };
        }
        return;
      }
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
      if (debugState.variants) {
        debugState.variants[slotName] = {
          status: 'ok',
          variant,
          label
        };
      }
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
            bucket: context.sessionId,
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
      if (debugState.variants) {
        debugState.variants[slotName] = { status: 'error:network' };
      }
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
    return scripts.some((script) => script.textContent && script.textContent.includes('/ab-config'));
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
      sessionId: getSessionId(),
      visitorType: getVisitorType(),
      deviceType: getDeviceType(),
      trafficSource: getTrafficSource(),
      timeBucket: String(new Date().getHours()),
      pagePath: `${window.location.pathname}${window.location.search}`,
      pageType: getPageType(),
      funnelStage: null,
      stepIndex: getStepIndex(),
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

    fetchAbConfig(context.sessionId)
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
