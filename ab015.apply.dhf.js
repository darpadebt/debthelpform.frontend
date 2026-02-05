(() => {
  const SITE = 'DHF';
  const ENDPOINT = '/api/mesh/015-ab-test-accelerator/variant';
  const COOKIE_KEY = 'gfsr_sid';
  const STORAGE_KEY = 'gfsr_vid';
  const MID_SEGUE_MARK = 'data-ab015-mid-segue';
  const END_CTA_MARK = 'data-ab015-end-cta';

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

  const getVisitorId = () => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = getRandomId('vid');
      window.localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (error) {
      return getRandomId('vid');
    }
  };

  const getDevice = () => (window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop');

  const isHomePage = () => {
    const path = window.location.pathname.toLowerCase();
    return path === '/' || path.endsWith('/index.html');
  };

  const isBlogPage = () => {
    const path = window.location.pathname.toLowerCase();
    return path.startsWith('/blog/') || path.includes('/blog');
  };

  const scheduleIdle = (fn) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => fn());
    } else {
      window.setTimeout(() => fn(), 0);
    }
  };

  const fetchVariant = async ({ slot, page, device, sid, vid, index }) => {
    try {
      const params = new URLSearchParams({
        site: SITE,
        slot,
        page,
        device,
        sid,
        vid
      });
      if (typeof index === 'number') {
        params.set('n', String(index));
      }
      const response = await fetch(`${ENDPOINT}?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || !data.ok || data.slot !== slot) return null;
      return data;
    } catch (error) {
      return null;
    }
  };

  const setElementText = (element, text) => {
    if (!element || !text) return;
    if (element.childElementCount === 0) {
      element.textContent = text;
      return;
    }
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const node = walker.nextNode();
    if (node) {
      node.textContent = text;
      return;
    }
    element.textContent = text;
  };

  const getCtaCandidates = () => {
    const keywords = ['start', 'eligibility', 'check', 'free', 'qualify', 'options', 'assessment', 'review'];
    const elements = Array.from(document.querySelectorAll('a, button'));
    return elements.filter((el) => {
      const text = (el.textContent || '').toLowerCase();
      const idClass = `${el.id || ''} ${el.className || ''}`.toLowerCase();
      const matchesKeyword = keywords.some((keyword) => text.includes(keyword));
      const matchesClass = /(cta|start|eligib|hero|button)/.test(idClass);
      return matchesKeyword || matchesClass;
    });
  };

  const applyHomepageButtons = async (context) => {
    try {
      const candidates = getCtaCandidates();
      if (!candidates.length) return;
      const count = Math.min(5, Math.max(3, candidates.length));
      const variants = [];
      for (let i = 0; i < count; i += 1) {
        const data = await fetchVariant({
          slot: 'homepage_buttons',
          page: context.page,
          device: context.device,
          sid: context.sid,
          vid: context.vid,
          index: i + 1
        });
        if (data && data.variantText) variants.push(data.variantText);
      }
      if (!variants.length) return;
      const targetCount = Math.min(candidates.length, variants.length);
      for (let i = 0; i < targetCount; i += 1) {
        setElementText(candidates[i], variants[i]);
      }
    } catch (error) {
      // silent
    }
  };

  const findArticleContainer = () => {
    const article = document.querySelector('article');
    if (article) return article;
    const selectors = [
      '[class*="blog"]',
      '[id*="blog"]',
      '[class*="post"]',
      '[id*="post"]',
      '[class*="content"]',
      '[id*="content"]',
      '[class*="article-body"]',
      '[id*="article-body"]',
      '[class*="article"]',
      '[id*="article"]'
    ];
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found) return found;
    }
    return null;
  };

  const applyBlogMidSegue = async (context) => {
    try {
      if (!isBlogPage()) return;
      const container = findArticleContainer();
      if (!container || container.querySelector(`[${MID_SEGUE_MARK}]`)) return;
      const paragraphs = Array.from(container.querySelectorAll('p'));
      if (paragraphs.length < 2) return;
      const index = Math.max(2, Math.floor(paragraphs.length * 0.3));
      const target = paragraphs[index - 1];
      if (!target || !target.parentNode) return;
      const data = await fetchVariant({
        slot: 'blog_mid_segue',
        page: context.page,
        device: context.device,
        sid: context.sid,
        vid: context.vid,
        index: 1
      });
      if (!data || !data.variantText) return;
      const paragraph = document.createElement('p');
      paragraph.textContent = data.variantText;
      paragraph.setAttribute(MID_SEGUE_MARK, 'true');
      if (target.className) {
        paragraph.className = target.className;
      }
      target.parentNode.insertBefore(paragraph, target);
    } catch (error) {
      // silent
    }
  };

  const applyBlogEndCta = async (context) => {
    try {
      if (!isBlogPage()) return;
      const container = findArticleContainer();
      if (!container || container.querySelector(`[${END_CTA_MARK}]`)) return;
      const data = await fetchVariant({
        slot: 'blog_end_cta',
        page: context.page,
        device: context.device,
        sid: context.sid,
        vid: context.vid,
        index: 1
      });
      if (!data || !data.variantText) return;
      const selector = '[class*="cta"], [id*="cta"], [class*="next-step"], [id*="next-step"], [class*="eligibility"], [id*="eligibility"], [class*="start"], [id*="start"]';
      const existing = container.querySelector(selector);
      if (existing) {
        setElementText(existing, data.variantText);
        existing.setAttribute(END_CTA_MARK, 'true');
        return;
      }
      const paragraph = document.createElement('p');
      paragraph.textContent = data.variantText;
      paragraph.setAttribute(END_CTA_MARK, 'true');
      container.appendChild(paragraph);
    } catch (error) {
      // silent
    }
  };

  const init = () => {
    try {
      const context = {
        page: window.location.pathname,
        device: getDevice(),
        sid: getSessionId(),
        vid: getVisitorId()
      };

      if (isHomePage() || isBlogPage()) {
        applyHomepageButtons(context);
      }

      scheduleIdle(() => {
        applyBlogMidSegue(context);
        applyBlogEndCta(context);
      });
    } catch (error) {
      // silent
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { passive: true });
  } else {
    init();
  }
})();
