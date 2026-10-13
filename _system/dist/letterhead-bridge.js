// Adds the company letterhead to every Tally invoice the app draws:
// the live preview, the print preview, and the page used for the PDF.
(function () {
  let profilePromise = null;

  function loadProfile() {
    if (!profilePromise) {
      profilePromise = fetch('/api/profile')
        .then(response => (response.ok ? response.json() : null))
        .catch(() => null);
    }
    return profilePromise;
  }

  function cleanAddress(name, address, pin) {
    let text = String(address || '').trim();
    const prefix = String(name || '').trim().replace(/\.+$/, '');
    if (prefix && text.toUpperCase().startsWith(prefix.toUpperCase())) {
      text = text.slice(prefix.length).replace(/^[\s.,-]+/, '');
    }
    if (pin && !text.includes(pin)) text = `${text} ${pin}`.trim();
    return text;
  }

  function buildBand(profile) {
    const name = profile.businessName || '';
    const address = cleanAddress(name, profile.address, profile.pin);
    const gstin = String(profile.gstin || '').trim();
    const band = document.createElement('div');
    band.dataset.letterhead = '1';
    band.style.cssText = 'display:flex;align-items:center;gap:10px;padding:2px 2px 6px;margin:0 0 6px;border-bottom:2px solid #1B3A6B;';

    if (profile.logo && String(profile.logo).startsWith('data:')) {
      const img = document.createElement('img');
      img.src = profile.logo;
      img.alt = '';
      img.style.cssText = 'width:78px;height:auto;object-fit:contain;flex:0 0 auto;';
      band.appendChild(img);
    }

    const text = document.createElement('div');
    text.style.cssText = 'flex:1;text-align:center;color:#1B3A6B;line-height:1.2;';
    const title = document.createElement('div');
    title.textContent = name;
    title.style.cssText = 'font-size:16px;font-weight:800;letter-spacing:0.01em;';
    text.appendChild(title);
    if (address) {
      const line = document.createElement('div');
      line.textContent = address;
      line.style.cssText = 'margin-top:2px;font-size:9px;color:#1f2937;font-weight:500;';
      text.appendChild(line);
    }
    if (gstin) {
      const tax = document.createElement('div');
      tax.textContent = `GSTIN: ${gstin}`;
      tax.style.cssText = 'margin-top:2px;font-size:10px;font-weight:700;color:#111827;';
      text.appendChild(tax);
    }
    band.appendChild(text);
    return band;
  }

  async function decorate() {
    const blocks = document.querySelectorAll('.grid-inv-tally');
    if (!blocks.length) return;
    const profile = await loadProfile();
    if (!profile || !profile.businessName) return;
    blocks.forEach(block => {
      const first = block.firstElementChild;
      if (first && first.dataset.letterhead === '1') return;
      block.querySelectorAll(':scope > [data-letterhead]').forEach(node => node.remove());
      if (!block.isConnected) return;
      block.insertBefore(buildBand(profile), block.firstChild);
    });
  }

  const observer = new MutationObserver(() => {
    decorate();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorate);
  else decorate();
})();
