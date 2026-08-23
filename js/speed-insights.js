// Vercel Speed Insights initialization
// This file loads and initializes Vercel Speed Insights for performance monitoring

// Initialize the Speed Insights queue
window.si = window.si || function () {
  (window.siq = window.siq || []).push(arguments);
};

// Load the Speed Insights script
(function() {
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script. This is expected in local development.');
  };
  document.head.appendChild(script);
})();
