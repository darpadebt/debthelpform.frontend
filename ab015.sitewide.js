(() => {
  const BASE_ENDPOINT = '/api/mesh/015-a-b-test-accelerator';
  const SITE = 'DHF';
  const STORAGE_KEY = 'ab015_session_id';
  const COOKIE_KEY = 'ab015_session_id';
  const CONFIG_KEY = `ab015_config_${SITE}`;
  const DEFAULT_TTL_SECONDS = 300;
  const VARIANT_CACHE_KEY = `ab015_variants_${SITE}`;
  const SLOT_SCOPE_MAP = {
    homepage_buttons: 'dhf_homepage_buttons',
    blog_mid_segue: 'dhf_blog_mid_segue',
    blog_end_cta: 'dhf_blog_end_cta',
    hero_headline: 'dhf_hero_headline',
    nav_cta: 'dhf_nav_cta',
    form_next: 'dhf_form_next',
    form_submit: 'dhf_form_submit',
    lead_anchor: 'dhf_lead_anchor'
  };
  const SCOPE_SLOT_MAP = Object.fromEntries(
    Object.entries(SLOT_SCOPE_MAP).map(([slot, scope]) => [scope, slot])
  );

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

  const getDeviceType = () => (window.matchMedia('(max-width: 860px)').matches ? 'mobile' : 'desktop');

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

  const readCachedConfig = () => {
    const storage = safeGetStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(CONFIG_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || typeof cached !== 'object') return null;
      const ttlSeconds = Number(cached.ttlSeconds || DEFAULT_TTL_SECONDS);
      const fetchedAt = Number(cached.fetchedAt || 0);
      if (!fetchedAt || Number.isNaN(fetchedAt)) return null;
      if (Date.now() - fetchedAt > ttlSeconds * 1000) return null;
      return cached.data || null;
    } catch (error) {
      return null;
    }
  };

  const readVariantCache = () => {
    const storage = safeGetStorage();
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(VARIANT_CACHE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  };

  const writeVariantCache = (cache) => {
    const storage = safeGetStorage();
    if (!storage) return;
    try {
      storage.setItem(VARIANT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      // ignore
    }
  };

  const writeCachedConfig = (data) => {
    const storage = safeGetStorage();
    if (!storage || !data) return;
    try {
      const ttlSeconds = Number(data.ttlSeconds || DEFAULT_TTL_SECONDS);
      storage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          data,
          ttlSeconds,
          fetchedAt: Date.now()
        })
      );
    } catch (error) {
      // ignore
    }
  };

  const fetchConfig = async (sessionId) => {
    if (!sessionId || sessionId.length < 8) return null;
    try {
      const params = new URLSearchParams({ sessionId, site: SITE });
      const response = await fetch(`${BASE_ENDPOINT}/ab-config?${params.toString()}`, {
        credentials: 'same-origin'
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;
      writeCachedConfig(data);
      return data;
    } catch (error) {
      return null;
    }
  };

  let inflightConfig = null;
  const getConfig = () => {
    const cached = readCachedConfig();
    if (cached) return Promise.resolve(cached);
    if (inflightConfig) return inflightConfig;
    const sessionId = getSessionId();
    inflightConfig = fetchConfig(sessionId).finally(() => {
      inflightConfig = null;
    });
    return inflightConfig;
  };

  const resolveScope = (scopeOrSlot) => {
    if (!scopeOrSlot) return null;
    if (SLOT_SCOPE_MAP[scopeOrSlot]) return SLOT_SCOPE_MAP[scopeOrSlot];
    if (SCOPE_SLOT_MAP[scopeOrSlot]) return scopeOrSlot;
    return scopeOrSlot;
  };

  const resolveVariantForScope = (scopeOrSlot, config) => {
    if (!config) return null;
    const slotName = SCOPE_SLOT_MAP[scopeOrSlot] || scopeOrSlot;
    if (slotName === 'homepage_buttons' && config.variantId) return config.variantId;
    return null;
  };

  const fetchVariant = async (scopeOrSlot, sessionId) => {
    const scope = resolveScope(scopeOrSlot);
    if (!scope || !sessionId || sessionId.length < 8) return null;
    const cache = readVariantCache();
    if (cache[scope]) return cache[scope];
    try {
      const params = new URLSearchParams({ bucket: sessionId, scope, site: SITE });
      const response = await fetch(`${BASE_ENDPOINT}/variant?${params.toString()}`, {
        credentials: 'same-origin'
      });
      if (!response.ok) return null;
      const data = await response.json();
      const variant = data?.variant || data?.variant_id || data?.id || null;
      if (variant) {
        cache[scope] = variant;
        writeVariantCache(cache);
      }
      return variant;
    } catch (error) {
      return null;
    }
  };

  const track = async (event, scopeOrSlot, meta = {}) => {
    const scope = resolveScope(scopeOrSlot);
    if (!event || !scope) return false;
    const sessionId = getSessionId();
    const config = await getConfig();
    const variant = meta.variant || resolveVariantForScope(scopeOrSlot, config) || await fetchVariant(scope, sessionId);
    if (!variant) return false;
    const payload = {
      scope,
      bucket: sessionId,
      variant,
      event,
      site: SITE,
      page_type: getPageType(),
      funnel_stage: meta.funnel_stage,
      step_index: meta.step_index,
      device_type: getDeviceType(),
      traffic_source: getTrafficSource(),
      time_bucket: String(new Date().getHours()),
      visitor_type: getVisitorType(),
      correlation_id: meta.correlation_id,
      test_id: meta.test_id,
      page_path: `${window.location.pathname}${window.location.search}`
    };

    try {
      await fetch(`${BASE_ENDPOINT}/track`, {
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

  window.AB015 = window.AB015 || {};
  window.AB015.getSessionId = getSessionId;
  window.AB015.getConfig = getConfig;
  window.AB015.track = track;
  window.AB015.trackCompletion = (meta = {}) => track('completion', 'form_submit', meta);
})();
