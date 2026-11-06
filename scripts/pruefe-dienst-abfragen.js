/* Aufruf: node scripts/pruefe-dienst-abfragen.js dienst/Code.gs admin/index.html  – vor jedem Einfügen von Code.gs laufen lassen */
/* Jede Abfrage, die die Admin-Seite schickt, muss der Dienst kennen (sonst „Keine Verbindung“) – Vorfall 06.11.2026 */
const vm=require('vm'),fs=require('fs');const [gs,adm]=process.argv.slice(2);
const typen=[...new Set([...fs.readFileSync(adm,'utf8').matchAll(/typ:'([a-zA-Z]+)'/g)].map(m=>m[1]))];
const ctx={console,Utilities:{formatDate:()=>'2026-11-06'},ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType(){return t}})},
  LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(gs,'utf8'),ctx);
vm.runInContext(`adminOk=()=>true;buchungenLesen=()=>[];buchungenSchreiben=()=>{};oeffentlichSchreiben=()=>{};sofortMelden=()=>{};abgleich=()=>{};
  kostenLesen=()=>({});kostenSchreiben=()=>{};`,ctx);
let fehler=0;for(const typ of typen){const r=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({typ,monat:'2026-11',aenderungen:[],daten:{}})}}));
  const ok=r.fehler!=='typ';if(!ok)fehler++;console.log((ok?'ok    ':'FEHLT ')+typ+(r.fehler?' ('+r.fehler+')':''))}
if(!typen.length||fehler){console.log('ROT');process.exit(1)}console.log('Alle '+typen.length+' Abfragen bekannt');
