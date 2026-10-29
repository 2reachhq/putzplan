/* Service Worker des Putzplans: macht die Seite installierbar und zeigt die Abend-Push-Meldung.
   Speichert bewusst NICHTS zwischen – der Plan muss immer live aus der Tabelle kommen.
   Der Push kommt ohne Inhalt (einfacher und sicherer zu signieren); den Text holt der Worker beim Dienst ab. */
importScripts('dienst.js');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>e.waitUntil((async()=>{
  const haus=self.registration.scope.includes('/poether/')?'poether':'kranz';
  let m=null;try{const r=await fetch(self.DIENST+'?typ=meldung&haus='+haus,{cache:'no-store'});m=await r.json()}catch(err){}
  if(!m||!m.title)m={title:haus==='poether'?'Putzplan – Poetherweg 17':'Cleaning Plan – Kranzstraße 9',body:'',url:self.registration.scope};
  await self.registration.showNotification(m.title,{body:m.body,icon:'icons/icon-192.png',badge:'icons/favicon-32.png',tag:'putzplan-'+haus,renotify:true,data:{url:m.url||self.registration.scope}})})()));
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||self.registration.scope;
  e.waitUntil((async()=>{const L=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of L)if(c.url.startsWith(self.registration.scope)&&'focus' in c)return c.focus();return self.clients.openWindow(url)})())});
