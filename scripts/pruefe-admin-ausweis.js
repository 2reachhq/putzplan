/* Aufruf: python3 -m http.server 8796 im Repo starten, dann node scripts/pruefe-admin-ausweis.js */
/* Admin: Liste „Ausweis fehlt“, Feld in der Buchung, Veröffentlichen schickt ausweis */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:860},timezoneId:'Asia/Bangkok'});
await ctx.clock.setFixedTime(new Date('2026-11-17T10:00:00Z'));let f=0;const ok=(c,t)=>{console.log((c?'ok    ':'ROT   ')+t);if(!c)f++};
const H=[{id:'kranz',name:'Kranzstraße 9',wgs:[1,2,3,4],namen:{}},{id:'poether',name:'Poetherweg 17',wgs:[1,2,3],namen:{2:'Komfort für 2'}}];
const B=(id,quelle,gast,haus,wg,an,ab,o)=>({id,quelle,code:id.slice(3),gast,haus,wg,anreise:an,abreise:ab,gaeste:2,status:'bestaetigt',frueh:'',spaet:'',notiz:'',...o});
const liste=[B('bk-2222222222','booking','Beispiel Ben','poether',2,'2026-11-20','2026-11-22',{gebucht:'2026-11-16T16:20:00Z'}),
  B('bk-1111111111','booking','Muster Anna','kranz',2,'2026-11-25','2026-11-27',{gebucht:'2026-11-16T16:10:00Z',ausweis:'2026-11-16',ausweisBest:'2026-11-16T17:00:00Z'}),
  B('bk-3333333333','booking','Alt Otto','kranz',1,'2026-11-19','2026-11-20',{gebucht:'2026-11-10T09:00:00Z'}),
  B('ab-HMAIRBNB01','airbnb','Air Bea','kranz',3,'2026-11-18','2026-11-19')];
const gesendet=[];
await ctx.addInitScript(()=>{localStorage.setItem('putzplan.pin','1234');localStorage.setItem('putzplan.pinBis',String(Date.now()+864e5));localStorage.setItem('putzplan.gesehen',JSON.stringify(['bk-2222222222','bk-1111111111','bk-3333333333','ab-HMAIRBNB01']))});
await ctx.route(/script\.google\.com/,r=>{const o=JSON.parse(r.request().postData()||'{}');gesendet.push(o);const J=x=>r.fulfill({contentType:'application/json',body:JSON.stringify(x)});
  if(o.typ==='veroeffentlichen')return J({ok:true,fertig:(o.aenderungen||[]).map(a=>({vorher:a.id,buchung:{...liste.find(x=>x.id===a.id),...a.felder}}))});
  J({ok:true,heute:'2026-11-17',haeuser:H,buchungen:liste})});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('http://localhost:8796/admin/');await p.waitForTimeout(1500);
const abs=await p.$$eval('#app .abschnitt',l=>l.map(e=>e.textContent));
ok(abs.some(t=>/Ausweis fehlt noch – Booking \(1\)/.test(t)),'Liste „Ausweis fehlt“ mit genau 1 Buchung: '+abs.join(' | '));
const z=await p.$$eval('#app .zeile.ausweis',l=>l.map(e=>e.innerText.replace(/\s+/g,' ')));ok(z.length===1&&/Beispiel Ben/.test(z[0]),'… das ist Ben (nicht Anna mit Ausweis, nicht die alte Buchung, nicht Airbnb)');
await p.click('#app .zeile.ausweis');await p.waitForTimeout(300);
ok(await p.isVisible('#blatt .ausweis select[name=ausweis]'),'Buchung zeigt das Feld „Ausweis“');
await p.screenshot({path:require('os').tmpdir()+'/ausweis_blatt.png'});
await p.selectOption('#blatt select[name=ausweis]','ja');await p.click('#bOk');await p.waitForTimeout(300);
const pub=await p.$('[data-a="veroeffentlichen"],#veroeffentlichen,button:has-text("Veröffentlichen")');
if(pub){await pub.click();await p.waitForTimeout(600)}
const v=gesendet.filter(o=>o.typ==='veroeffentlichen').at(-1);
ok(!!v&&v.aenderungen.length===1&&v.aenderungen[0].felder.ausweis==='2026-11-17'&&Object.keys(v.aenderungen[0].felder).length===1,'Veröffentlichen schickt nur ausweis=heute: '+JSON.stringify(v&&v.aenderungen));
await p.click('[data-id="bk-1111111111"]').catch(()=>{});await p.waitForTimeout(300);
const t=await p.$eval('#blatt .ausweis',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'-');ok(/Bestätigung an den Gast gesendet am Mo 16\.11\.$/.test(t),'Anna: „erhalten“ und „Bestätigung gesendet“ ('+t+')');
await p.keyboard.press('Escape');await p.click('[data-id="ab-HMAIRBNB01"]').catch(()=>{});await p.waitForTimeout(300);
ok(!(await p.$('#blatt .ausweis')),'Airbnb-Buchung ohne Ausweis-Feld');
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'kein seitliches Scrollen');
ok(!errs.length,'keine Seitenfehler '+errs.join(' / '));console.log(f?'ROT':'Alles grün');await b.close();process.exit(f?1:0)})();
