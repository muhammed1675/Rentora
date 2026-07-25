/**
 * Google Analytics Integration
 * Tracks user interactions and conversions
 * 
 * To use:
 * 1. Get your Google Analytics Measurement ID from Google Analytics 4 property
 * 2. Set REACT_APP_GA_ID environment variable
 * 3. This module handles the rest
 */

// Initialize GA4
export function initializeAnalytics() {
  const measurementId = process.env.REACT_APP_GA_ID;
  
  if (!measurementId) {
    console.warn('[Analytics] REACT_APP_GA_ID not set. Analytics disabled.');
    return;
  }

  // Add GA script to document
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', measurementId);

  window.gtag = gtag;
}

/**
 * Track page view
 * Called on route changes
 */
export function trackPageView(pagePath, pageTitle) {
  if (!window.gtag) return;
  
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });
}

/**
 * Track custom event
 * @param {string} eventName - Event name (e.g., 'property_viewed', 'booking_started')
 * @param {object} eventData - Additional event data
 */
export function trackEvent(eventName, eventData = {}) {
  if (!window.gtag) return;
  
  window.gtag('event', eventName, eventData);
}

/**
 * Track property view
 * Called when user views property details
 */
export function trackPropertyView(propertyId, propertyName, price) {
  trackEvent('property_viewed', {
    property_id: propertyId,
    property_name: propertyName,
    price: price,
  });
}

/**
 * Track search action
 * Called when user performs a search
 */
export function trackSearch(query, filters = {}) {
  trackEvent('search', {
    search_term: query,
    ...filters,
  });
}

/**
 * Track booking start
 * Called when user initiates booking
 */
export function trackBookingStart(propertyId, propertyName, price) {
  trackEvent('begin_checkout', {
    value: price,
    currency: 'NGN',
    items: [
      {
        item_id: propertyId,
        item_name: propertyName,
        price: price,
      },
    ],
  });
}

/**
 * Track booking completion
 * Called when booking is successfully completed
 */
export function trackBookingComplete(bookingId, propertyId, propertyName, amount) {
  trackEvent('purchase', {
    transaction_id: bookingId,
    value: amount,
    currency: 'NGN',
    items: [
      {
        item_id: propertyId,
        item_name: propertyName,
        price: amount,
      },
    ],
  });
}

/**
 * Track user registration
 * Called when user creates account
 */
export function trackSignUp(userType) {
  trackEvent('sign_up', {
    method: 'email',
    user_type: userType, // 'student' or 'agent'
  });
}

/**
 * Track user login
 * Called when user logs in
 */
export function trackLogin(userType) {
  trackEvent('login', {
    method: 'email',
    user_type: userType,
  });
}

/**
 * Track favorite action
 * Called when user adds/removes favorite
 */
export function trackFavorite(propertyId, action) {
  trackEvent(`property_${action}ed_to_favorites`, {
    property_id: propertyId,
  });
}

/**
 * Track contact form submission
 */
export function trackContactSubmit(subject) {
  trackEvent('contact_form_submitted', {
    subject: subject,
  });
}

/**
 * Track comparison action
 */
export function trackPropertyComparison(propertyCount) {
  trackEvent('compare_properties', {
    property_count: propertyCount,
  });
}

/**
 * Set user properties for segmentation
 */
export function setUserProperties(userId, userType, email) {
  if (!window.gtag) return;
  
  window.gtag('config', process.env.REACT_APP_GA_ID, {
    'user_id': userId,
  });

  window.gtag('event', 'user_engagement', {
    user_id: userId,
    user_type: userType,
    user_email: email,
  });
}
