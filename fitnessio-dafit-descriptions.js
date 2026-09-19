/* Fitnessio — persistent Dafit nutrition formatter v3 */
(() => {
  'use strict';

  const norm = s => (s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function linesFrom(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return (clone.innerText || clone.textContent || '')
      .split(/\n+/).map(norm).filter(Boolean);
  }

  function parse(lines) {
    const start = lines.findIndex(x => /^Tabulka nutričních hodnot\s*:?$/i.test(x));
    if (start < 0) return null;

    const tail = lines.slice(start + 1);
    if (tail.length < 3) return null;

    const dose = tail.shift();
    const rows = [];
    let consumed = 0;

    for (let i = 0; i + 1 < tail.length; i += 2) {
      const name = tail[i];
      const value = tail[i + 1];
      if (/^(\*?EAA\b|Složení\s*:|Alergeny\s*:|Upozornění\s*:)/i.test(name)) break;
      if (!/\d/.test(value) || !/(mg|g|µg|mcg|kcal|kj|%|ml)\b/i.test(value)) break;
      rows.push([name, value]);
      consumed = i + 2;
    }

    if (rows.length < 2) return null;
    return { start, dose, rows, after: tail.slice(consumed) };
  }

  function card(data) {
    const el = document.createElement('section');
    el.className = 'fitnessio-dafit-nutrition';
    el.innerHTML =
      '<h3>Nutriční hodnoty</h3>' +
      '<div class="fitnessio-dafit-dose">' + esc(data.dose) + '</div>' +
      '<div class="fitnessio-dafit-table" role="table">' +
      data.rows.map(r =>
        '<div class="fitnessio-dafit-row" role="row"><span>' +
        esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>'
      ).join('') +
      '</div>';
    return el;
  }

  function transformSingleBlock(el, data, lines) {
    const before = lines.slice(0, data.start);
    const frag = document.createDocumentFragment();

    if (before.length) {
      const p = document.createElement('p');
      p.innerHTML = before.map(esc).join('<br>');
      frag.appendChild(p);
    }

    frag.appendChild(card(data));

    if (data.after.length) {
      const p = document.createElement('p');
      p.innerHTML = data.after.map(esc).join('<br>');
      frag.appendChild(p);
    }

    const parent = el.parentElement;
    if (parent) parent.classList.add('fitnessio-dafit-description');
    el.replaceWith(frag);
  }

  function trySingleBlock() {
    const candidates = [...document.querySelectorAll('p, div')];
    for (const el of candidates) {
      if (el.closest('.fitnessio-dafit-nutrition')) continue;
      const text = norm(el.textContent);
      if (!/Tabulka nutričních hodnot/i.test(text)) continue;
      const lines = linesFrom(el);
      const data = parse(lines);
      if (!data) continue;
      transformSingleBlock(el, data, lines);
      return true;
    }
    return false;
  }

  function trySiblingBlocks() {
    const els = [...document.querySelectorAll('p, div, h2, h3, h4, strong')];
    const heading = els.find(el => /^Tabulka nutričních hodnot\s*:?$/i.test(norm(el.textContent)));
    if (!heading) return false;

    const collected = [];
    const nodes = [];
    let n = heading.nextElementSibling;
    while (n && collected.length < 80) {
      const t = norm(n.textContent);
      if (/^(Složení|Alergeny|Upozornění)\s*:/i.test(t)) break;
      if (t) { collected.push(t); nodes.push(n); }
      n = n.nextElementSibling;
    }

    const data = parse(['Tabulka nutričních hodnot:', ...collected]);
    if (!data) return false;

    heading.parentElement?.classList.add('fitnessio-dafit-description');
    heading.insertAdjacentElement('afterend', card(data));
    heading.style.display = 'none';

    const hideCount = 1 + data.rows.length * 2;
    nodes.slice(0, hideCount).forEach(el => { el.style.display = 'none'; });
    return true;
  }

  function run() {
    if (document.querySelector('.fitnessio-dafit-nutrition')) return true;

    const pathOk = location.pathname.toLowerCase().includes('atp-nutrition-creatine-eaa-citicoline-400-g-red-blood-orange');
    const pageText = norm(document.body?.innerText);
    const productOk = pathOk || pageText.includes('8595612013620') || /Číslo produktu:\s*18457/i.test(pageText);
    if (!productOk) return false;

    const ok = trySingleBlock() || trySiblingBlocks();
    if (ok) document.documentElement.dataset.fitnessioDafit = 'ready';
    return ok;
  }

  let attempts = 0;
  function retry() {
    attempts++;
    if (run() || attempts >= 30) return;
    setTimeout(retry, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', retry, {once:true});
  } else {
    retry();
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('.fitnessio-dafit-nutrition')) {
      observer.disconnect();
      return;
    }
    run();
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  setTimeout(() => observer.disconnect(), 30000);
})();