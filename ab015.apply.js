(() => {
  const SLOT_MAP = {
    hero_headline: 'heroHeadlineText',
    nav_cta: 'navCtaLabel',
    homepage_buttons: 'primaryCtaLabel',
    form_next: 'formNextLabel',
    form_submit: 'formSubmitLabel',
    blog_mid_segue: 'blogSegueText',
    blog_end_cta: 'blogCtaText',
    lead_anchor: 'leadAnchorLabel'
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

  const exposureFallback = new Set();

  const safeGetSessionStorage = () => {
    try {
      const testKey = '__ab015_exposure__';
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
      return sessionStorage;
    } catch (error) {
      return null;
    }
  };

  const getExposureKey = (slotName, config) => {
    if (slotName === 'homepage_buttons' && config?.variantId) {
      return `ab015_exposure_${slotName}_${config.variantId}`;
    }
    return `ab015_exposure_${slotName}`;
  };

  const trackExposureOnce = (slotName, config) => {
    if (!window.AB015 || typeof window.AB015.track !== 'function') return;
    const storage = safeGetSessionStorage();
    const key = getExposureKey(slotName, config);
    if (storage?.getItem(key) || exposureFallback.has(key)) return;
    window.AB015.track('exposure', slotName);
    if (storage) {
      storage.setItem(key, '1');
    } else {
      exposureFallback.add(key);
    }
  };

  const getSlotLabel = (slotName, config) => {
    const key = SLOT_MAP[slotName];
    const value = key ? config?.[key] : null;
    return typeof value === 'string' ? value : null;
  };

  const applySlots = (config, root = document) => {
    if (!config) return;
    const elements = root.querySelectorAll('[data-ab-slot][data-ab-label]');
    elements.forEach((element) => {
      const slotName = element.getAttribute('data-ab-slot');
      if (!slotName || !(slotName in SLOT_MAP)) return;
      const label = getSlotLabel(slotName, config);
      if (!label) return;
      if (element.dataset && element.dataset.abConfigApplied === label) return;
      applyLabel(element, label);
      if (element.dataset?.abTrack === 'exposure') {
        trackExposureOnce(slotName, config);
      }
      if (element.dataset) {
        element.dataset.abConfigApplied = label;
      }
    });

  };

  const isInteractiveElement = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches('a[href], button, [role="button"]')) return true;
    if (element.matches('input[type="submit"], input[type="button"], input[type="image"]')) return true;
    return false;
  };

  const bindTracking = (config, root = document) => {
    if (!window.AB015 || typeof window.AB015.track !== 'function') return;
    const elements = root.querySelectorAll('[data-ab-slot]');
    elements.forEach((element) => {
      if (element.dataset && element.dataset.abTrackingBound) return;
      const slotName = element.getAttribute('data-ab-slot');
      if (!slotName || !(slotName in SLOT_MAP)) return;
      if (!isInteractiveElement(element)) return;
      if (element.dataset && element.dataset.abClick === 'false') return;
      if (element.dataset) element.dataset.abTrackingBound = 'true';
      element.addEventListener(
        'click',
        () => {
          if (slotName === 'form_next') {
            window.AB015.track('step_advance', slotName, { step_index: getStepIndex() });
            return;
          }
          if (slotName === 'form_submit') {
            window.AB015.track('click', slotName, { step_index: getStepIndex() });
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
