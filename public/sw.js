// Good Word's service worker (PRD F12, DS 8.3). Keeps the app shell (built
// scripts, styles, fonts, icons) and the last few lists you viewed, so the
// app opens offline to what you last saw. Everything else goes to the
// network. Signed-in pages are cleared when you reach sign-in, so a shared
// phone never shows the last person's lists.

const VERSION = "v2";
const SHELL = `gw-shell-${VERSION}`;
const PAGES = `gw-pages-${VERSION}`;
const MAX_PAGES = 6;

// Pages worth keeping for offline: lists and My list.
const KEEP = /^\/(list(\/(all|[0-9a-f-]{36}))?|you)$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("gw-") && k !== SHELL && k !== PAGES).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function remember(request, response) {
  const cache = await caches.open(PAGES);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(old);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Built assets never change at the same URL: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/app-icon/") || url.pathname.startsWith("/attribution/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode !== "navigate") return;

  // Reaching sign-in means signed out (or deleted): forget cached pages.
  if (url.pathname === "/sign-in" || url.pathname.startsWith("/sign-in/")) {
    event.waitUntil(caches.delete(PAGES));
    return;
  }

  // Pages: network first. Lists that load are kept for offline; offline,
  // the same page if kept, else the most recent list.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected && KEEP.test(url.pathname) && !url.search) {
          event.waitUntil(remember(request, response.clone()));
        }
        return response;
      } catch (error) {
        const cache = await caches.open(PAGES);
        const exact = await cache.match(request, { ignoreSearch: true });
        if (exact) return exact;
        const keys = await cache.keys();
        const latest = keys.length ? await cache.match(keys[keys.length - 1]) : undefined;
        if (latest) return latest;
        throw error;
      }
    })(),
  );
});
