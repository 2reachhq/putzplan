/* Service Worker des Putzplans: macht die Seite installierbar (Home-Bildschirm). Speichert bewusst NICHTS zwischen –
   der Plan muss immer live aus der Tabelle kommen. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
