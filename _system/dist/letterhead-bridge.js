// Permanent Oximax letterhead on the Tally preview, print, and PDF capture.
// Tax invoice and dispatch challan only. Other document types stay plain.
(function () {
  const COMPANY = {
    name: 'OXIMAX AGRITECH INDUSTRIES PVT. LTD',
    address: 'GAT NO- 120/4 P, JAVKHEDE TISGAON-MIRI ROAD, TAL- PATHARDI, DIST - AHILYANAGAR. 414505',
    gstin: '27AAECO8908J1Z0',
    logo: '/letterhead-assets/logo.jpg',
  };
  const DOCS = new Set(['tax-invoice', 'delivery-challan']);

  const style = document.createElement('style');
  style.textContent = '.generator-toolbar .flex.gap-2{flex-wrap:wrap;max-width:100%}';
  document.head.appendChild(style);

  function buildBand() {
    const band = document.createElement('div');
    band.dataset.letterhead = '1';
    band.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:12px;max-width:100%;padding:2px 2px 8px;margin:0 0 8px;border-bottom:2.5px solid #1B3A6B;';

    const img = document.createElement('img');
    img.src = COMPANY.logo;
    img.alt = '';
    img.style.cssText = 'width:min(118px, 28vw);height:auto;object-fit:contain;flex:0 0 auto;';
    band.appendChild(img);

    const text = document.createElement('div');
    text.style.cssText = 'flex:1 1 160px;min-width:0;max-width:100%;text-align:center;color:#1B3A6B;line-height:1.2;overflow-wrap:anywhere;';
    const title = document.createElement('div');
    title.textContent = COMPANY.name;
    title.style.cssText = 'font-size:18px;font-weight:800;letter-spacing:0.01em;overflow-wrap:anywhere;';
    const line = document.createElement('div');
    line.textContent = COMPANY.address;
    line.style.cssText = 'margin-top:3px;font-size:11px;color:#1f2937;font-weight:500;overflow-wrap:anywhere;';
    const tax = document.createElement('div');
    tax.textContent = `GSTIN: ${COMPANY.gstin}`;
    tax.style.cssText = 'margin-top:2px;font-size:12px;font-weight:700;color:#111827;overflow-wrap:anywhere;';
    text.append(title, line, tax);
    band.appendChild(text);
    return band;
  }

  let scheduled = false;

  function decorate() {
    scheduled = false;
    document.querySelectorAll('.grid-inv-tally').forEach((block) => {
      if (!block.isConnected) return;
      const existing = block.querySelector(':scope > [data-letterhead]');
      if (!DOCS.has(block.dataset.doc || '')) {
        if (existing) existing.remove();
        return;
      }
      if (existing) return;
      block.insertBefore(buildBand(), block.firstChild);
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorate);
  else decorate();
})();
