/* Aufruf: node scripts/pruefe-ausweis.js dienst/Code.gs  – vor jedem Einfügen von Code.gs laufen lassen.
   Ausweis vor Anreise (Betreiber 16.11.2026, nur Booking): Booking bittet den Gast nach der Buchung um ein Ausweisfoto.
   Geprüft wird: (1) Antwort mit echtem Anhang → „ausweis“ eingetragen und GENAU EINE Bestätigung an den Gast;
   (2) Antwort nur mit Bookings eingebetteten Symbolen zählt NICHT als Ausweis, der Betreiber bekommt eine Mail;
   (3) 3 Tage vor Anreise ohne Ausweis → EINE Mail an den Betreiber mit Text zum Kopieren, beim nächsten Lauf keine zweite;
   (4) Buchungen vor dem Stichtag, Airbnb und stornierte Buchungen bleiben unberührt;
   (5) „Ausweis erhalten“ aus dem Admin löst die Bestätigung ebenfalls aus. */
const vm=require('vm'),fs=require('fs');const gs=process.argv[2];
const eq=(a,b,t)=>{if(JSON.stringify(a)!==JSON.stringify(b)){console.log('ROT – '+t+': erwartet '+JSON.stringify(b)+', bekommen '+JSON.stringify(a));process.exit(1)}console.log('ok    '+t)};
const SP=['id','quelle','code','gast','haus','wg','anreise','abreise','gaeste','status','unterkunft','geaendert','admin','pruefen','frueh','spaet','notiz','gebucht','ausweis','ausweisBest','ausweisErinnert'];
function welt(heute){const blaetter={Gesehen:[]};const zeile=o=>SP.map(k=>o[k]==null?'':String(o[k]));
  blaetter.Buchungen=[SP,
    zeile({id:'bk-1111111111',quelle:'booking',code:'1111111111',gast:'Muster Anna',haus:'kranz',wg:2,anreise:'2026-11-25',abreise:'2026-11-27',gaeste:2,status:'bestaetigt',unterkunft:'14590940'}),
    zeile({id:'bk-2222222222',quelle:'booking',code:'2222222222',gast:'Beispiel Ben',haus:'poether',wg:2,anreise:'2026-11-20',abreise:'2026-11-22',gaeste:1,status:'bestaetigt',unterkunft:'15816332'}),
    zeile({id:'bk-3333333333',quelle:'booking',code:'3333333333',gast:'Alt Otto',haus:'kranz',wg:1,anreise:'2026-11-19',abreise:'2026-11-20',gaeste:2,status:'bestaetigt'}),
    zeile({id:'ab-HMAIRBNB01',quelle:'airbnb',code:'HMAIRBNB01',gast:'Air Bea',haus:'kranz',wg:3,anreise:'2026-11-18',abreise:'2026-11-19',gaeste:2,status:'bestaetigt'})];
  const sheet=name=>{const z=blaetter[name]||(blaetter[name]=[]);return{getDataRange:()=>({getDisplayValues:()=>z.map(r=>r.map(String))}),
    getRange:(a,c,n,m)=>typeof a==='string'?{getValues:()=>z.map(r=>[r[0]])}:{setNumberFormat(){return this},setValues(v){for(let i=0;i<n;i++)z[a-1+i]=v[i].slice()}},
    getLastRow:()=>z.length,getMaxRows:()=>z.length+100,insertRowsAfter(){},clearContents(){z.length=0}}};
  const antworten=[],mails=[];let mid=0;
  const msg=(von,betreff,text,datum,anh)=>{const id='m'+(++mid);return{getId:()=>id,getSubject:()=>betreff,getPlainBody:()=>text,getDate:()=>new Date(datum),getFrom:()=>von,
    getAttachments:o=>(anh||[]).filter(a=>!(o&&o.includeInlineImages===false&&a.inline)).map(a=>({getContentType:()=>a.typ,getSize:()=>a.gr})),reply:t=>antworten.push({an:von,t})}};
  const threads=[
    {von:'noreply@booking.com',m:[msg('noreply@booking.com','Booking.com - Neue Buchung! (1111111111, Mittwoch, 25. November 2026)','', '2026-11-16T16:10:00Z')]},
    {von:'noreply@booking.com',m:[msg('noreply@booking.com','Booking.com - Neue Buchung! (2222222222, Freitag, 20. November 2026)','', '2026-11-16T16:20:00Z')]},
    {von:'noreply@booking.com',m:[msg('noreply@booking.com','Booking.com - Neue Buchung! (3333333333, Donnerstag, 19. November 2026)','', '2026-11-10T09:00:00Z')]}];
  const gast=(res,text,datum,anh)=>({von:'guest.booking.com',m:[msg(res+'-abcd.efgh@guest.booking.com','Wir haben diese Nachricht erhalten','Buchungsnummer: '+res+'\nNachricht von Gast:\n'+text+'\n\nAntworten\n',datum,anh)]});
  const ctx={console:{log(){},warn(){},error:e=>console.log('  (Dienst-Fehler) '+(e&&e.message||e))},Utilities:{formatDate:()=>heute},SpreadsheetApp:{flush(){}},
    LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},ContentService:{MimeType:{JSON:1},createTextOutput:t=>({setMimeType(){return t}})},MailApp:{sendEmail:o=>mails.push(o)},
    GmailApp:{search:(q,start)=>{if(start)return[];const code=(/"(\d{6,})"/.exec(q)||[])[1];
      return threads.filter(t=>q.includes(t.von)&&(!code||t.m.some(m=>m.getPlainBody().includes(code)))&&(!/newer_than:60d/.test(q)||/storn/i.test(t.m[0].getSubject())))
        .map(t=>({getMessages:()=>t.m,getFirstMessageSubject:()=>t.m[0].getSubject()}))}}};
  /* feste Uhr: abends am jeweiligen Tag, damit „12 Stunden nach der Buchung“ nicht von der echten Uhrzeit abhängt */
  const FIX=Date.parse(heute+'T20:00:00Z');ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:[FIX]))}static now(){return FIX}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(gs,'utf8'),ctx);ctx.__s=sheet;vm.runInContext('blatt=n=>__s(n);oeffentlichSchreiben=()=>{};sofortMelden=()=>{};',ctx);
  return{ctx,threads,gast,antworten,mails,b:id=>ctx.buchungenLesen().find(x=>x.id===id)}}

/* Tag 1 (16.11.): beide neuen Buchungen kommen, Anna schickt ihren Ausweis als Foto, Ben schreibt nur Text */
let W=welt('2026-11-16');
W.threads.push(W.gast('1111111111','Hier mein Ausweis','2026-11-16T17:00:00Z',[{typ:'image/png',gr:3000,inline:true},{typ:'image/jpeg',gr:850000}]));
W.threads.push(W.gast('2222222222','Kommen wir auch um 22 Uhr rein?','2026-11-16T17:05:00Z',[{typ:'image/png',gr:3000,inline:true},{typ:'image/png',gr:2800,inline:true}]));
W.ctx.abgleich(3);
eq([W.b('bk-1111111111').gebucht,W.b('bk-3333333333').gebucht],['2026-11-16T16:10:00.000Z','2026-11-10T09:00:00.000Z'],'Buchungszeit aus der Booking-Mail übernommen');
eq(W.b('bk-1111111111').ausweis,'2026-11-16','Foto als echter Anhang → Ausweis eingetragen');
eq(W.antworten.length,1,'genau eine Bestätigung verschickt');
eq([W.antworten[0].an,/Zugangsdaten bekommst du einen Tag vor deiner Anreise/.test(W.antworten[0].t),/access details one day before/.test(W.antworten[0].t),/^Hi Anna/.test(W.antworten[0].t)],
  ['1111111111-abcd.efgh@guest.booking.com',true,true,true],'Bestätigung über Booking an den Gast, Deutsch und Englisch, mit Vornamen');
eq(W.b('bk-2222222222').ausweis,'','nur eingebettete Booking-Symbole zählen nicht als Ausweis');
eq(W.mails.map(m=>m.subject),['Gast hat geschrieben, kein Ausweis-Anhang erkannt: Beispiel Ben'],'Betreiber bekommt Hinweis zur Antwort ohne Anhang');
eq(W.b('bk-3333333333').ausweis+W.b('ab-HMAIRBNB01').ausweis,'','alte Buchung und Airbnb unberührt');
W.ctx.abgleich(3);eq([W.antworten.length,W.mails.length],[1,1],'zweiter Lauf: keine doppelte Bestätigung, keine doppelte Mail');

/* Tag 2 (17.11.): Ben reist am 20.11. an = 3 Tage → Erinnerung an den Betreiber, einmal */
let roh=W.ctx.buchungenLesen();const W2=welt('2026-11-17');W2.ctx.buchungenSchreiben(roh);
W2.ctx.abgleich(3);
const er=W2.mails.filter(m=>/^Ausweis fehlt/.test(m.subject));
eq(er.map(m=>m.subject),['Ausweis fehlt: Beispiel Ben – Anreise 20.11.2026'],'3 Tage vor Anreise: Mail an den Betreiber');
eq([er[0].to,/Text zum Kopieren/.test(er[0].body),/Hi Ben/.test(er[0].body),/res_id=2222222222/.test(er[0].body),/Poetherweg 17 · WG 2/.test(er[0].body)],['sk@2reach.de',true,true,true,true],'Mail enthält Wohnung, Booking-Link und fertigen Text');
eq(W2.mails.some(m=>/Alt Otto|Air Bea/.test(m.subject)),false,'keine Erinnerung für alte Buchung oder Airbnb');
W2.ctx.abgleich(3);eq(W2.mails.length,1,'keine zweite Erinnerung');

/* Admin: Betreiber wählt „Ausweis erhalten“ → Bestätigung an Ben beim nächsten Lauf */
W2.threads.push(W2.gast('2222222222','Ausweis über die App geschickt','2026-11-17T10:00:00Z',[]));
W2.ctx.adminOk=()=>true;vm.runInContext('adminOk=()=>true',W2.ctx);
const r=JSON.parse(W2.ctx.doPost({postData:{contents:JSON.stringify({typ:'veroeffentlichen',aenderungen:[{id:'bk-2222222222',felder:{ausweis:'2026-11-17'}}]})}}));
eq([r.ok,W2.b('bk-2222222222').ausweis],[true,'2026-11-17'],'Admin trägt den Ausweis ein');
W2.ctx.abgleich(3);
eq(W2.antworten.map(a=>a.an),['2222222222-abcd.efgh@guest.booking.com'],'danach geht die Bestätigung automatisch an Ben');
W2.ctx.abgleich(3);eq(W2.antworten.length,1,'und nur einmal');
console.log('Ausweis-Prüfung: alles grün');
