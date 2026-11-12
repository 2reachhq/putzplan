/* Aufruf: node scripts/pruefe-storno.js dienst/Code.gs  – vor jedem Einfügen von Code.gs laufen lassen.
   Vorfall 12.11.2026: Die Airbnb-Stornos HMK2XJHKD2 (Sa 14.11., Poetherweg WG 3, 5 Gäste) und HM22ME85CX standen als
   „gesehen“ im Blatt, die Buchungen blieben aber aktiv – die Putzkraft wäre für Gäste losgefahren, die nie kamen.
   Geprüft wird: (1) ein Storno greift auch dann, wenn seine Mail schon als gesehen gilt; (2) danach nimmt dieselbe Wohnung
   eine NEUE Buchung für dieselben Tage an, und der Putzplan zeigt nur diese; (3) bricht das Schreiben der Buchungen ab,
   wird die Mail NICHT als gesehen gemerkt (sonst wäre sie beim nächsten Lauf verloren). */
const vm=require('vm'),fs=require('fs');const gs=process.argv[2];
const eq=(a,b,t)=>{if(JSON.stringify(a)!==JSON.stringify(b)){console.log('ROT – '+t+': erwartet '+JSON.stringify(b)+', bekommen '+JSON.stringify(a));process.exit(1)}console.log('ok    '+t)};
function welt(){const blaetter={};const SP=['id','quelle','code','gast','haus','wg','anreise','abreise','gaeste','status','unterkunft','geaendert','admin','pruefen','frueh','spaet','notiz'];
  const zeile=o=>SP.map(k=>o[k]==null?'':String(o[k]));
  blaetter.Buchungen=[SP,zeile({id:'ab-HMK2XJHKD2',quelle:'airbnb',code:'HMK2XJHKD2',gast:'Andreas Schlifski',haus:'poether',wg:3,anreise:'2026-11-14',abreise:'2026-11-15',gaeste:5,status:'bestaetigt'}),
    zeile({id:'bk-5368975807',quelle:'booking',code:'5368975807',gast:'B',haus:'kranz',wg:2,anreise:'2026-12-12',abreise:'2026-12-13',gaeste:2,status:'bestaetigt'}),
    zeile({id:'ab-HMBLEIBT01',quelle:'airbnb',code:'HMBLEIBT01',gast:'Bleibt',haus:'kranz',wg:1,anreise:'2026-11-14',abreise:'2026-11-15',gaeste:2,status:'bestaetigt'})];
  blaetter.Gesehen=[['m-storno-ab'],['m-storno-bk']];/* genau der Vorfall: Mails schon gesehen, Buchungen trotzdem aktiv */
  let schreibFehler=false;
  const sheet=name=>{const z=blaetter[name]||(blaetter[name]=[]);return{getDataRange:()=>({getDisplayValues:()=>z.map(r=>r.map(String))}),
    getRange:(a,c,n,m)=>typeof a==='string'?{getValues:()=>z.map(r=>[r[0]])}:{setNumberFormat(){return this},setValues(v){if(name==='Buchungen'&&schreibFehler)throw new Error('Sheets-Aussetzer');for(let i=0;i<n;i++)z[a-1+i]=v[i].slice()}},
    getLastRow:()=>z.length,getMaxRows:()=>z.length+100,insertRowsAfter(){},clearContents(){if(name==='Buchungen'&&schreibFehler)throw new Error('Sheets-Aussetzer');z.length=0}}};
  const msg=(id,von,betreff,text,datum)=>({getId:()=>id,getSubject:()=>betreff,getPlainBody:()=>text||'',getDate:()=>new Date(datum),getFrom:()=>von});
  const threads=[{von:'automated@airbnb.com',storno:true,m:[msg('m-storno-ab','automated@airbnb.com','Storniert: Buchung HMK2XJHKD2 im Zeitraum 14.–15. November','BUCHUNG STORNIERT','2026-11-09T09:40:34Z')]},
    {von:'noreply@booking.com',storno:true,m:[msg('m-storno-bk','noreply@booking.com','Booking.com - Eine Buchung wurde storniert! (5368975807, Samstag, 12. Dezember 2026)','','2026-11-08T19:17:43Z')]}];
  const ctx={console:{log(){},warn(){},error(){}},Utilities:{formatDate:()=>'2026-11-12'},SpreadsheetApp:{flush(){}},
    LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},
    GmailApp:{search:(q,start)=>start?[]:threads.filter(t=>q.includes(t.von)&&(!/newer_than:60d/.test(q)||t.storno)).map(t=>({getMessages:()=>t.m,getFirstMessageSubject:()=>t.m[0].getSubject()}))}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(gs,'utf8'),ctx);
  ctx.__s=sheet;vm.runInContext('blatt=n=>__s(n);oeffentlichSchreiben=()=>{};sofortMelden=()=>{};',ctx);
  return{ctx,blaetter,threads,msg,fehler:v=>{schreibFehler=v}}}
const status=(W,id)=>W.ctx.buchungenLesen().find(b=>b.id===id).status;

let W=welt();W.ctx.abgleich(3);
eq(status(W,'ab-HMK2XJHKD2'),'storniert','Airbnb-Storno greift, obwohl die Mail schon „gesehen“ war');
eq(status(W,'bk-5368975807'),'storniert','Booking-Storno greift ebenso');
eq(status(W,'ab-HMBLEIBT01'),'bestaetigt','andere Buchung bleibt unberührt');
/* neue Buchung für dieselbe Wohnung und dieselben Tage */
W.threads.push({von:'automated@airbnb.com',m:[W.msg('m-neu','automated@airbnb.com','Buchung bestätigt – Neu Gast kommt am 14. Nov. an',
  'BESTÄTIGUNGS-CODE\nHMNEU12345\nHelles Apartment für 4 Personen in ruhiger Lage\nCheck-in Check-out\n\nSa., 14. Nov. So., 15. Nov.\nGÄSTE\n\n2 Erwachsene','2026-11-12T08:00:00Z')]});
W.ctx.abgleich(3);
const plan=W.ctx.fuerPutzplan(W.ctx.buchungenLesen()).filter(b=>b.status!=='storniert'&&b.haus==='poether'&&+b.wg===3&&b.anreise==='2026-11-14').map(b=>b.code+' '+b.gaeste);
eq(plan,['HMNEU12345 2'],'Putzplan zeigt am 14.11. in Poetherweg WG 3 nur die neue Buchung');
eq(status(W,'ab-HMK2XJHKD2'),'storniert','der Storno bleibt auch beim nächsten Lauf');
/* Abbruch beim Schreiben: Mail darf nicht als gesehen gelten */
W=welt();W.blaetter.Gesehen.length=0;W.fehler(true);try{W.ctx.abgleich(3)}catch(e){}
eq(W.blaetter.Gesehen.map(r=>r[0]),[],'Schreiben bricht ab → keine Mail als gesehen gemerkt');
W.fehler(false);W.ctx.abgleich(3);eq(status(W,'ab-HMK2XJHKD2'),'storniert','nächster Lauf holt den Storno nach');
console.log('Storno-Prüfung: alles grün');
