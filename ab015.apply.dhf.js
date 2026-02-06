(() => {
  const aliasMap = {
    nav_call: 'nav_cta',
    page_title: 'hero_headline',
    primary_cta: 'homepage_buttons',
    primary_button: 'homepage_buttons',
    estimate_cta: 'homepage_buttons',
    secondary_cta: 'homepage_buttons'
  };

  const slotSelectors = {
    nav_cta: [
      'nav a[data-role="estimate"]',
      'nav a[href*="#get-started"]',
      'nav a[href*="#lead"]'
    ],
    hero_headline: [
      'main h1',
      'header h1',
      '.page-header h1',
      '.page-hero h1',
      '.h1#title',
      '.h1',
      'h1#geoHeadline'
    ],
    homepage_buttons: [
      '#startBtn',
      'a[data-role="estimate"]',
      'a.button.primary',
      'button.button.primary',
      'a.btn.primary',
      'a.primary',
      'button.primary'
    ],
    lead_anchor: [
      'a[href*="#get-started"]',
      'a[href*="#leadGate"]',
      'a[href*="#leadForm"]',
      'a[href*="#lead-form"]'
    ],
    form_next: [
      '#nextBtn',
      '#next',
      'button.next',
      '.controls .next'
    ],
    form_submit: [
      '#submitBtn',
      'form button[type="submit"]',
      'form [type="submit"]'
    ]
  };

  const slotMultiples = {
    homepage_buttons: true,
    lead_anchor: true,
    form_next: true
  };

  const getPageType = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/blog')) return 'blog';
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    return 'info';
  };

  const shouldSkip = (pageType) => {
    if (pageType === 'blog') return true;
    return !!document.querySelector('[data-ab-slot="blog_mid_segue"], [data-ab-slot="blog_end_cta"]');
  };

  const runAdapter = () => {
    if (typeof window.ab015ApplyForSite !== 'function') return;
    window.ab015ApplyForSite({
      aliasMap,
      slotSelectors,
      slotMultiples,
      getPageType,
      shouldSkip
    });

    const debugEnabled = new URLSearchParams(window.location.search).has('abdebug');
    if (!debugEnabled) return;
    const report = () => {
      const summary = window.__ab015DebugState ? window.__ab015DebugState.adapter : null;
      const variants = window.__ab015DebugState ? window.__ab015DebugState.variants : null;
      console.info('[ab015][debug]', {
        pageType: getPageType(),
        adapter: summary,
        variants
      });
    };
    report();
    setTimeout(report, 1500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAdapter, { passive: true });
  } else {
    runAdapter();
  }
})();
