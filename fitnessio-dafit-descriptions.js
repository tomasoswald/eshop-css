/* Fitnessio — persistent Dafit description formatter v2 */
(() => {
  'use strict';
  const norm=s=>(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function run(){
    if(document.querySelector('.fitnessio-dafit-nutrition')) return;
    const bodyText=norm(document.body.innerText);
    // Current verified Dafit product. Product number is a fallback when EAN formatting differs.
    const verifiedProduct = location.pathname.toLowerCase().includes('atp-nutrition-creatine-eaa-citicoline-400-g-red-blood-orange') ||
      bodyText.includes('8595612013620') ||
      bodyText.includes('Číslo produktu:18457') ||
      bodyText.includes('Číslo produktu: 18457');
    if(!verifiedProduct) return;

    // Eshop-rychle renders imported description as BR-separated text and/or individual P elements.
    const all=[...document.querySelectorAll('p,div,section,article')];
    const heading=all.find(el=>norm(el.textContent)==='Tabulka nutričních hodnot:');
    if(!heading) return;

    const scope=heading.parentElement || heading;
    scope.classList.add('fitnessio-dafit-description');

    // Prefer the actual P sequence, because that is what is visible on the live page.
    const siblings=[];
    let n=heading.nextElementSibling;
    while(n && !/^(Složení:|Alergeny:|Upozornění:)/i.test(norm(n.textContent))){
      const t=norm(n.textContent);
      if(t) siblings.push({el:n,text:t});
      n=n.nextElementSibling;
    }

    let dose='', rows=[], consumed=[];
    if(siblings.length>=3){
      dose=siblings[0].text; consumed.push(siblings[0].el);
      for(let i=1;i+1<siblings.length;i+=2){
        const name=siblings[i].text, value=siblings[i+1].text;
        if(/^\*EAA/i.test(name)) break;
        if(!/\d/.test(value)) break;
        rows.push([name,value]);
        consumed.push(siblings[i].el,siblings[i+1].el);
      }
    }

    // Fallback for a single BR-heavy paragraph.
    if(rows.length<3){
      const source=[...document.querySelectorAll('p')].find(p=>norm(p.innerText).includes('Tabulka nutričních hodnot:') && norm(p.innerText).includes('Kreatin monohydrát'));
      if(source){
        const lines=source.innerText.split(/\n+/).map(norm).filter(Boolean);
        const start=lines.findIndex(x=>/^Tabulka nutričních hodnot:?$/i.test(x));
        const stop=lines.findIndex((x,i)=>i>start && /^(Složení:|Alergeny:|Upozornění:)/i.test(x));
        const b=lines.slice(start+1,stop>start?stop:lines.length);
        dose=b.shift()||'';
        rows=[];
        for(let i=0;i+1<b.length;i+=2){
          if(/^\*EAA/i.test(b[i])) break;
          if(!/\d/.test(b[i+1])) break;
          rows.push([b[i],b[i+1]]);
        }
      }
    }
    if(rows.length<3) return;

    const card=document.createElement('section');
    card.className='fitnessio-dafit-nutrition';
    card.innerHTML='<h3>Nutriční hodnoty</h3>'+
      (dose?'<div class="fitnessio-dafit-dose">'+escape(dose)+'</div>':'')+
      '<div class="fitnessio-dafit-table" role="table">'+
      rows.map(r=>'<div class="fitnessio-dafit-row" role="row"><span>'+escape(r[0])+'</span><strong>'+escape(r[1])+'</strong></div>').join('')+
      '</div>';
    heading.insertAdjacentElement('afterend',card);
    heading.style.display='none';
    consumed.forEach(el=>el.style.display='none');
    document.documentElement.dataset.fitnessioDafit='ready';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
  setTimeout(run,700);
  setTimeout(run,1800);
})();
