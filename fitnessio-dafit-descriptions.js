/* Fitnessio — persistent Dafit product-description formatter
 * Source feed: https://xml.golemos.com/dafit.php
 * Feed-owned text is never overwritten. Formatting is applied after page render,
 * so later feed synchronizations cannot revert the presentation.
 */
(() => {
  'use strict';

  const DAFIT = {
    // Verified against the supplied Dafit feed + live Fitnessio product page.
    '8595612013620': { itemId: '391339', productNo: '18457' }
  };

  const norm = s => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const pageText = norm(document.body.innerText);
  const ean = Object.keys(DAFIT).find(x => pageText.includes('EAN kód:' + x) || pageText.includes('EAN kód: ' + x));
  if (!ean) return;

  const candidates = [...document.querySelectorAll('div,section,article')].filter(el => {
    const t = norm(el.innerText);
    return t.includes('Kompletní specifikace') && t.includes('Tabulka nutričních hodnot:');
  });
  const root = candidates.sort((a,b) => a.innerText.length - b.innerText.length)[0];
  if (!root) return;
  root.classList.add('fitnessio-dafit-description');

  // Convert the nutrition/composition block when the importer renders rows as BR-separated text.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let tableHeading = null;
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (norm(el.textContent) === 'Tabulka nutričních hodnot:') { tableHeading = el; break; }
  }

  // Generic enhancement for existing tables imported by the feed.
  root.querySelectorAll('table').forEach(t => t.classList.add('fitnessio-dafit-table'));

  // Special robust parser for plain-text/BR nutrition blocks.
  const html = root.innerHTML;
  if (!root.querySelector('.fitnessio-dafit-table') && /Tabulka nutričních hodnot:/i.test(root.innerText)) {
    const lines = root.innerText.split(/\n+/).map(norm).filter(Boolean);
    const start = lines.findIndex(x => /^Tabulka nutričních hodnot:?$/i.test(x));
    const stop = lines.findIndex((x,i) => i > start && /^(Složení:|Alergeny:|Upozornění:)/i.test(x));
    if (start >= 0) {
      const end = stop > start ? stop : lines.length;
      const block = lines.slice(start + 1, end);
      const dose = block.shift() || '';
      const rows = [];
      for (let i=0; i<block.length-1; i+=2) {
        const name = block[i], value = block[i+1];
        if (/^\*EAA/i.test(name)) break;
        if (/\d/.test(value)) rows.push([name,value]);
      }
      if (rows.length >= 3) {
        const card = document.createElement('section');
        card.className = 'fitnessio-dafit-nutrition';
        card.innerHTML = '<h3>Nutriční hodnoty</h3>' +
          (dose ? '<div class="fitnessio-dafit-dose">'+dose+'</div>' : '') +
          '<div class="fitnessio-dafit-table" role="table">' +
          rows.map(r => '<div class="fitnessio-dafit-row" role="row"><span>'+r[0]+'</span><strong>'+r[1]+'</strong></div>').join('') +
          '</div>';
        const heading = [...root.querySelectorAll('*')].find(el => norm(el.textContent) === 'Tabulka nutričních hodnot:');
        if (heading) heading.insertAdjacentElement('afterend', card);
      }
    }
  }
})();
