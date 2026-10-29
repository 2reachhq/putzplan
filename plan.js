/* Putzplan – Kalender wie in der Verwaltungs-App: links die Wohnungen (nur Nummern), rechts die Tage zum Seitwärts-Scrollen,
   jede Buchung ein Balken mit der Gästezahl. Fehlen Angaben, ist der Balken rot. Darunter, welche Wohnung am gewählten Tag zu putzen ist.
   Liest zwei ausgeblendete Blätter der Google-Tabelle:
   „Buchungen“ (A Wohnung, B Anreise, C Abreise als Tageszahl, D Gäste, E fehlt) und
   „Daten“ (A Datum, B Art, C Text, D1 Stand). Lädt beim Öffnen, alle 5 Minuten und beim Zurückkehren zur Seite neu. */
(function(){
  const C=window.PLAN;const el=id=>document.getElementById(id);const W=44;
  const tagZahl=d=>Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/864e5);
  const ausZahl=z=>new Date(Date.UTC(1899,11,30)+z*864e5);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const HAUS='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>';
  const TONNE='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>';
  const PERSON='<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/></svg>';
  let nr=0,laeuft=false,gewaehlt=null,gezeigtFuer=0,daten=null,buch=null;
  try{history.scrollRestoration='manual'}catch(e){}

  function holen(blatt){return new Promise((ok,nein)=>{const cb='planCb'+(++nr);const s=document.createElement('script');
    const t=setTimeout(()=>{weg();nein(new Error('Zeit'))},15000);
    function weg(){clearTimeout(t);delete window[cb];s.remove()}
    window[cb]=r=>{weg();ok(r)};s.onerror=()=>{weg();nein(new Error('Netz'))};
    s.src='https://docs.google.com/spreadsheets/d/'+C.sheet+'/gviz/tq?sheet='+blatt+'&headers=1&tqx=out:json;responseHandler:'+cb+'&_='+Date.now();
    document.head.appendChild(s)})}
  const wert=(x,i)=>x.c&&x.c[i]&&x.c[i].v!=null?x.c[i].v:null;

  async function laden(){if(laeuft)return;laeuft=true;
    try{const [d,b]=await Promise.all([holen('Daten'),holen('Buchungen').catch(()=>null)]);
      if(!d||!d.table)throw new Error('leer');
      el('stand').textContent=((d.table.cols||[])[3]||{}).label||'';
      daten=(d.table.rows||[]).map(x=>({d:+wert(x,0),art:wert(x,1),text:wert(x,2)})).filter(z=>z.d&&z.text);
      buch=b&&b.table?(b.table.rows||[]).map(x=>({wg:wert(x,0),an:wert(x,1),ab:wert(x,2),g:wert(x,3),fehlt:+wert(x,4)===1})).filter(z=>z.wg!=null):[];
      zeigen()}
    catch(e){if(!daten)el('inhalt').innerHTML='<div class="hinweis">'+esc(C.t.fehler)+'</div>'}
    finally{laeuft=false}}

  function zeigen(){const heute=tagZahl(new Date());
    const tage=[...new Set(daten.filter(z=>z.art==='tag').map(z=>z.d))].sort((a,b)=>a-b);
    if(!tage.length){el('inhalt').innerHTML='<div class="hinweis">'+esc(C.t.leer)+'</div>';return}
    const von=tage[0],bis=tage[tage.length-1],N=bis-von+1;
    if(gewaehlt==null||gewaehlt<von||gewaehlt>bis||gezeigtFuer!==heute)gewaehlt=Math.min(Math.max(heute,von),bis);
    const wgs=[];for(const z of buch)if(!wgs.includes(z.wg))wgs.push(z.wg);wgs.sort((a,b)=>String(a).localeCompare(String(b),'de',{numeric:true}));
    const alt=el('kal');const links=alt?alt.scrollLeft:null;

    let kopf='';for(let i=0;i<N;i++){const z=von+i;const dt=ausZahl(z);const tg=dt.getUTCDate();
      kopf+='<button class="kt'+(z===heute?' heute':'')+(z===gewaehlt?' wahl':'')+(z<heute?' vorbei':'')+'" style="left:'+(i*W)+'px" data-z="'+z+'">'
        +((tg===1||i===0)?'<span class="mo">'+esc(C.mon[dt.getUTCMonth()])+'</span>':'')
        +'<span class="wd">'+esc(C.wt[dt.getUTCDay()])+'</span><span class="nr">'+tg+'</span></button>'}
    const spalte=(z,k)=>z>=von&&z<=bis?'<div class="'+k+'" style="left:'+(W+(z-von)*W)+'px"></div>':'';
    let zeilen='';for(const wg of wgs){let balken='';
      for(const b of buch){if(b.wg!==wg||!b.an)continue;const ohneAb=!b.ab;const ab=ohneAb?b.an+1:b.ab;if(ab<von||b.an>bis)continue;
        const x=(b.an-von+.5)*W+2,w=(ab-b.an)*W-4;const rot=b.fehlt;
        balken+='<div class="bk'+(rot?' rot':'')+(b.ab&&b.ab<=heute?' vorbei':'')+'" style="left:'+x+'px;width:'+w+'px">'+PERSON+'<b>'+(b.g?esc(b.g):'?')+'</b></div>'}
      zeilen+='<div class="r"><div class="lab">'+esc(wg)+'</div><div class="trk" style="width:'+(N*W)+'px">'+balken+'</div></div>'}
    /* Tonnen als eigene Zeile: am Tag vor der Abholung RAUS, am Abholtag wieder REIN – in der Farbe der Tonne */
    const TF={blau:'#2F6FDB',gelb:'#F2C200',grau:'#8A8A8A'};const ton=daten.filter(z=>TF[z.art]&&z.d>=von&&z.d<=bis);
    if(ton.length){let m='';const proTag={};for(const z of ton)(proTag[z.d]=proTag[z.d]||[]).push(z);
      for(const [d,L] of Object.entries(proTag)){m+='<div class="tn" style="left:'+((d-von)*W)+'px">'+L.map(z=>{const raus=/OUT|RAUS|வெளியே/i.test(z.text);
        return '<span class="tc'+(raus?' raus':'')+'"><i style="background:'+TF[z.art]+'"></i>'+esc(raus?C.t.raus:C.t.rein)+'</span>'}).join('')+'</div>'}
      zeilen+='<div class="r tonnen"><div class="lab">'+TONNE+'</div><div class="trk" style="width:'+(N*W)+'px">'+m+'</div></div>'}
    if(!wgs.length)zeilen='<div class="r"><div class="lab"></div><div class="trk leer" style="width:'+(N*W)+'px"></div></div>';

    /* Was am gewählten Tag zu tun ist – dieselben Zeilen wie bisher */
    /* Beim Antippen eines Tages nur kurz: welche Wohnung an dem Tag zu putzen ist (dort reisen Gäste ab), dazu die Tonnen */
    const zt=daten.filter(z=>z.d===gewaehlt);const titel=(zt.find(z=>z.art==='tag')||{}).text||'';
    const putz=[...new Set(buch.filter(b=>b.ab===gewaehlt).map(b=>b.wg))].sort((a,b)=>String(a).localeCompare(String(b),'de',{numeric:true}));
    const tonnen=zt.filter(z=>z.art==='blau'||z.art==='gelb'||z.art==='grau'||z.art==='tonne');
    const zeil=putz.map(wg=>'<div class="z">WG '+esc(wg)+' – '+esc(C.t.putzen)+'</div>').join('')
      +(putz.length?'':'<div class="z leer">'+esc(C.t.nichts)+'</div>')
      +tonnen.map(z=>'<div class="z">'+esc(z.text)+'</div>').join('');
    const tagKarte='<section class="tag'+(gewaehlt===heute?' heute':gewaehlt<heute?' vorbei':'')+'"><h2>'+(gewaehlt===heute?'<span class="badge">'+esc(C.t.heute)+'</span>':'')+esc(titel)+'</h2>'+zeil+'</section>';

    el('inhalt').innerHTML='<div class="karte"><div class="kal" id="kal"><div class="kin" style="width:'+(W+N*W)+'px">'
      +spalte(heute,'sp heute')+(gewaehlt!==heute?spalte(gewaehlt,'sp wahl'):'')
      +'<div class="r kopf"><div class="lab ecke">'+HAUS+'</div><div class="trk" style="width:'+(N*W)+'px">'+kopf+'</div></div>'
      +zeilen+'</div></div></div>'+tagKarte;
    const kal=el('kal');
    if(gezeigtFuer!==heute){gezeigtFuer=heute;kal.scrollLeft=Math.max(0,(heute-von-1)*W)}else if(links!=null)kal.scrollLeft=links}

  /* Tippen auf einen Tag (Kopf oder Zeile) zeigt darunter, was an dem Tag zu tun ist */
  document.addEventListener('click',e=>{const k=e.target.closest('.kt');let z=k?+k.dataset.z:null;
    if(z==null){const t=e.target.closest('.r:not(.kopf) .trk');if(t){const r=t.getBoundingClientRect();const tage=daten?[...new Set(daten.filter(x=>x.art==='tag').map(x=>x.d))]:[];
      if(tage.length)z=Math.min(...tage)+Math.floor((e.clientX-r.left)/W)}}
    if(z!=null&&daten){gewaehlt=z;zeigen()}});

  laden();setInterval(()=>{if(document.visibilityState==='visible')laden()},5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')laden()});
})();
