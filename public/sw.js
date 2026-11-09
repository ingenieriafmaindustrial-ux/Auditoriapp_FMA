// Service worker mínimo: habilita instalar la app (PC y celular).
// No guarda nada en caché a propósito: los datos viven en Firestore y cada publicación en Netlify
// se ve de inmediato, sin versiones viejas atrapadas en el dispositivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
