// Owner branding: single source of the Mavix Tech copy, link and logo paths.
// Classic script (like the rest of js/); exposes a frozen window.PH_OWNER read by js/ui.js.
(function () {
  'use strict';

  window.PH_OWNER = Object.freeze({
    name: 'Mavix Tech',
    tagline: 'Systems · Automation · Graduation Projects',
    description: 'Custom business systems, workflow automation and complete graduation projects. ASP.NET, Angular, SQL Server.',
    cta: "Have an idea? Let's build it.",
    url: 'https://mavixtechma-ship-it.github.io/Mavix/',
    logo: 'assets/mavix/mavix-logo.svg',           // wordmark for light backgrounds
    logoDark: 'assets/mavix/mavix-logo-white.svg', // wordmark for dark backgrounds
    mark: 'assets/mavix/mavix-mark.svg',
    markDark: 'assets/mavix/mavix-mark-white.svg',
  });
})();
