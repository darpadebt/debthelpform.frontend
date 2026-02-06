(() => {
  const DEFAULT_BASE_ENDPOINT = '/api/mesh/015-a-b-test-accelerator';
  const SITE = (() => {
    try {
      const host = window.location.hostname.toLowerCase();
      if (host.includes('debtreliefguard')) return 'DRG';
    } catch (error) {
      // ignore
    }
    return 'DHF';
  })();

  const resolveBaseEndpoint = () => {
    let candidate = DEFAULT_BASE_ENDPOINT;
    if (typeof window !== 'undefined' && window.__ab015BaseEndpoint) {
      candidate = String(window.__ab015BaseEndpoint);
    } else {
      const meta = document.querySelector('meta[name="ab015-endpoint"]');
      if (meta && meta.content) candidate = meta.content;
    }
    try {
      const url = new URL(candidate, window.location.origin);
      if (url.origin !== window.location.origin) return DEFAULT_BASE_ENDPOINT;
      return candidate.startsWith('http') ? `${url.origin}${url.pathname}` : url.pathname;
    } catch (error) {
      return DEFAULT_BASE_ENDPOINT;
    }
  };

  const BASE_ENDPOINT = resolveBaseEndpoint();
  const AB_CONFIG_ENDPOINT = `${BASE_ENDPOINT}/ab-config`;
  const VARIANT_ENDPOINT = `${BASE_ENDPOINT}/variant`;
  const TRACK_ENDPOINT = `${BASE_ENDPOINT}/track`;

  const STORAGE_KEY = 'ab015_session_id';
  const COOKIE_KEY = 'ab015_session_id';
  const EXPOSURE_KEY_PREFIX = 'ab015_exposures_';
  const CORR_KEY = `ab_corr_${SITE}`;

  const SUPPORTED_SCOPES = new Set([
    'hero_headline',
    'nav_cta',
    'homepage_buttons',
    'blog_mid_segue',
    'blog_end_cta',
    'form_next',
    'form_submit',
    'lead_anchor'
  ]);

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

  const variantCache = {};
  const exposedThisPage = new Set();
  const pendingExposures = new Set();

  const safeGetStorage = () => {
    try {
      const testKey = '__ab015_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch (error) {
      return null;
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
      document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=31536000`;
    } catch (error) {
      // ignore
    }
  };

  const generateSessionId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 12; i += 1) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  };

  const getSessionId = () => {
    const storage = safeGetStorage();
    let id = storage?.getItem(STORAGE_KEY) || getCookie(COOKIE_KEY);
    if (!id || id.length < 8) {
      id = generateSessionId();
      if (storage) {
        storage.setItem(STORAGE_KEY, id);
      } else {
        setCookie(COOKIE_KEY, id);
      }
    }
    return id;
  };

  const getExposureMap = (sessionId) => {
    const storage = safeGetStorage();
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(`${EXPOSURE_KEY_PREFIX}${sessionId}`) || '{}');
    } catch (error) {
      return {};
    }
  };

  const setExposure = (sessionId, scope) => {
    const storage = safeGetStorage();
    if (!storage) return;
    const map = getExposureMap(sessionId);
    map[scope] = true;
    storage.setItem(`${EXPOSURE_KEY_PREFIX}${sessionId}`, JSON.stringify(map));
  };

  const hasExposure = (sessionId, scope) => {
    const map = getExposureMap(sessionId);
    return Boolean(map[scope]);
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
    if (params.get('utm_source')) return params.get('utm_source');
    if (params.get('gclid')) return 'google';
    if (params.get('msclkid')) return 'bing';
    if (params.get('fbclid')) return 'facebook';
    if (params.get('ttclid')) return 'tiktok';
    if (params.get('yclid')) return 'yahoo';
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
      if (typeof value === 'number') return String(value);
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return '0';
  };

  const resolveCanonicalSlot = (slotName) => {
    if (!slotName) return null;
    if (SUPPORTED_SCOPES.has(slotName)) return slotName;
    const alias = ALIAS_SLOT_MAP[slotName];
    return SUPPORTED_SCOPES.has(alias) ? alias : null;
  };

  const isTelLink = (element) => {
    if (!element || element.tagName !== 'A') return false;
    const href = (element.getAttribute('href') || '').trim().toLowerCase();
    return href.startsWith('tel:');
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
    const value = key ? abConfig[key] : null;
    return typeof value === 'string' ? value : null;
  };

  const buildSlotsFromAttributes = () => {
    const slots = new Map();
    const elements = Array.from(document.querySelectorAll('[data-ab-slot]'));
    elements.forEach((element) => {
      const raw = element.getAttribute('data-ab-slot');
      if (!raw) return;
      const slotName = resolveCanonicalSlot(raw.trim());
      if (!slotName) return;
      if (isTelLink(element) && slotName !== 'lead_anchor') return;
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

    const isApplyAnchor = (element) => {
      if (!element || element.tagName !== 'A') return false;
      const href = (element.getAttribute('href') || '').toLowerCase();
      return href.includes('/apply.html#get-started') || href.includes('#get-started');
    };

    const isLeadAnchor = (element) => isApplyAnchor(element);

    const isInForm = (element) => !!(element && element.closest && element.closest('form'));

    const isSubmitButton = (element) => {
      if (!element) return false;
      if (element.tagName === 'BUTTON') {
        return (element.getAttribute('type') || '').toLowerCase() === 'submit';
      }
      return element.tagName === 'INPUT' && (element.getAttribute('type') || '').toLowerCase() === 'submit';
    };

    const isStepAdvance = (element) => {
      if (!element) return false;
      if (element.id === 'next') return true;
      if (element.classList && element.classList.contains('next')) return true;
      return element.hasAttribute && element.hasAttribute('data-step');
    };

    const isNavCta = (element) => {
      if (!element) return false;
      if (!isApplyAnchor(element)) return false;
      return !!(element.closest && element.closest('.site-nav, #navLinks'));
    };

    const isHeroCta = (element) => {
      if (!element) return false;
      if (isInForm(element)) return false;
      if (element.closest && element.closest('.site-nav, #navLinks')) return false;
      if (element.tagName !== 'A' && element.tagName !== 'BUTTON') return false;
      if (element.classList && (element.classList.contains('primary') || element.classList.contains('button'))) {
        return true;
      }
      return false;
    };

    const addElement = (slotName, element) => {
      if (!slotName || !element) return;
      if (seen.has(element)) return;
      seen.add(element);
      if (!slots.has(slotName)) slots.set(slotName, []);
      slots.get(slotName).push(element);
    };

    const candidates = Array.from(document.querySelectorAll('a, button, input[type="submit"]'));
    candidates.forEach((element) => {
      if (isTelLink(element)) return;
      if (isInForm(element) || isSubmitButton(element)) {
        addElement('form_submit', element);
        return;
      }
      if (isStepAdvance(element)) {
        addElement('form_next', element);
        return;
      }
      if (isNavCta(element)) {
        addElement('nav_cta', element);
        return;
      }
      if (isLeadAnchor(element)) {
        addElement('lead_anchor', element);
        return;
      }
      if (isHeroCta(element)) {
        addElement('homepage_buttons', element);
      }
    });

    return slots;
  };

  const applyAbConfigToNode = (node, abConfig) => {
    if (!node || !(node instanceof HTMLElement)) return;
    if (node.hasAttribute && node.hasAttribute('data-ab-slot')) {
      if (isTelLink(node)) return;
      const slotName = resolveCanonicalSlot(node.getAttribute('data-ab-slot'));
      if (slotName) applyLabel(node, getAbConfigLabel(slotName, abConfig));
    }
    const nested = node.querySelectorAll ? node.querySelectorAll('[data-ab-slot]') : [];
    nested.forEach((element) => {
      if (isTelLink(element)) return;
      const slotName = resolveCanonicalSlot(element.getAttribute('data-ab-slot'));
      if (slotName) applyLabel(element, getAbConfigLabel(slotName, abConfig));
    });
  };

  const setupAbConfigObserver = (abConfig, slots, context) => {
    if (!document.body || window.__abConfigObserver) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!node || !(node instanceof HTMLElement)) return;
          if (node.hasAttribute && node.hasAttribute('data-ab-slot')) {
            if (isTelLink(node)) return;
            const slotName = resolveCanonicalSlot(node.getAttribute('data-ab-slot'));
            if (slotName) {
              if (!slots.has(slotName)) slots.set(slotName, []);
              if (!slots.get(slotName).includes(node)) slots.get(slotName).push(node);
              applySlot(slotName, slots.get(slotName), context, abConfig);
            }
          }
          const nested = node.querySelectorAll ? node.querySelectorAll('[data-ab-slot]') : [];
          nested.forEach((element) => {
            if (isTelLink(element)) return;
            const slotName = resolveCanonicalSlot(element.getAttribute('data-ab-slot'));
            if (!slotName) return;
            if (!slots.has(slotName)) slots.set(slotName, []);
            if (!slots.get(slotName).includes(element)) slots.get(slotName).push(element);
            applySlot(slotName, slots.get(slotName), context, abConfig);
          });
          if (window.__ab && window.__ab.slots) {
            Object.entries(window.__ab.slots).forEach(([slotName, selector]) => {
              if (!selector || typeof selector !== 'string') return;
              const canonicalSlot = resolveCanonicalSlot(slotName);
              if (!canonicalSlot) return;
              const elements = Array.from(node.querySelectorAll ? node.querySelectorAll(selector) : []).filter((element) => !isTelLink(element));
              if (!elements.length) return;
              if (!slots.has(canonicalSlot)) slots.set(canonicalSlot, []);
              const list = slots.get(canonicalSlot);
              elements.forEach((element) => {
                if (!list.includes(element)) list.push(element);
              });
              applySlot(canonicalSlot, list, context, abConfig);
            });
          }
          applyAbConfigToNode(node, abConfig);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__abConfigObserver = observer;
  };

  const fetchAbConfig = async (sessionId) => {
    if (!sessionId || sessionId.length < 8) return null;
    try {
      const params = new URLSearchParams({ sessionId, site: SITE });
      const response = await fetch(`${AB_CONFIG_ENDPOINT}?${params.toString()}`, { credentials: 'same-origin' });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (error) {
      return null;
    }
  };

  const resolveVariant = async (scope, context, stepIndex) => {
    if (!SUPPORTED_SCOPES.has(scope)) return null;
    if (variantCache[scope]) return variantCache[scope];
    const params = new URLSearchParams({
      bucket: context.sessionId,
      scope,
      site: SITE,
      test_id: scope,
      page_type: context.pageType,
      funnel_stage: context.funnelStage,
      step_index: stepIndex,
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
      const response = await fetch(`${VARIANT_ENDPOINT}?${params.toString()}`, { credentials: 'same-origin' });
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.correlation_id) {
        try {
          localStorage.setItem(CORR_KEY, data.correlation_id);
        } catch (error) {
          // ignore
        }
      }
      const variant = data?.variant || data?.variant_id || data?.id || null;
      if (variant) {
        variantCache[scope] = variant;
      }
      return variant;
    } catch (error) {
      return null;
    }
  };

  const track = async (event, scope, context, meta = {}) => {
    if (!scope || !SUPPORTED_SCOPES.has(scope)) return false;
    const stepIndex = meta.step_index || getStepIndex();
    const variant = await resolveVariant(scope, context, stepIndex);
    if (!variant) return false;
    const payload = {
      bucket: context.sessionId,
      scope,
      variant,
      event,
      site: SITE,
      test_id: scope,
      page_type: context.pageType,
      funnel_stage: context.funnelStage,
      step_index: stepIndex,
      device_type: context.deviceType,
      traffic_source: context.trafficSource,
      time_bucket: context.timeBucket,
      visitor_type: context.visitorType,
      page_path: context.pagePath,
      correlation_id: context.correlationId || undefined
    };

    if (meta && typeof meta.status === 'string') {
      payload.status = meta.status;
    }

    try {
      await fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const applySlot = (slotName, elements, context, abConfig) => {
    if (!SUPPORTED_SCOPES.has(slotName)) return;
    const label = getAbConfigLabel(slotName, abConfig);
    let appliedLabel = false;
    if (label) {
      elements.forEach((element) => {
        if (isTelLink(element)) return;
        if (element.dataset && element.dataset.abConfigApplied) return;
        applyLabel(element, label);
        if (element.dataset) {
          element.dataset.abConfigApplied = 'true';
        }
        appliedLabel = true;
      });
    }

    if (appliedLabel && !hasExposure(context.sessionId, slotName) && !exposedThisPage.has(slotName) && !pendingExposures.has(slotName)) {
      pendingExposures.add(slotName);
      track('exposure', slotName, context, { step_index: getStepIndex() }).then((posted) => {
        if (posted) {
          setExposure(context.sessionId, slotName);
          exposedThisPage.add(slotName);
        }
        pendingExposures.delete(slotName);
      });
    }

    elements.forEach((element) => {
      if (element.dataset && element.dataset.abClickBound) return;
      if (element.dataset && element.dataset.abClick === 'false') return;
      if (element.dataset) element.dataset.abClickBound = 'true';
      element.addEventListener('click', () => {
        if (slotName === 'form_next') {
          track('step_advance', slotName, context, { step_index: getStepIndex() });
          return;
        }
        track('click', slotName, context, { step_index: getStepIndex() });
      }, { passive: true });
    });
  };

  const maybeDebugLog = (state) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ab_debug') === '1') {
      console.log('[AB015]', state);
    }
  };

  const init = () => {
    const slots = new Map();
    buildSlotsFromAttributes().forEach((elements, slotName) => slots.set(slotName, elements));

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
      correlationId: null
    };

    context.funnelStage = getFunnelStage(context.pageType);
    try {
      context.correlationId = localStorage.getItem(CORR_KEY) || null;
    } catch (error) {
      context.correlationId = null;
    }

    const applySlots = (abConfig) => {
      slots.forEach((elements, slotName) => {
        applySlot(slotName, elements, context, abConfig);
      });
    };

    fetchAbConfig(context.sessionId)
      .then((abConfig) => {
        setupAbConfigObserver(abConfig, slots, context);
        applySlots(abConfig);
        maybeDebugLog({
          sessionId: context.sessionId,
          abConfigOk: Boolean(abConfig),
          slotsApplied: Array.from(slots.keys()),
          variantIds: { ...variantCache }
        });
      })
      .catch(() => {
        applySlots(null);
      });

    window.AB015 = window.AB015 || {};
    window.AB015.track = (event, scope, meta) => track(event, scope, context, meta);
    window.AB015.trackCompletion = (meta) => track('completion', 'form_submit', context, meta || {});
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
