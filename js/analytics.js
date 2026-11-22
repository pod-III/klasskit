/**
 * KlassKit — Cloudflare Web Analytics loader
 *
 * Privacy-friendly, cookieless analytics (no personal data, no consent banner needed).
 * Get your token: Cloudflare Dashboard → Analytics & Logs → Web Analytics →
 *   "Add a site" → enter klasskit.fun → choose "Manual JS snippet" → copy the token
 *   from the generated snippet: data-cf-beacon='{"token": "THIS_VALUE"}'
 */
(function () {
  const CF_BEACON_TOKEN = '65bd3bccbd8c4b469f5416add2a694f4';

  // Skip when the token isn't configured yet
  if (!CF_BEACON_TOKEN || CF_BEACON_TOKEN.startsWith('YOUR_')) return;

  // Skip local development / file previews so they don't pollute stats
  const host = window.location.hostname;
  if (
    window.location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.vercel.app') || // Vercel preview deployments
    host.endsWith('.pages.dev') // Cloudflare Pages preview deployments
  ) return;

  // Avoid double-injecting
  if (document.querySelector('script[data-cf-beacon]')) return;

  const s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }));
  document.head.appendChild(s);
})();
