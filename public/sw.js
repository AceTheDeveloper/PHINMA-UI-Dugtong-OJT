// Dugtong service worker (ticket-35). It makes the app installable and shows an
// offline page. It caches only three things: the offline page, the app icons, and
// the build's static files (/_next/static/, named by a hash of their content).
// It never caches a page, an API response, or anything behind sign-in, and it
// never queues an action: time in and out must come from the server clock.
//
// The page registers it as /sw.js?v=<build>. A new build is a new URL, so the
// browser installs the new worker and this one's caches are deleted.

const version = new URL(self.location.href).searchParams.get("v") || "dev";
const cacheName = `dugtong-static-${version}`;
const offlineUrl = "/offline";
const precached = [offlineUrl, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => Promise.all(precached.map((url) => addIfOk(cache, url))))
      .then(() => self.skipWaiting()),
  );
});

// A redirect or an error (for example a landing-only site that closes every
// other path) is not worth keeping; the worker still installs without it.
async function addIfOk(cache, url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok || response.redirected) return;
    await cache.put(url, response.clone());
    if (url === offlineUrl) await addAssetsOf(cache, await response.text());
  } catch {
    // no signal during install; the offline page is added on the next install
  }
}

// The offline page needs its stylesheet, fonts, and scripts to look right with no
// signal, and they are only kept when someone has already opened a page that uses
// them. Keep the ones it names now. They are build files, with no personal data.
async function addAssetsOf(cache, html) {
  const paths = new Set(html.match(/\/_next\/static\/[^"'\\\s<>)]+/g) || []);
  await Promise.all([...paths].map((path) => addIfOk(cache, path)));
}

// Deletes every Dugtong cache, then puts the offline page and icons back: they
// hold no personal data and the next offline visit needs them.
async function clearAll() {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("dugtong-")).map((name) => caches.delete(name)));
  const cache = await caches.open(cacheName);
  await Promise.all(precached.map((url) => addIfOk(cache, url)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("dugtong-") && name !== cacheName)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The page asks for this on sign-out, so a shared phone keeps nothing.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-caches") event.waitUntil(clearAll());
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Other sites (Clerk, fonts) and the sign-in screens are the browser's to fetch.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/sign-in")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(cacheName).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // A page: always the network. Only when it fails is the offline page shown, and
  // only for the person's own navigation, never for data requests.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(offlineUrl)
          .then(
            (page) =>
              page ||
              new Response("You're offline. Time in and approvals need a connection.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              }),
          ),
      ),
    );
  }
  // Anything else (data, files, API calls) is not intercepted: network only.
});
