const CACHE='qc-platform-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['index.html','styles.css','app.js','manifest.json','data/defects.json','data/docs.json','assets/placeholder-grapes.svg']))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
