/* Putzplan – liest das Blatt „Daten“ der Google-Tabelle (Spalte A Datum als Tageszahl, B Art, C Text, D1 Stand)
   und zeigt alle Tage untereinander. Beim Öffnen steht heute oben; frühere Tage liegen darüber (nach oben scrollen). Lädt beim Öffnen, alle 5 Minuten und beim Zurückkehren zur Seite neu. */
(function(){
  const C=window.PLAN;const el=id=>document.getElementById(id);
  const heuteZahl=()=>{const d=new Date();return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/864e5)};
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let nr=0,laeuft=false,gezeigtFuer=0;try{history.scrollRestoration='manual'}catch(e){}
  function laden(){if(laeuft)return;laeuft=true;const cb='planCb'+(++nr);const s=document.createElement('script');
    const t=setTimeout(()=>{fertig();fehler()},15000);
    function fertig(){clearTimeout(t);laeuft=false;delete window[cb];s.remove()}
    window[cb]=r=>{fertig();try{zeigen(r)}catch(e){fehler()}};
    s.onerror=()=>{fertig();fehler()};
    s.src='https://docs.google.com/spreadsheets/d/'+C.sheet+'/gviz/tq?sheet=Daten&headers=1&tqx=out:json;responseHandler:'+cb+'&_='+Date.now();
    document.head.appendChild(s)}
  function fehler(){if(!el('liste').dataset.ok)el('liste').innerHTML='<div class="hinweis">'+esc(C.t.fehler)+'</div>'}
  function zeigen(r){const tab=r&&r.table;if(!tab)return fehler();const cols=tab.cols||[];el('stand').textContent=(cols[3]&&cols[3].label)||'';
    const heute=heuteZahl();const zeilen=(tab.rows||[]).map(x=>({d:x.c[0]&&+x.c[0].v,art:x.c[1]&&x.c[1].v,text:x.c[2]&&x.c[2].v})).filter(z=>z.d&&z.text);
    if(!zeilen.length){el('liste').innerHTML='<div class="hinweis">'+esc(C.t.leer)+'</div>';el('liste').dataset.ok='1';return}
    let h='',offen=false;
    for(const z of zeilen){if(z.art==='tag'){if(offen)h+='</section>';const ist=z.d===heute;h+='<section class="tag'+(ist?' heute':z.d<heute?' vorbei':'')+'"'+(ist?' id="heute"':'')+'><h2>'+(ist?'<span class="badge">'+esc(C.t.heute)+'</span>':'')+esc(z.text)+'</h2>';offen=true}
      else h+='<div class="z '+esc(z.art||'')+'">'+esc(z.text)+'</div>'}
    if(offen)h+='</section>';el('liste').innerHTML=h;el('liste').dataset.ok='1';
    /* nur beim ersten Anzeigen (und nach Mitternacht) zu heute springen – beim stillen Nachladen bleibt die Stelle, an der gelesen wird */
    if(gezeigtFuer!==heute){gezeigtFuer=heute;const t=el('heute');if(t)t.scrollIntoView({block:'start'})}}
  laden();setInterval(()=>{if(document.visibilityState==='visible')laden()},5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')laden()});
})();
