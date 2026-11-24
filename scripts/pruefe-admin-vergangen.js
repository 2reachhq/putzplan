/* Aufruf: python3 -m http.server 8796 im Repo starten, dann node scripts/pruefe-admin-vergangen.js
   Betreiber 24.11.2026: Der Admin-Kalender zeigt auch vergangene Aufenthalte – ab 15.10.2026, und sobald das
   länger als 6 Monate her ist, immer die letzten 6 Monate. Vorher begann er 7 Tage vor heute.
   Geprüft an zwei Tagen: (a) heute 24.11.2026 → Beginn 15.10., Oktober-Aufenthalt sichtbar;
   (b) heute 01.06.2027 → Beginn 01.12.2026, ein Aufenthalt vom November fällt heraus.
   Beide Male öffnet der Kalender bei gestern, und vergangene Aufenthalte landen in keiner Warnliste. */
const {chromium}=require('playwright');let f=0;const ok=(c,t)=>{console.log((c?'ok    ':'ROT   ')+t);if(!c)f++};
const H=[{id:'kranz',name:'Kranzstraße 9',wgs:[1,2],namen:{}}];
const B=(id,gast,wg,an,ab,o)=>({id,quelle:'airbnb',code:id.slice(3),gast,haus:'kranz',wg,anreise:an,abreise:ab,gaeste:2,status:'bestaetigt',frueh:'',spaet:'',notiz:'',...o});
async function lauf(b,heute,liste,erwartet){console.log('— heute '+heute);
  const ctx=await b.newContext({viewport:{width:375,height:860}});await ctx.clock.setFixedTime(new Date(heute+'T10:00:00Z'));
  await ctx.addInitScript(ids=>{localStorage.setItem('putzplan.pin','1234');localStorage.setItem('putzplan.pinBis',String(Date.now()+864e5));localStorage.setItem('putzplan.gesehen',JSON.stringify(ids))},liste.map(x=>x.id));
  await ctx.route(/script\.google\.com/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,heute,haeuser:H,buchungen:liste})}));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8796/admin/');await p.waitForTimeout(1500);
  for(const [id,da] of Object.entries(erwartet.buchungen))ok(!!(await p.$('.bk[data-id="'+id+'"]'))===da,id+(da?' steht im Kalender':' steht NICHT im Kalender'));
  const t=await p.evaluate(()=>{const k=document.querySelector('.kal');const kr=k.getBoundingClientRect();const lab=k.querySelector('.lab').getBoundingClientRect().width;
    const tage=[...k.querySelectorAll('.kopf .kt')];const erst=tage.find(e=>e.getBoundingClientRect().left>=kr.left+lab-1);
    return {erst:erst?erst.querySelector('.nr').textContent:'',beginn:tage[0].querySelector('.nr').textContent,monat:k.querySelector('.kopf .mseg .mo').textContent}});
  ok(t.beginn+' '+t.monat===erwartet.beginn,'Kalender beginnt am '+t.beginn+'. '+t.monat+' (soll '+erwartet.beginn+')');
  ok(t.erst===erwartet.gestern,'öffnet bei gestern (erster sichtbarer Tag: '+t.erst+')');
  const abs=await p.$$eval('#app .abschnitt',l=>l.map(e=>e.textContent));ok(!abs.length,'keine Warnliste für Vergangenes '+abs.join(' | '));
  ok(!errs.length,'keine Seitenfehler '+errs.join(' / '));await ctx.close()}
(async()=>{const b=await chromium.launch();
  await lauf(b,'2026-11-24',[B('ab-OKT','Oktober Olga',1,'2026-10-15','2026-10-18',{gaeste:''}),B('ab-NOV','November Nils',2,'2026-11-26','2026-11-28')],
    {buchungen:{'ab-OKT':true,'ab-NOV':true},beginn:'15 10/2026',gestern:'23'});
  await lauf(b,'2027-06-01',[B('ab-NOV','November Nils',1,'2026-11-20','2026-11-22'),B('ab-DEZ','Dezember Dora',2,'2026-12-05','2026-12-08',{gaeste:''}),B('ab-JUN','Juni Jan',1,'2027-06-03','2027-06-05')],
    {buchungen:{'ab-NOV':false,'ab-DEZ':true,'ab-JUN':true},beginn:'1 12/2026',gestern:'31'});
  console.log(f?'ROT':'Alles grün');await b.close();process.exit(f?1:0)})();
