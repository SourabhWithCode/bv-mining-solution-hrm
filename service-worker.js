const CACHE_NAME = 'bv-mining-hr-shell-v1';
const APP_FILES = [
  './index.html', './login.html', './404.html', './admin-users.html', './audit-log.html',
  './attendance.html', './employee-records.html', './employees-data.html', './leave.html',
  './mining-report.html', './monthly-attendance.html', './ppe-issue-records.html',
  './ppe-stock.html', './reports.html', './samaan-issue.html', './shift-dashboard.html',
  './assets/css/admin-users.css', './assets/css/admin-users-access.css', './assets/css/attendance.css',
  './assets/css/audit-log.css', './assets/css/employee-records.css', './assets/css/employees-data.css',
  './assets/css/index.css', './assets/css/leave.css', './assets/css/login.css',
  './assets/css/mining-report.css', './assets/css/mining-theme.css', './assets/css/monthly-attendance.css',
  './assets/css/ppe-issue-records.css', './assets/css/ppe-stock.css', './assets/css/reports.css',
  './assets/css/responsive.css', './assets/css/samaan-issue.css', './assets/css/shift-dashboard.css',
  './assets/js/admin-users.js', './assets/js/app-bootstrap.js', './assets/js/attendance.js',
  './assets/js/audit-log.js', './assets/js/employee-records.js', './assets/js/employees-data.js',
  './assets/js/index.js', './assets/js/leave.js', './assets/js/login.js', './assets/js/mining-report.js',
  './assets/js/monthly-attendance.js', './assets/js/ppe-issue-records.js', './assets/js/ppe-stock.js',
  './assets/js/reports.js', './assets/js/shift-dashboard.js', './assets/js/supabase-client.js',
  './assets/js/supabase-config.js', './assets/js/samaan-issue.js'
];
const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    try {
      const sdk = await fetch(SUPABASE_SDK, { mode: 'no-cors' });
      await cache.put(SUPABASE_SDK, sdk);
    } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('bv-mining-hr-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && url.href !== SUPABASE_SDK) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
        return response;
      } catch {
        const cached=await caches.match(request,{ignoreSearch:true});
        if(cached)return cached;
        if(new URL(request.url).pathname.endsWith('/'))return (await caches.match('./index.html'))||(await caches.match('./404.html'));
        return await caches.match('./404.html');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    if(url.origin===self.location.origin){
      try{const response=await fetch(request);const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());return response}
      catch{const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;throw new Error('This app file is not cached for offline use.')}
    }
    const cached=await caches.match(request);if(cached)return cached;
    const response=await fetch(request);if(url.href===SUPABASE_SDK){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone())}return response;
  })());
});
