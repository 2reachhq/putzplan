/* Putzplan-Dienst (Google Apps Script) – läuft im Google-Konto des Betreibers, ohne Laptop und ohne Kosten.

   Was er tut:
   1. abgleich()   alle 5 Minuten: Airbnb-/Booking-Mails aus Gmail lesen → Tabelle „Putzplan – Verwaltung“ (Blatt Buchungen)
                   → daraus die beiden öffentlichen Tabellen der Putzkräfte schreiben (Blätter „Daten“ und „Buchungen“).
   2. abendPush()  jeden Abend um 18 Uhr: Webseiten-Push an alle Handys, die ihn eingeschaltet haben – was morgen zu tun ist.
   3. doGet/doPost Web-App für die Seite: Push an-/abmelden, Text der Push-Meldung, Admin (Passwort) zum Nachtragen.

   Regeln beim Zusammenführen (wie in der Buchhaltungs-App): Was aus einer Mail kommt, füllt nur LEERE Felder – was der
   Admin eingetragen hat, überschreibt also keine Mail. Ein Storno aus einer Mail gilt immer.

   Geheimnisse (Admin-Passwort, Push-Schlüssel) stehen NICHT hier, sondern in den Skript-Eigenschaften; einrichten()
   erzeugt sie beim ersten Lauf und schreibt das Passwort in das Blatt „Info“ der Verwaltungstabelle. */

const VERWALTUNG_ID='1rHYlTl5vbv9ZsFAZBC4bky6yBFL8Io1nDAHfIl4kGKo';  /* privat, nicht freigegeben */
const SEITE='https://2reachhq.github.io/putzplan/';
const HAEUSER={
  kranz:{name:'Kranzstraße 9',sheet:'1k_4TzOfGS49kSW_JPaBVSi54gXF0AcBKTKUO7BsuHaY',sprache:'en',wgs:[1,2,3,4],
    namen:{1:'Ruhig wohnen',2:'Paare & Solo',3:'Familien-Apartment',4:'Zentral & ruhig'}},
  poether:{name:'Poetherweg 17',sheet:'14KCihsNIC4N9zCvWClex8pt1Mg_4UOe82-jApcvtwkk',sprache:'ta',wgs:[1,2,3],
    namen:{1:'4 Gäste, ruhige Lage',2:'Komfort für 2',3:'Helles Apartment'}}};
/* Inserat (Booking-Unterkunftsnummer oder Airbnb-Titel) → Haus und Wohnung */
const INSERATE={
  '14582644':['kranz',1],'14590940':['kranz',2],'14582724':['kranz',3],'15871235':['kranz',4],
  '15816308':['poether',1],'15816332':['poether',2],'15369873':['poether',3],
  'Ruhig wohnen mitten in der Stadt – 8 Min zum Hbf':['kranz',1],'8 Min zu fuß zum Hbf - Für Paare / Solo-Reisende':['kranz',2],
  'City-Apartment für Familien 5 Per, 8 Min zum Hbf!':['kranz',3],'Zentrales & ruhiges Apartment in Mönchengladbach':['kranz',4],
  '5 Min zur City | 4 Gäste | Ruhige Lage':['poether',1],'5 Min City | Zentral & Ruhig | Komfort für 2 Pers.':['poether',2],
  'Helles Apartment für 4 Personen in ruhiger Lage':['poether',3]};
const SPALTEN=['id','quelle','code','gast','haus','wg','anreise','abreise','gaeste','status','unterkunft','geaendert','admin'];

const T={
  en:{wt:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],anz:n=>n?(n===1?'1 guest':n+' guests'):'? guests',
    keinCheckin:'no bookings right now',nichtsZuTun:'nothing to do',farbe:{blau:'blue',gelb:'yellow',grau:'grey'},
    raus:f=>'Bins: '+f+' bin OUT (pickup tomorrow)',rein:f=>'Bins: '+f+' bin back IN',stand:'Updated ',rot:' · red = please ask',
    morgen:'Tomorrow',putzen:'clean',titel:'Cleaning Plan'},
  ta:{wt:['ஞாயிறு','திங்கள்','செவ்வாய்','புதன்','வியாழன்','வெள்ளி','சனி'],anz:n=>(n||'?')+' பேர்',
    keinCheckin:'இப்போது booking இல்லை',nichtsZuTun:'வேலை இல்லை',farbe:{blau:'நீல',gelb:'மஞ்சள்',grau:'சாம்பல்'},
    raus:f=>f+' குப்பைத் தொட்டியை வெளியே வைக்கவும் (நாளை எடுப்பார்கள்)',rein:f=>f+' குப்பைத் தொட்டியை உள்ளே கொண்டு வரவும்',
    stand:'Stand ',rot:' · rot = bitte nachfragen',morgen:'நாளை',putzen:'சுத்தம் செய்யவும்',titel:'Putzplan'}};

/* ---------- Datum (immer deutsche Zeit, nie die des Servers) ---------- */
const heuteIso=()=>Utilities.formatDate(new Date(),'Europe/Berlin','yyyy-MM-dd');
const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const naechte=(a,b)=>a&&b?Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5):null;
const serial=d=>Math.round((Date.parse(d+'T12:00:00Z')-Date.UTC(1899,11,30,12))/864e5);
const MON={jan:1,feb:2,'mär':3,mae:3,mar:3,apr:4,mai:5,may:5,jun:6,jul:7,aug:8,sep:9,okt:10,oct:10,nov:11,dez:12,dec:12};
const datumText=s=>{const m=/(\d{1,2})\.?\s+([A-Za-zÄäö]+)\.?,?\s+(\d{4})/.exec(String(s||''));if(!m)return'';const mo=MON[m[2].toLowerCase().slice(0,3)];
  return mo?m[3]+'-'+String(mo).padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
function tagOhneJahr(s,ref){const m=/(\d{1,2})\.\s*([A-Za-zÄäö]{3})/.exec(String(s||''));if(!m)return'';const mo=MON[m[2].toLowerCase()];if(!mo)return'';
  const r=new Date(ref||Date.now());let y=r.getUTCFullYear();const iso=j=>j+'-'+String(mo).padStart(2,'0')+'-'+m[1].padStart(2,'0');
  if(iso(y)<new Date(r.getTime()-2*864e5).toISOString().slice(0,10))y++;return iso(y)}
function zuordnen(x){const s=String(x||'').trim();if(!s)return null;if(INSERATE[s])return INSERATE[s];const S2=s.toUpperCase();
  for(const k in INSERATE)if(k.toUpperCase()===S2)return INSERATE[k];for(const k in INSERATE)if(k.length>8&&S2.includes(k.toUpperCase()))return INSERATE[k];return null}

/* ---------- Mails lesen (gleiche Leser wie in der Buchhaltungs-App) ---------- */
function leseAirbnb(m){const s=String(m.subject||''),t=String(m.text||'').replace(/\r/g,'');
  const st=/^Storniert: Buchung ([A-Z0-9]{8,})/.exec(s);if(st)return{id:'ab-'+st[1],quelle:'airbnb',code:st[1],status:'storniert'};
  if(!/Buchung bestätigt/i.test(s))return null;const code=(/BESTÄTIGUNGS-CODE\s*\n\s*([A-Z0-9]{8,})/.exec(t)||/details\/([A-Z0-9]{8,})/.exec(t)||[])[1];if(!code)return null;
  const gast=((/Buchung bestätigt\s*[–-]\s*(.+?)\s+kommt am/i.exec(s)||[])[1]||'').trim();const ref=m.datum||Date.now();
  const ci=/Check-in\s+Check-out\s*\n+\s*([^\n]+)/.exec(t);const tage=ci?[...ci[1].matchAll(/\d{1,2}\.\s*[A-Za-zÄäö]{3}/g)].map(x=>tagOhneJahr(x[0],ref)):[];
  let an=tage[0]||'',ab=tage[1]||'';if(an&&ab&&ab<=an)ab=(+ab.slice(0,4)+1)+ab.slice(4);
  const gz=/GÄSTE\s*\n+\s*([^\n]+)/.exec(t);const gText=gz?gz[1].trim():'';const gaeste=gText?(gText.match(/\d+/g)||[]).reduce((a,b)=>a+ +b,0)||null:null;
  const T2=t.toUpperCase();let unterkunft='';for(const k in INSERATE)if(isNaN(+k)&&T2.includes(k.toUpperCase())){unterkunft=k;break}
  return{id:'ab-'+code,quelle:'airbnb',code,gast,anreise:an,abreise:ab,gaeste,unterkunft,status:'bestaetigt'}}
function leseBooking(m){const s=String(m.subject||'');const x=/\((\d{6,}),\s*[A-Za-zÄäöüß]+,\s*(\d{1,2}\.\s*[A-Za-zÄäöü]+\s+\d{4})\)/.exec(s);if(!x)return null;
  const id='bk-'+x[1],an=datumText(x[2]);if(/storniert/i.test(s))return{id,quelle:'booking',code:x[1],anreise:an,status:'storniert'};
  if(!/neue (?:Last-Minute-)?Buchung|Last-Minute-Buchung|geändert|Änderung/i.test(s))return null;
  const flach=String(m.text||'').replace(/\s+/g,'');const hotel=(/hotel_id=(\d+)/.exec(flach)||[])[1]||'';
  return{id,quelle:'booking',code:x[1],anreise:an,unterkunft:hotel,status:'bestaetigt'}}
function leseBookingNachricht(m){const t=String(m.text||'').replace(/\r/g,'');const flach=t.replace(/\s+/g,'');
  const feld=l=>{const x=new RegExp(l+':\\s*\\n\\s*(.+)').exec(t);return x?x[1].trim():''};
  const res=(/Buchungsnummer:\s*(\d{6,})/.exec(t)||[])[1]||(/^(\d{6,})-/.exec(String(m.von||'').replace(/^.*</,''))||[])[1];if(!res)return null;
  const an=datumText(feld('Check-in')),ab=datumText(feld('Check-out'));
  return{id:'bk-'+res,quelle:'booking',code:res,gast:feld('Name des Gastes'),anreise:an,abreise:ab,gaeste:+feld('Gesamtzahl der Gäste')||null,
    unterkunft:(/hotel_id=(\d+)/.exec(flach)||[])[1]||feld('Unterkunftsname')}}

/* ---------- Verwaltungstabelle ---------- */
const KOEPFE={Abos:['endpoint','haus','seit'],Muell:['haus','datum','art']};
function blatt(name){const ss=SpreadsheetApp.openById(VERWALTUNG_ID);let sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);if(KOEPFE[name])sh.getRange(1,1,1,KOEPFE[name].length).setValues([KOEPFE[name]])}return sh}
function buchungenLesen(){const sh=blatt('Buchungen');const v=sh.getDataRange().getDisplayValues();const L=[];
  for(let i=1;i<v.length;i++){if(!v[i][0])continue;const b={};SPALTEN.forEach((k,j)=>b[k]=v[i][j]||'');b.wg=b.wg?+b.wg:'';b.gaeste=b.gaeste?+b.gaeste:'';L.push(b)}return L}
function buchungenSchreiben(L){const sh=blatt('Buchungen');L.sort((a,b)=>(a.anreise||'').localeCompare(b.anreise||'')||a.id.localeCompare(b.id));
  const werte=[SPALTEN,...L.map(b=>SPALTEN.map(k=>b[k]==null?'':String(b[k])))];sh.clearContents();
  sh.getRange(1,1,Math.max(werte.length,1),SPALTEN.length).setNumberFormat('@').setValues(werte)}
/* Mail-Daten in eine Buchung: nur leere Felder füllen, Storno gilt immer */
function zusammen(L,x){let b=L.find(o=>o.id===x.id);const neu=!b;if(neu){b={id:x.id};SPALTEN.forEach(k=>{if(b[k]==null)b[k]=''});L.push(b)}let w=neu;
  for(const k in x){const v=x[k];if(k==='id'||v==null||v==='')continue;
    if(k==='status'){if(v==='storniert'&&b.status!=='storniert'){b.status='storniert';w=true}else if(!b.status){b.status=v;w=true}continue}
    if(SPALTEN.includes(k)&&(b[k]==null||b[k]==='')){b[k]=v;w=true}}
  if(!b.haus||!b.wg){const z=zuordnen(b.unterkunft);if(z){if(!b.haus){b.haus=z[0];w=true}if(!b.wg){b.wg=z[1];w=true}}}
  if(w)b.geaendert=new Date().toISOString();return w}

/* ---------- 1. Abgleich mit Gmail ---------- */
function abgleich(tage){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return;
  try{const sh=blatt('Gesehen');const gesehen=new Set(sh.getRange('A:A').getValues().map(r=>String(r[0])).filter(Boolean));const neuGesehen=[];
    const L=buchungenLesen();let n=0;const t=tage||3;
    const Q=[['ab','from:automated@airbnb.com (subject:"Buchung bestätigt" OR subject:"Storniert: Buchung") newer_than:'+t+'d'],
      ['bk','from:noreply@booking.com (subject:"neue Buchung" OR subject:"Last-Minute-Buchung" OR subject:storniert OR subject:geändert) newer_than:'+t+'d'],
      ['bn','from:guest.booking.com newer_than:'+t+'d']];
    for(const[art,q]of Q){for(let start=0;start<500;start+=100){const th=GmailApp.search(q,start,100);
      for(const thr of th)for(const msg of thr.getMessages()){const id=msg.getId();if(gesehen.has(id))continue;gesehen.add(id);neuGesehen.push([id]);
        const m={subject:msg.getSubject(),text:msg.getPlainBody(),datum:msg.getDate().getTime(),von:msg.getFrom()};let x=null;
        try{x=art==='ab'?leseAirbnb(m):art==='bk'?leseBooking(m):leseBookingNachricht(m)}catch(e){console.error(e)}
        if(x&&zusammen(L,x))n++}
      if(th.length<100)break}}
    if(neuGesehen.length){const ab=sh.getLastRow()+1;const fehlt=ab+neuGesehen.length-1-sh.getMaxRows();if(fehlt>0)sh.insertRowsAfter(sh.getMaxRows(),fehlt+100);
      sh.getRange(ab,1,neuGesehen.length,1).setNumberFormat('@').setValues(neuGesehen)}
    if(n)buchungenSchreiben(L);
    oeffentlichSchreiben(L)}
  finally{lock.releaseLock()}}

/* ---------- Öffentliche Tabellen der Putzkräfte (ohne Namen) ---------- */
function muellLesen(){const v=blatt('Muell').getDataRange().getDisplayValues();const M={};for(let i=1;i<v.length;i++){const[h,d,a]=v[i];if(h&&d&&a)(M[h]=M[h]||[]).push({datum:d,art:a})}return M}
function oeffentlichSchreiben(L){const heute=heuteIso();const von=plus(heute,-14);const ende=[heute.slice(0,4)+'-12-31',plus(heute,45)].sort().pop();
  const tage=naechte(von,ende)+1;const M=muellLesen();const P=PropertiesService.getScriptProperties();
  const jetzt=Utilities.formatDate(new Date(),'Europe/Berlin','dd.MM., HH:mm');
  for(const hk in HAEUSER){const H=HAEUSER[hk];const S=T[H.sprache];const aktiv=L.filter(b=>b.haus===hk&&b.status!=='storniert'&&b.anreise);
    const ton=d=>(M[hk]||[]).filter(x=>x.datum===d).map(x=>x.art);
    const R=[];
    for(let i=0;i<tage;i++){const d=plus(von,i);R.push([serial(d),'tag',S.wt[new Date(d+'T12:00:00Z').getUTCDay()]+' '+d.slice(8)+'.'+d.slice(5,7)+'.','']);
      const an=aktiv.filter(b=>b.anreise===d).sort((a,b)=>(+a.wg||99)-(+b.wg||99));let z=0;
      for(const b of an){const fehlt=(!b.gaeste||!b.abreise)&&d>=heute;const putzen=aktiv.some(x=>x!==b&&x.wg===b.wg&&x.abreise===d);
        if(!putzen&&!fehlt&&+b.gaeste===2)continue;
        R.push([serial(d),fehlt?'fehlt':b.gaeste&&+b.gaeste!==2?'anders':'aufgabe','WG '+(b.wg||'?')+' - '+S.anz(+b.gaeste||null)+' (Out-'+(b.abreise?b.abreise.slice(8)+'.'+b.abreise.slice(5,7):'?')+')','']);z++}
      for(const a of ton(plus(d,1)))if(S.farbe[a]){R.push([serial(d),a,S.raus(S.farbe[a]),'']);z++}
      for(const a of ton(d))if(S.farbe[a]){R.push([serial(d),a,S.rein(S.farbe[a]),'']);z++}
      if(!z)R.push([serial(d),'leer',an.length?S.nichtsZuTun:S.keinCheckin,''])}
    const B=[['WG','Anreise','Abreise','Gaeste','Fehlt'],...H.wgs.map(w=>[w,'','','','']),
      ...aktiv.filter(b=>b.wg&&(b.abreise||b.anreise)>=von&&b.anreise<=ende).map(b=>[+b.wg,serial(b.anreise),b.abreise?serial(b.abreise):'',b.gaeste?+b.gaeste:'',(!b.gaeste||!b.abreise)&&(b.abreise||b.anreise)>=heute?1:0])];
    const ss=SpreadsheetApp.openById(H.sheet);const hash=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,JSON.stringify([R,B]),Utilities.Charset.UTF_8));
    if(P.getProperty('hash_'+hk)!==hash){
      const dSh=ss.getSheetByName('Daten');dSh.getRange('A2:C3000').clearContent();dSh.getRange(1,1,1,3).setValues([['Datum','Art','Text']]);
      dSh.getRange(2,1,R.length,3).setValues(R.map(r=>r.slice(0,3)));
      const bSh=ss.getSheetByName('Buchungen');bSh.getRange('A1:E600').clearContent();bSh.getRange(1,1,B.length,5).setValues(B);
      P.setProperty('hash_'+hk,hash)}
    ss.getSheetByName('Daten').getRange('D1').setValue(S.stand+jetzt+S.rot)}}

/* ---------- Was ist an einem Tag zu tun (Push-Meldung) ---------- */
function aufgaben(hk,d,L){const S=T[HAEUSER[hk].sprache];const M=muellLesen()[hk]||[];
  const aktiv=(L||buchungenLesen()).filter(b=>b.haus===hk&&b.status!=='storniert');
  const wgs=[...new Set(aktiv.filter(b=>b.abreise===d&&b.wg).map(b=>+b.wg))].sort((a,b)=>a-b);
  const zeilen=wgs.map(w=>'WG '+w+' – '+S.putzen);
  M.filter(x=>x.datum===plus(d,1)&&S.farbe[x.art]).forEach(x=>zeilen.push(S.raus(S.farbe[x.art])));
  M.filter(x=>x.datum===d&&S.farbe[x.art]).forEach(x=>zeilen.push(S.rein(S.farbe[x.art])));
  return zeilen}
function meldung(hk){const H=HAEUSER[hk];const S=T[H.sprache];const m=plus(heuteIso(),1);const z=aufgaben(hk,m);
  return{title:S.morgen+' · '+S.wt[new Date(m+'T12:00:00Z').getUTCDay()]+' '+m.slice(8)+'.'+m.slice(5,7)+'. · '+H.name,body:z.length?z.join('\n'):S.nichtsZuTun,url:SEITE+hk+'/',leer:!z.length}}

/* ---------- 2. Webseiten-Push (VAPID, ohne Inhalt: die Seite holt den Text selbst über doGet) ---------- */
function abendPush(){const L=buchungenLesen();const sh=blatt('Abos');const v=sh.getDataRange().getValues();const weg=[];
  const jwts={};const P=PropertiesService.getScriptProperties();const d=b64d(P.getProperty('VAPID_D'));const pub=P.getProperty('VAPID_PUB');
  for(const hk in HAEUSER){if(!aufgaben(hk,plus(heuteIso(),1),L).length)continue;
    for(let i=1;i<v.length;i++){const[endpoint,haus]=v[i];if(haus!==hk||!endpoint)continue;
      const aud=String(endpoint).match(/^https:\/\/[^/]+/)[0];const jwt=jwts[aud]||(jwts[aud]=vapidJwt(aud,d));
      const r=UrlFetchApp.fetch(endpoint,{method:'post',headers:{TTL:'43200',Urgency:'normal',Authorization:'vapid t='+jwt+', k='+pub},muteHttpExceptions:true});
      const c=r.getResponseCode();if(c===404||c===410)weg.push(i+1);else if(c>=300)console.warn('Push '+c+' '+r.getContentText().slice(0,200))}}
  weg.reverse().forEach(z=>sh.deleteRow(z))}

/* ---------- 3. Web-App ---------- */
const json=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
function doGet(e){const p=(e&&e.parameter)||{};
  if(p.typ==='vapid')return json({key:PropertiesService.getScriptProperties().getProperty('VAPID_PUB')});
  if(p.typ==='meldung'&&HAEUSER[p.haus])return json(meldung(p.haus));
  return json({ok:true})}
function doPost(e){let x={};try{x=JSON.parse(e.postData.contents)}catch(err){return json({fehler:'format'})}
  if(x.typ==='abo'){if(!HAEUSER[x.haus]||!x.sub||!/^https:\/\//.test(x.sub.endpoint||''))return json({fehler:'abo'});
    const sh=blatt('Abos');const v=sh.getDataRange().getValues();if(!v.some(r=>r[0]===x.sub.endpoint))sh.appendRow([x.sub.endpoint,x.haus,new Date().toISOString()]);return json({ok:true})}
  if(x.typ==='abmelden'){const sh=blatt('Abos');const v=sh.getDataRange().getValues();for(let i=v.length-1;i>=1;i--)if(v[i][0]===x.endpoint)sh.deleteRow(i+1);return json({ok:true})}
  if(!adminOk(x.pw))return json({fehler:'passwort'});
  if(x.typ==='login')return json({ok:true});
  if(x.typ==='liste'){const ab=plus(heuteIso(),-14);return json({ok:true,heute:heuteIso(),haeuser:Object.keys(HAEUSER).map(k=>({id:k,name:HAEUSER[k].name,wgs:HAEUSER[k].wgs,namen:HAEUSER[k].namen})),
    buchungen:buchungenLesen().filter(b=>b.status!=='storniert'&&(b.abreise||b.anreise)>=ab)})}
  /* Veröffentlichen: alle Änderungen der Admin-Seite auf einmal – danach EINMAL die Tabellen neu schreiben.
     Jede Änderung: {id, felder}; eine neue Buchung kommt mit id 'neu…'. */
  if(x.typ==='veroeffentlichen'){const lock=LockService.getScriptLock();lock.waitLock(20000);
    try{const L=buchungenLesen();const fertig=[];const jetzt=new Date().toISOString();
      for(const a of x.aenderungen||[]){let b=/^neu/.test(a.id||'')?null:L.find(o=>o.id===a.id);
        if(!b){if(!/^neu/.test(a.id||''))continue;b={id:'man-'+Date.now()+'-'+fertig.length,quelle:'direkt',status:'bestaetigt'};SPALTEN.forEach(k=>{if(b[k]==null)b[k]=''});L.push(b)}
        const f=a.felder||{};for(const k of['haus','wg','anreise','abreise','gaeste','status','gast'])if(k in f){let v=f[k];
          if(k==='haus'&&!HAEUSER[v])continue;if((k==='anreise'||k==='abreise')&&v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))continue;
          if(k==='wg'||k==='gaeste')v=v===''||v==null?'':Math.max(0,Math.min(40,parseInt(v,10)||0))||'';if(k==='status'&&v!=='storniert')v='bestaetigt';
          if(k==='gast')v=String(v||'').slice(0,80);b[k]=v}
        b.admin=jetzt;b.geaendert=jetzt;fertig.push({vorher:a.id,buchung:b})}
      buchungenSchreiben(L);oeffentlichSchreiben(L);return json({ok:true,fertig})}
    finally{lock.releaseLock()}}
  if(x.typ==='abgleich'){abgleich(7);return json({ok:true})}
  return json({fehler:'typ'})}
function adminOk(pw){const c=CacheService.getScriptCache();const f=+(c.get('fehlversuche')||0);if(f>=10)return false;
  const soll=PropertiesService.getScriptProperties().getProperty('ADMIN_PW')||'';const ist=String(pw||'');
  let d=soll.length^ist.length;for(let i=0;i<soll.length;i++)d|=soll.charCodeAt(i)^(ist.charCodeAt(i)||0);
  if(d!==0||!soll){c.put('fehlversuche',String(f+1),600);return false}return true}

/* ---------- Einmal ausführen: Schlüssel, Passwort, Zeitpläne, erster großer Abgleich ---------- */
function einrichten(){const P=PropertiesService.getScriptProperties();
  if(!P.getProperty('VAPID_D')){const k=vapidSchluessel();P.setProperty('VAPID_D',k.d);P.setProperty('VAPID_PUB',k.pub)}
  if(!P.getProperty('ADMIN_PW')){const a='abcdefghjkmnpqrstuvwxyz23456789';const h=sha256(bytes(Utilities.getUuid()+Utilities.getUuid()+Date.now()));
    P.setProperty('ADMIN_PW',h.slice(0,10).map(x=>a[x%a.length]).join(''))}
  const info=blatt('Info');info.clear();info.getRange(1,1,3,2).setValues([['Admin-Passwort',P.getProperty('ADMIN_PW')],['Push-Schlüssel (öffentlich)',P.getProperty('VAPID_PUB')],['Eingerichtet',new Date().toISOString()]]);
  ScriptApp.getProjectTriggers().forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('abgleich').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('abendPush').timeBased().atHour(18).everyDays(1).inTimezone('Europe/Berlin').create();
  abgleich(150);console.log('Fertig. Admin-Passwort steht im Blatt „Info“ der Verwaltungstabelle.')}

/* ---------- P-256 / ES256 für VAPID – reines JavaScript, weil Apps Script keine Kurven-Signatur kennt ----------
   Nonce nach RFC 6979 (deterministisch), damit keine schwache Zufallsquelle den Schlüssel verrät. */
const EC={p:BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),n:BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  b:BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b'),
  G:[BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')]};
const md=(a,m)=>{const r=a%m;return r<0n?r+m:r};
function minv(a,m){let[o,r]=[md(a,m),m],[s,t]=[1n,0n];while(r){const q=o/r;[o,r]=[r,o-q*r];[s,t]=[t,s-q*t]}return md(s,m)}
function padd(P,Q){if(!P)return Q;if(!Q)return P;const p=EC.p;let l;
  if(P[0]===Q[0]){if(md(P[1]+Q[1],p)===0n)return null;l=md((3n*P[0]*P[0]-3n)*minv(2n*P[1],p),p)}else l=md((Q[1]-P[1])*minv(Q[0]-P[0],p),p);
  const x=md(l*l-P[0]-Q[0],p);return[x,md(l*(P[0]-x)-P[1],p)]}
function pmul(k,P){let R=null,A=P;while(k>0n){if(k&1n)R=padd(R,A);A=padd(A,A);k>>=1n}return R}
const u8=a=>a.map(x=>x&255);
const bytes=s=>u8(Utilities.newBlob(s).getBytes());
const sha256=b=>u8(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b));
const hmac=(k,m)=>u8(Utilities.computeHmacSha256Signature(m,k));
const zuZahl=b=>BigInt('0x'+(b.map(x=>x.toString(16).padStart(2,'0')).join('')||'0'));
const zuBytes=(z,n)=>{const h=z.toString(16).padStart(n*2,'0');const r=[];for(let i=0;i<n*2;i+=2)r.push(parseInt(h.substr(i,2),16));return r};
const b64e=b=>Utilities.base64EncodeWebSafe(b.map(x=>x>127?x-256:x)).replace(/=+$/,'');
const b64d=s=>u8(Utilities.base64DecodeWebSafe(s+'==='.slice((s.length+3)%4)));
function signieren(nachricht,d){const h=sha256(nachricht);const e=md(zuZahl(h),EC.n);const x=zuBytes(d,32),hb=zuBytes(e,32);
  let V=new Array(32).fill(1),K=new Array(32).fill(0);K=hmac(K,[...V,0,...x,...hb]);V=hmac(K,V);K=hmac(K,[...V,1,...x,...hb]);V=hmac(K,V);
  for(;;){V=hmac(K,V);const k=zuZahl(V);if(k>0n&&k<EC.n){const R=pmul(k,EC.G);const r=md(R[0],EC.n);if(r!==0n){const s=md(minv(k,EC.n)*(e+r*d),EC.n);if(s!==0n)return[...zuBytes(r,32),...zuBytes(s,32)]}}
    K=hmac(K,[...V,0]);V=hmac(K,V)}}
function vapidSchluessel(){const h=sha256(bytes(Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid()+Date.now()));
  const d=md(zuZahl(h),EC.n-1n)+1n;const Q=pmul(d,EC.G);return{d:b64e(zuBytes(d,32)),pub:b64e([4,...zuBytes(Q[0],32),...zuBytes(Q[1],32)])}}
function vapidJwt(aud,dBytes){const kopf=b64e(bytes(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const inhalt=b64e(bytes(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+12*3600,sub:SEITE})));
  return kopf+'.'+inhalt+'.'+b64e(signieren(bytes(kopf+'.'+inhalt),zuZahl(dBytes)))}
