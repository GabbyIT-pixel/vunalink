const CACHE_NAME = "vunalink-shell-v6"; // bump whenever the model in /models changes
const APP_SHELL = [
  "/",
  "/scan",
  "/history",
  "/settings",
  "/profile",
  "/manifest.webmanifest",
  "/vunalink-icon.png",
  "/models/vunalink-mobilenet-v2.onnx",
  "/onnxruntime/ort-wasm-simd-threaded.mjs",
  "/onnxruntime/ort-wasm-simd-threaded.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("/") : Response.error()))),
  );
});
