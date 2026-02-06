(() => {
  const SLOT_LABEL_KEYS = {
    primaryCtaLabel: 'primaryCtaLabel',
    blogSegueText: 'blogSegueText',
    blogCtaText: 'blogCtaText',
    heroHeadlineText: 'heroHeadlineText',
    navCtaLabel: 'navCtaLabel',
    formNextLabel: 'formNextLabel',
    formSubmitLabel: 'formSubmitLabel',
    leadAnchorLabel: 'leadAnchorLabel'
  };

  const SLOT_MAP = {
    homepage_buttons: SLOT_LABEL_KEYS.primaryCtaLabel,
    blog_mid_segue: SLOT_LABEL_KEYS.blogSegueText,
    blog_end_cta: SLOT_LABEL_KEYS.blogCtaText,
    hero_headline: SLOT_LABEL_KEYS.heroHeadlineText,
    nav_cta: SLOT_LABEL_KEYS.navCtaLabel,
    form_next: SLOT_LABEL_KEYS.formNextLabel,
    form_submit: SLOT_LABEL_KEYS.formSubmitLabel,
    lead_anchor: SLOT_LABEL_KEYS.leadAnchorLabel
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

  const getSlotLabel = (slotName, config) => {
    const key = SLOT_MAP[slotName];
    const value = key ? config?.[key] : null;
    return typeof value === 'string' ? value : null;
  };

  const applySlots = (config, root = document) => {
    if (!config) return;
    const elements = root.querySelectorAll('[data-ab-slot]');
    elements.forEach((element) => {
      const slotName = element.getAttribute('data-ab-slot');
      if (!slotName || !(slotName in SLOT_MAP)) return;
      const label = getSlotLabel(slotName, config);
      if (!label) return;
      if (element.dataset && element.dataset.abConfigApplied === label) return;
      applyLabel(element, label);
      if (element.dataset) {
        element.dataset.abConfigApplied = label;
      }
    });

  };

  const bindTracking = (config, root = document) => {
    if (!window.AB015 || typeof window.AB015.track !== 'function') return;
    const elements = root.querySelectorAll('[data-ab-slot]');
    elements.forEach((element) => {
      if (element.dataset && element.dataset.abTrackingBound) return;
      const slotName = element.getAttribute('data-ab-slot');
      if (!slotName || !(slotName in SLOT_MAP)) return;
      if (element.dataset) element.dataset.abTrackingBound = 'true';
      element.addEventListener(
        'click',
        () => {
          if (slotName === 'form_next') {
            window.AB015.track('step_advance', slotName, { step_index: getStepIndex() });
            return;
          }
          if (slotName === 'form_submit') {
            window.AB015.track('completion', slotName, { step_index: getStepIndex() });
            return;
          }
          window.AB015.track('click', slotName, { step_index: getStepIndex() });
        },
        { passive: true }
      );
    });
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

  const init = () => {
    const apply = (config) => {
      applySlots(config);
      bindTracking(config);
      if (!window.MutationObserver) return;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            applySlots(config, node);
            bindTracking(config, node);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const ready = () => {
      if (!window.AB015 || typeof window.AB015.getConfig !== 'function') return;
      window.AB015.getConfig().then((config) => {
        if (!config) return;
        apply(config);
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  };

  init();
})();
