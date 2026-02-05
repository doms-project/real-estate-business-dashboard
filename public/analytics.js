// Analytics Script - Include on your website with:
// <script src="https://yourdomain.com/api/analytics/script?siteId=your-site-id&locationId=your-location-id"></script>
// Or inline the script directly

(function() {
  'use strict';

  // Prevent duplicate initialization
  if (window.analytics && window.analytics.initialized) {
    return;
  }

  // Configuration - can be overridden by inline config
  // Determine dashboard API URL - more reliable approach
  let dashboardOrigin = 'http://localhost:3000'; // Default for development

  // Method 1: Check if we're in development (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    dashboardOrigin = window.location.origin;
    console.log('Analytics: Using localhost dashboard origin:', dashboardOrigin);
  }
  // Method 2: Try to detect from script tags
  else {
    try {
      // Look for our script in all script tags
      const allScripts = document.getElementsByTagName('script');
      console.log('Analytics: Scanning', allScripts.length, 'script tags for analytics script');

      for (let i = 0; i < allScripts.length; i++) {
        const script = allScripts[i];
        if (script.src && script.src.includes('/api/analytics/script')) {
          console.log('Analytics: Found analytics script:', script.src);
          try {
            const scriptUrl = new URL(script.src);
            dashboardOrigin = scriptUrl.origin;
            console.log('Analytics: Detected dashboard origin from script:', dashboardOrigin);
            break;
          } catch (urlError) {
            console.warn('Analytics: Failed to parse script URL:', script.src, urlError);
          }
        }
      }

      if (dashboardOrigin === 'http://localhost:3000') {
        console.log('Analytics: No production dashboard detected, using localhost');
      }
    } catch (error) {
      console.warn('Analytics: Script detection failed:', error);
    }
  }

  console.log('Analytics: Final dashboard origin:', dashboardOrigin);

  let config = window.ANALYTICS_CONFIG || {
    siteId: window.location.hostname.replace(/^www\./, '').replace(/\./g, '-'), // Auto-generate from domain
    locationId: 'be4yGETqzGQ4sknbwXb3',
    apiUrl: dashboardOrigin + '/api/analytics',
    debug: false
  };

  console.log('📊 Analytics: Config initialized:', {
    hostname: window.location.hostname,
    generatedSiteId: config.siteId,
    locationId: config.locationId,
    apiUrl: config.apiUrl
  });

  // Manual override examples (uncomment and modify as needed):
  // if (window.location.hostname === 'youngstownmarketing.com') {
  //   config.siteId = 'youngstown-marketing';
  // }
  // if (window.location.hostname === 'blog.youngstownmarketing.com') {
  //   config.siteId = 'youngstown-marketing-blog';
  // }
  // if (window.location.hostname === 'landing.youngstownmarketing.com') {
  //   config.siteId = 'youngstown-marketing-landing';
  // }

  // Parse URL parameters from website URL and script URL
  const websiteUrlParams = new URLSearchParams(window.location.search);

  // Also parse parameters from the analytics script URL
  let scriptUrlParams = new URLSearchParams();
  try {
    const scripts = document.querySelectorAll('script[src*="analytics/script"]');
    if (scripts.length > 0) {
      const scriptSrc = scripts[scripts.length - 1].src;
      const scriptUrl = new URL(scriptSrc);
      scriptUrlParams = scriptUrl.searchParams;
    }
  } catch (error) {
    console.warn('Analytics: Could not parse script URL parameters');
  }

  // Priority: script URL parameters > website URL parameters > defaults
  if (scriptUrlParams.get('siteId')) {
    config.siteId = scriptUrlParams.get('siteId');
  } else if (websiteUrlParams.get('analytics_site')) {
    config.siteId = websiteUrlParams.get('analytics_site');
  } else if (websiteUrlParams.get('siteId')) {
    config.siteId = websiteUrlParams.get('siteId');
  }

  if (scriptUrlParams.get('locationId')) {
    config.locationId = scriptUrlParams.get('locationId');
  } else if (websiteUrlParams.get('analytics_location')) {
    config.locationId = websiteUrlParams.get('analytics_location');
  } else if (websiteUrlParams.get('locationId')) {
    config.locationId = websiteUrlParams.get('locationId');
  }

  // Generate or retrieve session ID with timeout logic (30 minutes inactivity)
  function getSessionId() {
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    const now = Date.now();

    let sessionData = localStorage.getItem('analytics_session_data');
    let sessionId;
    let lastActivity;

    if (sessionData) {
      try {
        const data = JSON.parse(sessionData);
        sessionId = data.id;
        lastActivity = data.lastActivity;

        // Check if session has expired (30 minutes of inactivity)
        if (now - lastActivity > SESSION_TIMEOUT) {
          sessionId = null; // Force new session
        }
      } catch (e) {
        // Invalid data, create new session
        sessionId = null;
      }
    }

    if (!sessionId) {
      sessionId = 'session_' + now + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Update last activity timestamp
    localStorage.setItem('analytics_session_data', JSON.stringify({
      id: sessionId,
      lastActivity: now
    }));

    return sessionId;
  }

  // Get UTM parameters
  function getUtmParams() {
    const params = {};
    ['source', 'medium', 'campaign', 'term', 'content'].forEach(param => {
      const value = websiteUrlParams.get('utm_' + param);
      if (value) params[param] = value;
    });
    return params;
  }

  // Get device/browser info
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    const device = {
      type: 'desktop',
      browser: 'unknown',
      os: 'unknown'
    };

    // Detect mobile/tablet
    if (/Mobi|Android/i.test(ua)) {
      device.type = 'mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
      device.type = 'tablet';
    }

    // Detect OS
    if (/Windows/i.test(ua)) device.os = 'windows';
    else if (/Mac/i.test(ua)) device.os = 'macos';
    else if (/Linux/i.test(ua)) device.os = 'linux';
    else if (/Android/i.test(ua)) device.os = 'android';
    else if (/iOS|iPhone|iPad/i.test(ua)) device.os = 'ios';

    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
      device.browser = 'chrome';
    } else if (ua.includes('Firefox')) {
      device.browser = 'firefox';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      device.browser = 'safari';
    } else if (ua.includes('Edg')) {
      device.browser = 'edge';
    } else if (ua.includes('OPR')) {
      device.browser = 'opera';
    }

    return device;
  }

  // Hash IP address for privacy compliance
  function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Send data to API
  function sendToAPI(data) {
    if (config.debug) {
      console.log('📤 Analytics: Sending event:', data.eventType, 'for site:', data.siteId);
    }

    // Add timestamp and session info
    data.timestamp = Date.now();

    fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    }).then(response => {
      if (config.debug) {
        console.log('📥 Analytics: Response status:', response.status, 'for event:', data.eventType);
      }
      if (!response.ok) {
        console.error('❌ Analytics: API error for', data.eventType, ':', response.status, response.statusText);
      }
    }).catch(error => {
      console.error('❌ Analytics: Network error for', data.eventType, ':', error);
    });
  }

  // Track page view
  function trackPageView() {
    const sessionId = getSessionId(); // This updates the last activity timestamp

    const pageData = {
      siteId: config.siteId,
      sessionId: sessionId,
      eventType: 'page_view',
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      utmParams: getUtmParams(),
      deviceInfo: getDeviceInfo(),
      eventData: {
        title: document.title,
        locationId: config.locationId,
        url: window.location.href,
        timestamp: Date.now(),
        // Additional traffic source data for better attribution
        utmSource: getUtmParams().source,
        utmMedium: getUtmParams().medium,
        utmCampaign: getUtmParams().campaign
      }
    };

    if (config.debug) {
      console.log('📊 Sending page_view event:', pageData);
    }

    sendToAPI(pageData);
  }

  // Track custom events
  function trackEvent(eventType, eventData = {}) {
    const eventPayload = {
      siteId: config.siteId,
      sessionId: getSessionId(),
      eventType: 'event',
      pageUrl: window.location.href,
      eventData: {
        eventType: eventType,
        ...eventData,
        timestamp: Date.now()
      }
    };

    sendToAPI(eventPayload);
  }

  // Auto-track form interactions
  function setupFormTracking() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupFormTracking);
      return;
    }

    // Track form starts (first interaction with any form field)
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (form.dataset.analyticsTracked) return;

      form.dataset.analyticsTracked = 'true';

      form.addEventListener('focusin', function(e) {
        if (!form.dataset.started) {
          form.dataset.started = 'true';
          trackEvent('form_start', {
            formAction: form.action,
            formMethod: form.method,
            formId: form.id || form.className,
            selector: getElementSelector(form)
          });
        }
      }, true);

      // Track form completions
      form.addEventListener('submit', function(e) {
        trackEvent('form_complete', {
          formAction: form.action,
          formId: form.id || form.className,
          selector: getElementSelector(form)
        });
      });
    });

    // Track phone number clicks
    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    phoneLinks.forEach(link => {
      if (link.dataset.analyticsTracked) return;

      link.dataset.analyticsTracked = 'true';
      link.addEventListener('click', function(e) {
        trackEvent('phone_click', {
          phoneNumber: link.href.replace('tel:', ''),
          linkText: link.textContent?.trim(),
          selector: getElementSelector(link)
        });
      });
    });

    // Track email clicks
    const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
    emailLinks.forEach(link => {
      if (link.dataset.analyticsTracked) return;

      link.dataset.analyticsTracked = 'true';
      link.addEventListener('click', function(e) {
        trackEvent('email_click', {
          email: link.href.replace('mailto:', ''),
          linkText: link.textContent?.trim(),
          selector: getElementSelector(link)
        });
      });
    });

    // Track button clicks (CTA buttons)
    const ctaSelectors = [
      'button[class*="cta"]',
      'a[class*="cta"]',
      '.btn-primary',
      '.button-primary',
      '[class*="contact"]',
      '[id*="contact"]'
    ];

    ctaSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.dataset.analyticsTracked) return;

        element.dataset.analyticsTracked = 'true';
        element.addEventListener('click', function(e) {
          trackEvent('cta_click', {
            buttonText: element.textContent?.trim(),
            buttonType: element.tagName.toLowerCase(),
            selector: getElementSelector(element)
          });
        });
      });
    });
  }

  // Get CSS selector for element
  function getElementSelector(element) {
    if (!element) return '';

    let selector = element.tagName.toLowerCase();
    if (element.id) {
      selector += '#' + element.id;
    } else if (element.className) {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    const siblings = element.parentNode?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(element) + 1;
      selector += `:nth-child(${index})`;
    }

    return selector;
  }

  // Track time on page and scroll depth
  let pageStartTime = Date.now();
  let maxScrollDepth = 0;

  function trackScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    const scrollDepth = Math.min(100, Math.round((scrollTop + windowHeight) / documentHeight * 100));
    maxScrollDepth = Math.max(maxScrollDepth, scrollDepth);
  }

  // Track scroll events (throttled)
  let scrollTimeout;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(trackScrollDepth, 100);
  });

  // Track page unload
  window.addEventListener('beforeunload', function() {
    const timeOnPage = Math.round((Date.now() - pageStartTime) / 1000);
    trackEvent('page_unload', {
      timeOnPage: timeOnPage,
      maxScrollDepth: maxScrollDepth,
      pageUrl: window.location.href
    });
  });

  // Track visibility changes (tab switching)
  let pageVisibleStart = Date.now();
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Tab became hidden
      const timeVisible = Math.round((Date.now() - pageVisibleStart) / 1000);
      trackEvent('tab_hidden', {
        timeVisible: timeVisible
      });
    } else {
      // Tab became visible
      pageVisibleStart = Date.now();
      trackEvent('tab_visible', {});
    }
  });

  // Initialize tracking
  console.log('🚀 Analytics: Initializing tracking for site:', config.siteId);

  try {
    trackPageView();
    console.log('✅ Analytics: Page view tracking initialized');
  } catch (pageViewError) {
    console.error('❌ Analytics: Failed to initialize page view tracking:', pageViewError);
  }

  try {
    setupFormTracking();
    console.log('✅ Analytics: Form tracking initialized');
  } catch (formTrackingError) {
    console.error('❌ Analytics: Failed to initialize form tracking:', formTrackingError);
  }

  console.log('✅ Analytics: Tracking initialization complete');

  // Make tracking functions globally available
  window.analytics = {
    track: trackEvent,
    config: config,
    getSessionId: getSessionId,
    initialized: true
  };

  if (config.debug) {
    console.log('Analytics initialized:', config);
    console.log('Session ID:', getSessionId());
  }

})();