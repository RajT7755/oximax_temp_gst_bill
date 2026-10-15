// Letterhead invoice for the Tally layout. The billing server fills this
// from a saved bill; the rest of the Tally grid is left as the app prints it.

const TITLES = {
  'tax-invoice': 'TAX INVOICE',
  quotation: 'QUOTATION',
  proforma: 'PROFORMA INVOICE',
  'bill-of-supply': 'BILL OF SUPPLY',
  composition: 'BILL OF SUPPLY',
  'credit-note': 'CREDIT NOTE',
  'delivery-challan': 'DISPATCH CHALLAN',
};

const PERMANENT_LETTERHEAD = {
  name: 'OXIMAX AGRITECH INDUSTRIES PVT. LTD',
  address: 'GAT NO- 120/4 P, JAVKHEDE TISGAON-MIRI ROAD, TAL- PATHARDI, DIST - AHILYANAGAR. 414505',
  gstin: '27AAECO8908J1Z0',
  logo: '/letterhead-assets/logo.jpg',
};
const PERMANENT_TYPES = new Set(['tax-invoice', 'delivery-challan']);

const DECLARATION = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inr(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  let head = whole;
  let grouped = head;
  if (head.length > 3) {
    const tail = head.slice(-3);
    head = head.slice(0, -3);
    const parts = [];
    while (head.length > 2) {
      parts.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    if (head) parts.unshift(head);
    grouped = `${parts.join(',')},${tail}`;
  }
  return `${sign}${grouped}.${frac}`;
}

function two(n) {
  n = Number(n) || 0;
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
}

function rupeeWords(value) {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return 'Indian Rupees Zero Only';
  const parts = [];
  for (const [div, name] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']]) {
    const q = Math.floor(n / div);
    n %= div;
    if (q) parts.push(div === 100 ? `${two(q)} Hundred` : `${two(q)} ${name}`);
  }
  if (n) parts.push(two(n));
  return `Indian Rupees ${parts.join(' ')} Only`;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')}-${mon}-${String(d.getFullYear()).slice(-2)}`;
}

function cleanAddress(name, address) {
  let text = String(address || '').trim();
  const prefix = String(name || '').trim().replace(/\.+$/, '');
  if (prefix && text.toUpperCase().startsWith(prefix.toUpperCase())) {
    text = text.slice(prefix.length).replace(/^[\s.,-]+/, '');
  }
  return text;
}

function field(details, key) {
  const order = details.orderDetails && typeof details.orderDetails === 'object' ? details.orderDetails : details;
  const value = order?.[key];
  if (!value) return '';
  if (/date/i.test(key) || key === 'periodFrom' || key === 'periodTo') return shortDate(value);
  return String(value);
}

function partyBlock(party, heading, options, withContact) {
  const bits = [`<div class="h">${esc(heading)}</div>`, `<div class="strong">${esc(party?.name || '')}</div>`];
  if (party?.address) bits.push(`<div class="pre">${esc(party.address)}</div>`);
  const cityPin = [party?.city, party?.pin].filter(Boolean).join(' - ');
  if (cityPin) bits.push(`<div>${esc(cityPin)}</div>`);
  if (options.showGSTIN !== false && party?.gstin) {
    bits.push(`<div>GSTIN/UIN : <strong>${esc(String(party.gstin).trim())}</strong></div>`);
  }
  if (options.showState !== false && party?.state) bits.push(`<div>State Name : ${esc(party.state)}</div>`);
  if (withContact && party?.phone) bits.push(`<div>Ph: ${esc(party.phone)}</div>`);
  if (withContact && party?.email) bits.push(`<div>E-Mail : ${esc(party.email)}</div>`);
  return bits.join('');
}

function cell(label, value, strong) {
  const shown = strong ? `<strong>${value}</strong>` : value;
  return `<td><div class="lbl">${label}</div><div>${shown}</div></td>`;
}

const PAGE_CSS = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111827; font: 11.5px/1.35 Arial, Helvetica, sans-serif; background: #f8fafc; }
  .page { max-width: 190mm; margin: 12px auto; background: #fff; padding: 10mm; }
  .letterhead { display: flex; align-items: center; gap: 16px; padding: 4px 4px 8px; border-bottom: 2.5px solid #1B3A6B; margin-bottom: 8px; }
  .letterhead img { width: 118px; height: auto; object-fit: contain; }
  .letterhead .text { flex: 1; text-align: center; }
  .letterhead .name { font-size: 22px; font-weight: 800; color: #1B3A6B; line-height: 1.15; }
  .letterhead .addr { margin-top: 3px; font-size: 11px; }
  .letterhead .gst { margin-top: 2px; font-size: 12px; font-weight: 700; }
  h1.title { text-align: center; font-size: 16px; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #1f2937; padding: 4px 6px; vertical-align: top; }
  th { background: #f3f4f6; text-align: center; font-weight: 700; }
  .lbl { color: #374151; font-size: 0.92em; }
  .strong { font-weight: 800; }
  .pre { white-space: pre-line; }
  .h { font-weight: 700; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  .items { margin-top: -1px; }
  .spacer td { height: 72px; }
  .total td { font-weight: 800; }
  .box { border: 1px solid #1f2937; border-top: none; padding: 4px 6px; display: flex; justify-content: space-between; gap: 8px; }
  .foot { border: 1px solid #1f2937; border-top: none; display: grid; grid-template-columns: 1fr 1fr; }
  .foot > div { padding: 4px 6px; }
  .foot .left { border-right: 1px solid #1f2937; }
  .decl { font-weight: 700; text-decoration: underline; }
  .sign { min-height: 78px; text-align: right; }
  .sign .who { margin-top: 36px; font-weight: 700; }
  .note { text-align: center; color: #374151; font-size: 0.92em; margin-top: 4px; }
  a.back { display: inline-block; margin: 0 0 8px; color: #1B3A6B; font-size: 12px; }
  @media print {
    body { background: #fff; }
    .page { margin: 0; max-width: none; padding: 0; }
    a.back { display: none; }
  }
`;

export function renderLetterheadInvoice(bill) {
  const data = bill?.data || {};
  const profile = data.profile || {};
  const client = data.client || {};
  const details = data.details || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const totals = data.totals || {};
  const lines = Array.isArray(totals.lines) ? totals.lines : [];
  const options = data.invoiceOptions || {};
  const name = profile.businessName || 'Your Business';
  const gstin = String(profile.gstin || '').trim();
  let address = cleanAddress(name, profile.address || '');
  if (profile.pin && !address.includes(profile.pin)) address = `${address} ${profile.pin}`.trim();
  let phone = String(profile.phone || '').trim();
  if (phone.startsWith('+91') && !phone.startsWith('+91 ')) phone = `+91 ${phone.slice(3).trim()}`;
  const logo = profile.logo && String(profile.logo).startsWith('data:') ? profile.logo : '';
  const docType = data.invoiceType || bill.invoiceType || 'tax-invoice';
  const permanent = PERMANENT_TYPES.has(docType);
  const headName = permanent ? PERMANENT_LETTERHEAD.name : name;
  const headAddress = permanent ? PERMANENT_LETTERHEAD.address : address;
  const headGstin = permanent ? PERMANENT_LETTERHEAD.gstin : gstin;
  const headLogo = permanent ? PERMANENT_LETTERHEAD.logo : logo;
  const title = TITLES[docType] || 'TAX INVOICE';
  const invoiceNumber = details.invoiceNumber || bill.invoiceNumber || '';
  const invoiceDate = shortDate(details.invoiceDate || bill.invoiceDate);
  const sameShip = details.shipToSameAsBilling !== false && !details.shippingAddress;
  const consignee = sameShip ? client : {
    name: client.name,
    address: details.shippingAddress,
    city: details.shippingCity,
    pin: details.shippingPin,
    state: details.shippingState,
    gstin: '',
  };

  const seller = [`<div class="strong">${esc(name)}</div>`];
  if (profile.address) seller.push(`<div class="pre">${esc(profile.address)}</div>`);
  if (options.showGSTIN !== false && gstin) seller.push(`<div>GSTIN/UIN : <strong>${esc(gstin)}</strong></div>`);
  if (options.showState !== false && profile.state) {
    const code = gstin.slice(0, 2);
    seller.push(`<div>State Name : ${esc(profile.state)}${code ? `, Code : ${esc(code)}` : ''}</div>`);
  }
  const contact = [phone ? `Mobile: ${phone}` : '', profile.pan ? `PAN: ${profile.pan}` : ''].filter(Boolean);
  if (contact.length) seller.push(`<div>${esc(contact.join(' | '))}</div>`);
  if (profile.email) seller.push(`<div>E-Mail : ${esc(profile.email)}</div>`);

  const pairs = [
    ['Invoice No.', esc(invoiceNumber), 'Dated', esc(invoiceDate)],
    ['Delivery Note', esc(field(details, 'deliveryNote')), 'Mode/Terms of Payment', esc(field(details, 'paymentTerms'))],
    ['Reference No. & Date.', esc(field(details, 'referenceNo')), 'Other References', esc(field(details, 'otherReferences'))],
    ["Buyer's Order No.", esc(field(details, 'buyerOrderNo')), 'Dated', esc(field(details, 'buyerOrderDate'))],
    ['Dispatch Doc No.', esc(field(details, 'dispatchDocNo')), 'Delivery Note Date', esc(field(details, 'deliveryNoteDate'))],
    ['Dispatched through', esc(field(details, 'dispatchedThrough')), 'Destination', esc(field(details, 'destination'))],
  ];
  const extra = [];
  if (field(details, 'vehicleNo')) extra.push(['Vehicle No.', esc(field(details, 'vehicleNo'))]);
  if (options.showDueDate !== false && details.dueDate) extra.push(['Due Date', esc(shortDate(details.dueDate))]);
  if (options.showPlaceOfSupply && details.placeOfSupply) extra.push(['Place of Supply', esc(details.placeOfSupply)]);

  const meta = pairs.slice(0, 4).map((row, index) => (
    `${cell(row[0], row[1], index === 0)}${cell(row[2], row[3], index === 0)}`
  ));
  const partyRows = 3 + (extra.length ? 1 : 0);
  const extraRow = extra.length
    ? `<tr><td colspan="2">${extra.map(([label, value]) => `<div><span class="lbl">${label}: </span><strong>${value}</strong></div>`).join('')}</td></tr>`
    : '';

  const itemRows = items.map((item, index) => {
    const line = lines[index] || {};
    const qty = Number(item.quantity) || 0;
    const taxable = line.taxable ?? qty * (Number(item.rate) || 0);
    return `<tr><td class="c">${index + 1}</td><td><strong>${esc(item.name || '-')}</strong></td><td class="c">${esc(item.hsn || '')}</td><td class="r"><strong>${esc(qty)}${item.unit ? ` ${esc(item.unit)}` : ''}</strong></td><td class="r">${inr(item.rate)}</td><td class="c">${esc(item.unit || '')}</td><td class="r"><strong>${inr(taxable)}</strong></td></tr>`;
  }).join('');
  const taxable = (Number(totals.taxableAmount) || 0);
  const units = [...new Set(items.map(item => item.unit || ''))];
  const qtyTotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const qtyCell = units.length === 1 ? `${qtyTotal} ${units[0]}`.trim() : '';

  const interstate = Boolean(totals.isInterstate);
  const hsnMap = new Map();
  items.forEach((item, index) => {
    const line = lines[index] || {};
    const key = `${item.hsn || '-'}|${Number(item.taxPercent) || 0}`;
    const slot = hsnMap.get(key) || { hsn: item.hsn || '-', rate: Number(item.taxPercent) || 0, taxable: 0, tax: 0 };
    slot.taxable += Number(line.taxable) || 0;
    slot.tax += Number(line.tax) || 0;
    hsnMap.set(key, slot);
  });
  const hsnHead = interstate
    ? '<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">IGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th></tr>'
    : '<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">CGST</th><th colspan="2">SGST/UTGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>';
  const hsnBody = [...hsnMap.values()].map(slot => (
    interstate
      ? `<tr><td>${esc(slot.hsn)}</td><td class="r">${inr(slot.taxable)}</td><td class="c">${slot.rate}%</td><td class="r">${inr(slot.tax)}</td><td class="r">${inr(slot.tax)}</td></tr>`
      : `<tr><td>${esc(slot.hsn)}</td><td class="r">${inr(slot.taxable)}</td><td class="c">${slot.rate / 2}%</td><td class="r">${inr(slot.tax / 2)}</td><td class="c">${slot.rate / 2}%</td><td class="r">${inr(slot.tax / 2)}</td><td class="r">${inr(slot.tax)}</td></tr>`
  )).join('');
  const taxWords = options.showTaxInWords !== false && Number(totals.totalTaxAmount) > 0
    ? `<div class="box" style="display:block">Tax Amount (in words) : <strong>${esc(rupeeWords(totals.totalTaxAmount))}</strong></div>`
    : '';
  const hsnBlock = options.showHsnSummary === false ? '' : `<table><thead>${hsnHead}</thead><tbody>${hsnBody}</tbody></table>`;
  const declaration = options.showDeclaration === false ? '' : `<div class="decl">Declaration</div><div class="lbl">${esc(DECLARATION)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(invoiceNumber)} — ${esc(name)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="page">
  <a class="back" href="/letterhead">All invoices</a>
  <header class="letterhead">
    ${headLogo ? `<img src="${headLogo}" alt="">` : ''}
    <div class="text">
      <div class="name">${esc(headName)}</div>
      <div class="addr">${esc(headAddress)}</div>
      ${headGstin ? `<div class="gst">GSTIN: ${esc(headGstin)}</div>` : ''}
    </div>
  </header>
  <h1 class="title">${esc(title)}</h1>
  <table>
    <tr>
      <td rowspan="4" style="width:50%">${seller.join('')}</td>
      ${meta[0]}
    </tr>
    <tr>${meta[1]}</tr>
    <tr>${meta[2]}</tr>
    <tr>${meta[3]}</tr>
    <tr>
      <td rowspan="${partyRows}">${partyBlock(consignee, 'Consignee (Ship to)', options)}<div style="height:6px"></div>${partyBlock(client, 'Buyer (Bill to)', options, true)}</td>
      ${cell(pairs[4][0], pairs[4][1])}${cell(pairs[4][2], pairs[4][3])}
    </tr>
    <tr>${cell(pairs[5][0], pairs[5][1])}${cell(pairs[5][2], pairs[5][3])}</tr>
    ${extraRow}
    <tr><td colspan="2"><div class="lbl">Terms of Delivery</div><div>${esc(field(details, 'deliveryTerms'))}</div></td></tr>
  </table>
  <table class="items">
    <thead><tr><th style="width:36px">Sl No.</th><th>Description of Goods</th><th>HSN/SAC</th><th>Quantity</th><th>Rate</th><th>per</th><th>Amount</th></tr></thead>
    <tbody>
      ${itemRows || '<tr><td colspan="7"></td></tr>'}
      <tr><td></td><td></td><td></td><td></td><td></td><td></td><td class="r">${inr(taxable)}</td></tr>
      <tr class="spacer"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="total"><td></td><td class="r">Total</td><td></td><td class="r">${esc(qtyCell)}</td><td></td><td></td><td class="r">${inr(totals.total)}</td></tr>
    </tbody>
  </table>
  <div class="box">
    <div><div class="lbl">Amount Chargeable (in words)</div><div class="strong">${esc(rupeeWords(totals.total))}</div></div>
    <div><em>E. &amp; O.E</em></div>
  </div>
  ${hsnBlock}
  ${taxWords}
  <div class="foot">
    <div class="left">${declaration}</div>
    <div class="sign"><div class="strong">${esc(name)}</div><div class="who">Authorised Signatory</div></div>
  </div>
  <div class="note">This is a Computer Generated Invoice</div>
</div>
</body>
</html>`;
}

export function renderLetterheadIndex(bills) {
  const rows = bills.map(bill => {
    const id = encodeURIComponent(bill.id || bill.invoiceNumber || '');
    const when = shortDate(bill.invoiceDate);
    return `<tr><td><a href="/letterhead/view?id=${id}">${esc(bill.invoiceNumber || bill.id)}</a></td><td>${esc(when)}</td><td>${esc(bill.clientName || '')}</td><td class="r">${inr(bill.totalAmount)}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Letterhead invoices</title>
<style>${PAGE_CSS} .page { padding: 16px; } td a { color: #1B3A6B; font-weight: 700; }</style></head>
<body><div class="page">
  <h1 class="title" style="text-align:left">Letterhead invoices</h1>
  <p class="lbl">Open an invoice from Free GST Billing. The letterhead uses the business profile saved on that invoice.</p>
  <table><thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th>Amount</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4">No saved invoices yet.</td></tr>'}</tbody></table>
</div></body></html>`;
}
