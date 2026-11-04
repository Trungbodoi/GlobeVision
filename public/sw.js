const CACHE_NAME = "globevision-app-v1";
const BASE_URL = new URL("./", self.location.href);
const APP_SHELL = [
  "./",
  "./index.html",
  "./build-manifest.json",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./og-image.png",
  "./data/countries.geojson",
  "./data/boundaries.geojson",
  "./data/geography.geojson",
].map((path) => new URL(path, BASE_URL).href);

async function precacheApp(cache) {
  const indexUrl = new URL("./index.html", BASE_URL).href;
  const indexResponse = await fetch(indexUrl);
  if (!indexResponse.ok) throw new Error(`Could not cache the app shell (${indexResponse.status}).`);

  const manifestUrl = new URL("./build-manifest.json", BASE_URL).href;
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Could not load the production asset manifest (${manifestResponse.status}).`);
  }
  const manifest = await manifestResponse.json();
  const assets = new Set();
  for (const entry of Object.values(manifest)) {
    if (entry.file) assets.add(entry.file);
    for (const file of entry.css || []) assets.add(file);
  }
  const assetUrls = [...assets].map((asset) => new URL(asset, BASE_URL).href);

  await cache.put(indexUrl, indexResponse);
  await cache.addAll([
    ...APP_SHELL.filter((url) => url !== indexUrl),
    ...assetUrls,
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(precacheApp)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("globevision-app-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(
              new URL("./index.html", BASE_URL).href,
              copy
            ));
          }
          return response;
        })
        .catch(async () => (
          await caches.match(request, { ignoreVary: true }) ||
          await caches.match(new URL("./index.html", BASE_URL).href, { ignoreVary: true })
        ))
    );
    return;
  }

  const isAppAsset =
    requestUrl.pathname.startsWith(new URL("./assets/", BASE_URL).pathname) ||
    requestUrl.pathname === new URL("./build-manifest.json", BASE_URL).pathname;
  const isPublicData = requestUrl.pathname.startsWith(new URL("./data/", BASE_URL).pathname);
  if (!isAppAsset && !isPublicData && !requestUrl.pathname.endsWith(".webmanifest")) return;

  const cacheResponse = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  };

  if (isAppAsset) {
    event.respondWith(
      caches.match(request, { ignoreVary: true })
        .then((cached) => cached || fetch(request).then(cacheResponse))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      const network = fetch(request).then(cacheResponse).catch((error) => {
        if (cached) return cached;
        throw error;
      });
      return cached || network;
    })
  );
});
