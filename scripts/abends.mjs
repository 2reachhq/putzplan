/* Abend-Vorschau für die Putzkräfte über die ntfy-App: liest dieselben Blätter wie die Seite („Daten“ und „Buchungen“)
   und schickt je Haus eine kurze Meldung, was MORGEN zu tun ist – welche Wohnung zu putzen ist (dort reisen Gäste ab)
   und welche Tonne raus/rein muss. Gibt es morgen nichts zu tun, geht keine Meldung hinaus.
   Aufruf: node scripts/abends.mjs            (schickt)
           node scripts/abends.mjs --probe    (zeigt nur, was geschickt würde) */
const HAEUSER=[
  {name:'Kranzstraße 9',sheet:'1k_4TzOfGS49kSW_JPaBVSi54gXF0AcBKTKUO7BsuHaY',topic:'putzplan-kranz-if5szbq3um',seite:'https://2reachhq.github.io/putzplan/kranz/',
   morgen:'Tomorrow',putzen:'clean'},
  {name:'Poetherweg 17',sheet:'14KCihsNIC4N9zCvWClex8pt1Mg_4UOe82-jApcvtwkk',topic:'putzplan-poether-sxk8del84u',seite:'https://2reachhq.github.io/putzplan/poether/',
   morgen:'நாளை',putzen:'சுத்தம் செய்யவும்'}];
const TONNE=new Set(['blau','gelb','grau','tonne']);
const probe=process.argv.includes('--probe');

/* Datum in Deutschland (nicht UTC des Servers) als Tageszahl wie in der Tabelle */
function heuteZahl(){const t=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const [y,m,d]=t.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5)}

async function blatt(sheet,name){const r=await fetch('https://docs.google.com/spreadsheets/d/'+sheet+'/gviz/tq?sheet='+name+'&headers=1&tqx=out:json&_='+Date.now());
  if(!r.ok)throw new Error(name+': HTTP '+r.status);const t=await r.text();const a=t.indexOf('setResponse(');const e=t.lastIndexOf(')');
  if(a<0||e<a)throw new Error(name+': keine Daten (Tabelle freigegeben?)');const j=JSON.parse(t.slice(a+12,e));if(!j.table)throw new Error(name+': '+JSON.stringify(j.errors||j.status));
  return (j.table.rows||[]).map(x=>(x.c||[]).map(c=>c&&c.v!=null?c.v:null))}

const morgen=heuteZahl()+1;let fehler=0;
for(const h of HAEUSER){
  try{const daten=await blatt(h.sheet,'Daten');const buch=await blatt(h.sheet,'Buchungen');
    const tag=(daten.find(z=>+z[0]===morgen&&z[1]==='tag')||[])[2]||'';
    const putz=[...new Set(buch.filter(b=>b[0]!=null&&+b[2]===morgen).map(b=>b[0]))].sort((a,b)=>String(a).localeCompare(String(b),'de',{numeric:true}));
    const tonnen=daten.filter(z=>+z[0]===morgen&&TONNE.has(z[1])).map(z=>z[2]);
    const zeilen=[...putz.map(wg=>'WG '+wg+' – '+h.putzen),...tonnen];
    if(!zeilen.length){console.log(h.name+': morgen nichts zu tun – keine Meldung');continue}
    const msg={topic:h.topic,title:h.morgen+' · '+tag+' · '+h.name,message:zeilen.join('\n'),click:h.seite,tags:['house']};
    console.log(JSON.stringify(msg));
    if(!probe){const r=await fetch('https://ntfy.sh/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(msg)});
      if(!r.ok)throw new Error('ntfy: HTTP '+r.status+' '+await r.text())}}
  catch(e){fehler++;console.error(h.name+': '+e.message)}}
if(fehler)process.exit(1);
