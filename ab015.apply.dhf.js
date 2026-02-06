(() => {
  const SITE = 'DHF';
  const VARIANT_ENDPOINT = '/api/mesh/015-a-b-test-accelerator/variant';
  const COOKIE_KEY = 'gfsr_sid';

  const getRandomId = (prefix) => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}_${crypto.randomUUID()}`;
      }
    } catch (error) {
      // ignore
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
      const created = getRandomId('sid');
      setCookie(COOKIE_KEY, created);
      return created;
    } catch (error) {
      return getRandomId('sid');
    }
  };

  const isBlogPage = () => {
    const path = window.location.pathname.toLowerCase();
    return path.startsWith('/blog/') || path.includes('/blog');
  };

  const hasBlogSlots = () => !!document.querySelector('[data-ab-slot="blog_mid_segue"], [data-ab-slot="blog_end_cta"]');

  const init = () => {
    if (isBlogPage() || hasBlogSlots()) return;
    void SITE;
    void VARIANT_ENDPOINT;
    void getSessionId;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { passive: true });
  } else {
    init();
  }
})();
