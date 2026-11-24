/* Aufruf: python3 -m http.server 8796 im Repo starten, dann node scripts/pruefe-admin-vergangen.js
   Betreiber 24.11.2026: Der Admin-Kalender soll auch die vergangenen Aufenthalte zeigen, „ab 15.10.“.
   Vorher begann er 7 Tage vor heute – ein Aufenthalt vom Oktober war nicht mehr zu sehen.
   Geprüft: Buchung 15.–18.10. steht im Kalender (bei heute = 24.11.), der Kalender öffnet trotzdem bei gestern,
   und eine vergangene Buchung landet in keiner der Warnlisten. */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:860}});
await ctx.clock.setFixedTime(new Date('2026-11-24T10:00:00Z'));let f=0;const ok=(c,t)=>{console.log((c?'ok    ':'ROT   ')+t);if(!c)f++};
const H=[{id:'kranz',name:'Kranzstraße 9',wgs:[1,2],namen:{}}];
const B=(id,gast,wg,an,ab,o)=>({id,quelle:'airbnb',code:id.slice(3),gast,haus:'kranz',wg,anreise:an,abreise:ab,gaeste:2,status:'bestaetigt',frueh:'',spaet:'',notiz:'',...o});
const liste=[B('ab-OKT','Oktober Olga',1,'2026-10-15','2026-10-18',{gaeste:''}),B('ab-NOV','November Nils',2,'2026-11-26','2026-11-28')];
await ctx.addInitScript(()=>{localStorage.setItem('putzplan.pin','1234');localStorage.setItem('putzplan.pinBis',String(Date.now()+864e5));localStorage.setItem('putzplan.gesehen',JSON.stringify(['ab-OKT','ab-NOV']))});
await ctx.route(/script\.google\.com/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,heute:'2026-11-24',haeuser:H,buchungen:liste})}));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8796/admin/');await p.waitForTimeout(1500);
ok(!!(await p.$('.bk[data-id="ab-OKT"]')),'Aufenthalt 15.–18.10. steht im Kalender');
ok(!!(await p.$('.bk[data-id="ab-NOV"]')),'kommender Aufenthalt steht weiter da');
const g=await p.evaluate(()=>{const k=document.querySelector('.kal');const kr=k.getBoundingClientRect();const lab=k.querySelector('.lab').getBoundingClientRect().width;
  const t=[...k.querySelectorAll('.kopf .kt')].find(e=>{const r=e.getBoundingClientRect();return r.left>=kr.left+lab-1});return t?t.querySelector('.nr').textContent:''});
ok(g==='23','Kalender öffnet bei gestern (erster sichtbarer Tag: '+g+')');
const abs=await p.$$eval('#app .abschnitt',l=>l.map(e=>e.textContent));ok(!abs.length,'vergangener Aufenthalt ohne Angabe steht in keiner Warnliste '+abs.join(' | '));
ok(!errs.length,'keine Seitenfehler '+errs.join(' / '));console.log(f?'ROT':'Alles grün');await b.close();process.exit(f?1:0)})();
