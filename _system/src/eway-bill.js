/**
 * E-Way Bill JSON for the GST portal bulk upload.
 * Copy this one file into any app. It has no imports and does not read a database.
 *
 *   import { generateEWayBillJSON } from './eway-bill.js';
 *   const file = generateEWayBillJSON(profile, client, details, items, totals, 'tax-invoice', {
 *     distance: 245, vehicleNo: 'MH14YZ7755'
 *   });
 *
 * profile: { businessName, gstin, address, city, state, pin, country }
 * client:  { name, gstin, address, city, state, pin }
 * details: { invoiceNumber, invoiceDate, vehicleNo, distance, dispatchedThrough }
 * items:   [{ name, description, hsn, quantity, unit, rate, taxPercent, cessPercent, discount }]
 * totals:  { taxableAmount, cgst, sgst, igst, cess, utgst, total }
 * The return value is { version: '1.0.0621', billLists: [...] } with genMode 'Excel'.
 */

const GST_STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
  'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06',
  'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12',
  'nagaland': '13', 'manipur': '14', 'mizoram': '15',
  'tripura': '16', 'meghalaya': '17', 'assam': '18',
  'west bengal': '19', 'jharkhand': '20', 'odisha': '21',
  'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'andhra pradesh': '37', 'karnataka': '29', 'goa': '30',
  'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35',
  'telangana': '36', 'ladakh': '38',
};
const LEGACY_STATE_CODE_MAP = { '28': '37', '25': '26' };

const getStateCode = (stateOrGstin) => {
  if (!stateOrGstin) return '';
  const s = String(stateOrGstin).trim();
  if (/^\d{2}[A-Z0-9]{13}$/i.test(s)) {
    const prefix = s.substring(0, 2);
    return LEGACY_STATE_CODE_MAP[prefix] || prefix;
  }
  const code = GST_STATE_CODES[s.toLowerCase()] || '';
  return LEGACY_STATE_CODE_MAP[code] || code;
};

const UNIT_TO_UQC = {
  Pcs: 'PCS', Nos: 'NOS', Kg: 'KGS', g: 'GMS', Tonne: 'TON', Ltr: 'LTR', ml: 'MLT',
  Mtr: 'MTR', cm: 'CMS', Ft: 'FTS', In: 'INS', 'Sq.ft': 'SQF', 'Sq.m': 'SQM',
  Hrs: 'HRS', Day: 'DAY', Week: 'OTH', Month: 'OTH', Year: 'OTH', Visit: 'OTH',
  Session: 'OTH', Project: 'OTH', Word: 'OTH', Page: 'OTH', Box: 'BOX', Dozen: 'DOZ',
  Pair: 'PRS', Set: 'SET', Bag: 'BAG', Roll: 'ROL', Bottle: 'BTL',
};
const getUnitUQC = (label) => UNIT_TO_UQC[label] || 'OTH';

const finiteNonNeg = (n) => {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const resolveLineDiscount = (item = {}) => {
  const qty = finiteNonNeg(item.quantity);
  const rate = finiteNonNeg(item.rate);
  const net = qty * rate;
  const raw = finiteNonNeg(item.discount);
  if (raw <= 0 || net <= 0) return 0;
  if (item.discountType === 'percent') return Math.min(net, (net * Math.min(raw, 100)) / 100);
  const base = item.discountBase || 'net';
  if (base === 'unit') return Math.min(net, qty * raw);
  if (base === 'with-tax') {
    const taxRate = finiteNonNeg(item.taxPercent);
    const divisor = 1 + taxRate / 100;
    return Math.min(net, divisor > 0 ? raw / divisor : raw);
  }
  return Math.min(net, raw);
};

// Bulk e-Way Bill JSON from EWB_Preparation_Tool_08122025.
// The tool stamps version 1.0.0621 and genMode Excel. Dates are DD/MM/YYYY.
// supplyType is the direction (O outward, I inward). Intra versus inter
// state is fromStateCode compared with the bill-to toStateCode.
const EWAY_VERSION = '1.0.0621';
const EWAY_DOC_TYPES = new Set(['INV', 'BIL', 'BOE', 'CHL', 'OTH']);
const EWAY_UQC = new Set(['BAG','BAL','BDL','BKL','BOU','BOX','BTL','BUN','CAN','CBM','CCM','CMS','CTN','DOZ','DRM','GGK','GMS','GRS','GYD','KGS','KLR','KME','LTR','MLT','MTR','MTS','NOS','OTH','PAC','PCS','PRS','QTL','ROL','SET','SQF','SQM','SQY','TBS','TGM','THD','TON','TUB','UGS','UNT','YDS']);
const EWAY_BILL_KEYS = ['genMode','userGstin','supplyType','subSupplyType','subSupplyDesc','docType','docNo','docDate','transType','fromGstin','fromTrdName','fromAddr1','fromAddr2','fromPlace','fromPincode','fromStateCode','actualFromStateCode','toGstin','toTrdName','toAddr1','toAddr2','toPlace','toPincode','toStateCode','actualToStateCode','totalValue','cgstValue','sgstValue','igstValue','cessValue','TotNonAdvolVal','OthValue','totInvValue','transMode','transDistance','transporterName','transporterId','transDocNo','transDocDate','vehicleNo','vehicleType','mainHsnCode','itemList'];
const EWAY_ITEM_KEYS = ['itemNo','productName','productDesc','hsnCode','quantity','qtyUnit','taxableAmount','sgstRate','cgstRate','igstRate','cessRate','cessNonAdvol'];

const ewayMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const ewayCleanGstin = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();
const ewayText = (value, max) => String(value || '').replace(/[^A-Za-z0-9\s@#\-/&.,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const ewayPlace = (city, address) => {
  const named = ewayText(city, 50).replace(/[^A-Za-z\s.-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (named) return named.slice(0, 50);
  const text = String(address || '');
  const district = text.match(/\bDIST(?:RICT)?\s*[-:]?\s*([A-Za-z]+)/i);
  if (district) return district[1].toUpperCase().slice(0, 50);
  const taluka = text.match(/\bTAL(?:UKA)?\s*[-:]?\s*([A-Za-z]+)/i);
  return taluka ? taluka[1].toUpperCase().slice(0, 50) : '';
};
const ewayPin = (value, obj) => {
  const direct = String(value ?? '').replace(/\D/g, '');
  if (direct.length >= 6) {
    const pin = Number(direct.slice(0, 6));
    if (pin >= 100000 && pin <= 999999) return pin;
  }
  if (obj) {
    const stored = String(obj.pin || obj.pincode || '').replace(/\D/g, '');
    if (stored.length === 6) return Number(stored);
    const fromAddr = String(obj.address || '').match(/\b(\d{6})\b/);
    if (fromAddr) return Number(fromAddr[1]);
  }
  return 0;
};
const ewayDate = (value) => {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const slashed = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashed) return text;
  const dashed = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashed) return `${dashed[1]}/${dashed[2]}/${dashed[3]}`;
  return '';
};
const ewayHsn = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 5 || digits.length === 7) digits = `0${digits}`;
  return digits.slice(0, 8);
};
const ewayQtyUnit = (item, override) => {
  const chosen = String(override || '').toUpperCase();
  if (EWAY_UQC.has(chosen)) return chosen;
  const label = String(item?.unit || '').trim();
  if (!label) return 'NOS';
  const code = getUnitUQC(label);
  return EWAY_UQC.has(code) ? code : 'NOS';
};
const ewaySplitAddress = (address) => {
  const text = ewayText(address, 240);
  if (text.length <= 120) return [text, ''];
  const cut = text.slice(0, 120);
  const space = cut.lastIndexOf(' ');
  const line1 = (space > 40 ? cut.slice(0, space) : cut).trim();
  return [line1, text.slice(line1.length).trim().slice(0, 120)];
};
const ewayStateNum = (code, fallback) => {
  if (code !== undefined && code !== null && String(code).trim() !== '') {
    const n = Number(String(code).replace(/\D/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(getStateCode(String(fallback || ''))) || 0;
};
const ewayDocNo = (value) => String(value || '').replace(/[^A-Za-z0-9./-]/g, '').slice(0, 16);
const ewayVehicle = (value) => String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 15);

const parseEwayDate = (value) => {
  const m = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
};

export const ewayProblems = (json, today = new Date()) => {
  const bill = json?.billLists?.[0];
  const problems = [];
  if (!bill) return ['The e-Way Bill is empty.'];
  const gstinOk = (value) => value === 'URP' || /^[0-9]{2}[0-9A-Z]{13}$/.test(value || '');
  if (!/^[0-9]{2}[0-9A-Z]{13}$/.test(bill.userGstin || '')) problems.push('Your GSTIN must be 15 characters.');
  if (bill.supplyType !== 'O' && bill.supplyType !== 'I') problems.push('Supply type must be Outward or Inward.');
  if (bill.supplyType === 'O' && bill.fromGstin !== bill.userGstin) problems.push('For an outward bill, the consignor GSTIN must be your GSTIN.');
  if (bill.supplyType === 'I' && bill.toGstin !== bill.userGstin) problems.push('For an inward bill, the consignee GSTIN must be your GSTIN.');
  if (!Number.isInteger(bill.subSupplyType) || bill.subSupplyType < 1 || bill.subSupplyType > 12) problems.push('Choose a sub supply type.');
  if (bill.subSupplyType === 8 && !String(bill.subSupplyDesc || '').trim()) problems.push('Sub supply description is required when the sub type is Others.');
  if (!EWAY_DOC_TYPES.has(bill.docType)) problems.push('Choose a document type.');
  if (!bill.docNo) problems.push('Document number is required.');
  const docDate = parseEwayDate(bill.docDate);
  if (!docDate) problems.push('Document date must be DD/MM/YYYY.');
  else {
    const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (docDate > endToday) problems.push('Document date cannot be after today.');
  }
  if (![1, 2, 3].includes(bill.transType)) problems.push('Choose a transaction type.');
  if (!gstinOk(bill.fromGstin)) problems.push('Consignor GSTIN must be 15 characters or URP.');
  if (!gstinOk(bill.toGstin)) problems.push('Consignee GSTIN must be 15 characters or URP.');
  for (const [key, label] of [['fromPincode', 'Consignor PIN'], ['toPincode', 'Consignee PIN']]) {
    if (!(bill[key] >= 100000 && bill[key] <= 999999)) problems.push(`${label} must be 6 digits.`);
  }
  for (const [key, label] of [['fromStateCode', 'Consignor state'], ['actualFromStateCode', 'Dispatch state'], ['toStateCode', 'Consignee state'], ['actualToStateCode', 'Ship-to state']]) {
    if (!(Number.isInteger(bill[key]) && bill[key] >= 1 && bill[key] <= 99)) problems.push(`${label} code is required.`);
  }
  if (!Array.isArray(bill.itemList) || bill.itemList.length === 0) problems.push('Add at least one item.');
  (bill.itemList || []).forEach((item, idx) => {
    if (![4, 6, 8].includes(String(item.hsnCode || '').length)) problems.push(`Item ${idx + 1} HSN must be 4, 6, or 8 digits.`);
  });
  if (bill.mainHsnCode && ![4, 6, 8].includes(String(bill.mainHsnCode).length)) problems.push('Main HSN must be 4, 6, or 8 digits.');
  if (![1, 2, 3, 4].includes(bill.transMode)) problems.push('Choose a transport mode.');
  if (!(Number.isInteger(bill.transDistance) && bill.transDistance >= 1 && bill.transDistance <= 4000)) problems.push('Distance must be a whole number from 1 to 4000 km.');
  const vehicleOk = bill.vehicleNo.length >= 7 && bill.vehicleNo.length <= 15;
  const transporterOk = /^[0-9]{2}[0-9A-Z]{13}$/.test(bill.transporterId || '');
  if (bill.transporterId && !transporterOk) problems.push('Transporter Id must be a 15-character GSTIN, or left blank.');
  if (bill.vehicleNo && !vehicleOk) problems.push('Vehicle number must be 7 to 15 letters and digits.');
  if (bill.transMode === 1) {
    if (!vehicleOk && !transporterOk) problems.push('For road, enter a vehicle number or a transporter GSTIN.');
    if (bill.vehicleType !== 'R' && bill.vehicleType !== 'O') problems.push('For road, vehicle type must be Regular or Over Dimensional Cargo.');
  } else if (bill.transMode === 2 || bill.transMode === 3) {
    if (!bill.transDocNo) problems.push('Transport document number is required for rail or air.');
    const transDate = parseEwayDate(bill.transDocDate);
    if (!transDate) problems.push('Transport document date is required for rail or air.');
    else if (docDate && transDate < docDate) problems.push('Transport document date must be on or after the document date.');
    if (bill.vehicleType !== 'R') problems.push('For rail or air, vehicle type must be Regular.');
  } else if (bill.transMode === 4 && bill.vehicleType !== 'R') {
    problems.push('For ship, vehicle type must be Regular.');
  }
  if ((bill.transMode === 1 || bill.transMode === 4) && bill.transDocDate) {
    const transDate = parseEwayDate(bill.transDocDate);
    if (!transDate) problems.push('Transport document date must be DD/MM/YYYY.');
    else if (docDate && transDate < docDate) problems.push('Transport document date must be on or after the document date.');
  }
  return problems;
};

export const generateEWayBillJSON = (profile, client, details, items, totals, invoiceType = 'tax-invoice', opts = {}) => {
  profile = profile || {};
  client = client || {};
  details = details || {};
  items = Array.isArray(items) ? items : [];
  totals = totals || {};
  opts = opts || {};
  if (profile.country && profile.country !== 'India') {
    throw new Error('E-Way Bill is an Indian GST portal feature. Set business country to "India" in Settings to enable it.');
  }

  const taxInclusive = !!(opts.taxInclusive ?? totals.taxInclusive);
  const userGstin = ewayCleanGstin(profile.gstin);
  const supplyType = opts.supplyType === 'I' ? 'I' : 'O';
  const subSupplyType = Number.isInteger(Number(opts.subSupplyType)) && Number(opts.subSupplyType) >= 1 && Number(opts.subSupplyType) <= 12
    ? Number(opts.subSupplyType) : 1;
  const subSupplyDesc = ewayText(opts.subSupplyDesc, 100);
  const docType = EWAY_DOC_TYPES.has(opts.docType)
    ? opts.docType
    : (invoiceType === 'delivery-challan' ? 'CHL' : invoiceType === 'bill-of-supply' ? 'BIL' : 'INV');

  const fromParty = opts.from && typeof opts.from === 'object' ? opts.from : null;
  const toParty = opts.to && typeof opts.to === 'object' ? opts.to : null;
  const fromStateFallback = getStateCode(profile.state || userGstin);
  const toStateFallback = getStateCode(client.state || client.gstin);
  const shipSame = details.shipToSameAsBilling !== false;
  const shipStateFallback = shipSame ? toStateFallback : getStateCode(details.shippingState || client.state || client.gstin);

  const fromGstin = ewayCleanGstin(fromParty ? fromParty.gstin : profile.gstin) || (supplyType === 'I' ? 'URP' : userGstin);
  const toGstin = ewayCleanGstin(toParty ? toParty.gstin : client.gstin) || 'URP';
  const [derivedFrom1, derivedFrom2] = ewaySplitAddress(profile.address);
  const shipAddress = shipSame ? client.address : (details.shippingAddress || client.address);
  const [derivedTo1, derivedTo2] = ewaySplitAddress(shipAddress);
  const fromAddr1 = fromParty ? ewayText(fromParty.addr1, 120) : derivedFrom1;
  const fromAddr2 = fromParty ? ewayText(fromParty.addr2, 120) : derivedFrom2;
  const toAddr1 = toParty ? ewayText(toParty.addr1, 120) : derivedTo1;
  const toAddr2 = toParty ? ewayText(toParty.addr2, 120) : derivedTo2;
  const fromPlace = fromParty ? ewayPlace(fromParty.place) : ewayPlace(profile.city, profile.address);
  const toPlace = toParty
    ? ewayPlace(toParty.place)
    : ewayPlace(shipSame ? client.city : (details.shippingCity || client.city), shipAddress);
  const fromPincode = fromParty ? ewayPin(fromParty.pincode) : ewayPin(undefined, profile);
  const toPincode = toParty
    ? ewayPin(toParty.pincode)
    : ewayPin(shipSame ? undefined : details.shippingPin, shipSame ? client : { pin: details.shippingPin, address: shipAddress });
  const fromStateCode = ewayStateNum(fromParty ? fromParty.stateCode : undefined, profile.state || userGstin);
  const toStateCode = ewayStateNum(toParty ? toParty.stateCode : undefined, client.state || client.gstin);
  const actualFromStateCode = ewayStateNum(
    fromParty ? fromParty.actualStateCode : undefined,
    profile.state || userGstin,
  );
  const actualToStateCode = toParty
    ? ewayStateNum(toParty.actualStateCode, '')
    : (Number(shipStateFallback) || toStateCode);
  const derivedTransType = (!shipSame && shipStateFallback && toStateFallback && shipStateFallback !== toStateFallback) ? 2 : 1;
  const transType = [1, 2, 3].includes(Number(opts.transType)) ? Number(opts.transType) : derivedTransType;
  const isInterstate = !!(client.isSEZ || client.isSez) || !!(fromStateCode && toStateCode && fromStateCode !== toStateCode);

  const itemList = items.map((item, idx) => {
    const gross = Math.max(0, (Number(item.quantity) || 0) * (Number(item.rate) || 0) - resolveLineDiscount(item));
    const taxRate = Number(item.taxPercent) || 0;
    const taxable = taxInclusive && taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
    const cessNonAdvol = Array.isArray(opts.cessNonAdvol)
      ? ewayMoney(opts.cessNonAdvol[idx])
      : ewayMoney(item.cessNonAdvol);
    return {
      itemNo: idx + 1,
      productName: ewayText(item.name, 100),
      productDesc: ewayText(item.description || item.name, 100),
      hsnCode: ewayHsn(Array.isArray(opts.hsnCodes) && opts.hsnCodes[idx] != null && opts.hsnCodes[idx] !== '' ? opts.hsnCodes[idx] : item.hsn),
      quantity: Math.round((Number(item.quantity) || 0) * 1000) / 1000,
      qtyUnit: ewayQtyUnit(item, Array.isArray(opts.qtyUnits) ? opts.qtyUnits[idx] : ''),
      taxableAmount: ewayMoney(taxable),
      sgstRate: isInterstate ? 0 : taxRate / 2,
      cgstRate: isInterstate ? 0 : taxRate / 2,
      igstRate: isInterstate ? taxRate : 0,
      cessRate: Number(item.cessPercent) || 0,
      cessNonAdvol,
    };
  });

  const totalValue = ewayMoney(totals.taxableAmount != null ? totals.taxableAmount : ((Number(totals.subtotal) || 0) - (Number(totals.totalDiscount) || 0)));
  const cgstValue = ewayMoney(totals.cgst);
  const sgstValue = ewayMoney((Number(totals.sgst) || 0) + (Number(totals.utgst) || 0));
  const igstValue = ewayMoney(totals.igst);
  const cessValue = ewayMoney(totals.cess);
  const TotNonAdvolVal = ewayMoney(itemList.reduce((sum, item) => sum + item.cessNonAdvol, 0));
  const totInvValue = ewayMoney(totals.total);
  const OthValue = ewayMoney(totInvValue - (totalValue + cgstValue + sgstValue + igstValue + cessValue + TotNonAdvolVal));

  const distanceRaw = opts.distance ?? details.transDistance ?? details.distance;
  const distanceNum = Math.round(Number(distanceRaw));
  const transMode = [1, 2, 3, 4].includes(Number(opts.transMode ?? details.transMode)) ? Number(opts.transMode ?? details.transMode) : 1;
  const vehicleType = (opts.vehicleType ?? details.vehicleType) === 'O' ? 'O' : 'R';

  const ordered = {
    genMode: 'Excel',
    userGstin,
    supplyType,
    subSupplyType,
    subSupplyDesc,
    docType,
    docNo: ewayDocNo(opts.docNo ?? details.invoiceNumber),
    docDate: ewayDate(opts.docDate ?? details.invoiceDate),
    transType,
    fromGstin: fromGstin || 'URP',
    fromTrdName: ewayText(fromParty ? fromParty.trdName : (profile.businessName || profile.name), 100),
    fromAddr1,
    fromAddr2,
    fromPlace,
    fromPincode,
    fromStateCode,
    actualFromStateCode: actualFromStateCode || fromStateCode,
    toGstin: toGstin || 'URP',
    toTrdName: ewayText(toParty ? toParty.trdName : client.name, 100),
    toAddr1,
    toAddr2,
    toPlace,
    toPincode,
    toStateCode,
    actualToStateCode: actualToStateCode || toStateCode,
    totalValue,
    cgstValue,
    sgstValue,
    igstValue,
    cessValue,
    TotNonAdvolVal,
    OthValue,
    totInvValue,
    transMode,
    transDistance: Number.isFinite(distanceNum) ? distanceNum : 0,
    transporterName: ewayText(opts.transporterName ?? details.dispatchedThrough, 25),
    transporterId: ewayCleanGstin(opts.transporterId ?? details.transporterId),
    transDocNo: ewayDocNo(opts.transDocNo ?? details.dispatchDocNo).slice(0, 16),
    transDocDate: ewayDate(opts.transDocDate ?? details.deliveryNoteDate),
    vehicleNo: ewayVehicle(opts.vehicleNo ?? details.vehicleNo),
    vehicleType,
    mainHsnCode: itemList[0]?.hsnCode || '',
    itemList,
  };
  const bill = {};
  for (const key of EWAY_BILL_KEYS) bill[key] = ordered[key];
  bill.itemList = itemList.map((item) => {
    const row = {};
    for (const key of EWAY_ITEM_KEYS) row[key] = item[key];
    return row;
  });

  const json = { version: EWAY_VERSION, billLists: [bill] };
  if (!opts.allowIncomplete) {
    const problems = ewayProblems(json);
    if (problems.length) throw new Error(problems.join('\n'));
  }
  return json;
};

export const generateBulkEWayBillJSON = (list) => ({
  version: EWAY_VERSION,
  billLists: (Array.isArray(list) ? list : []).map((inv) => generateEWayBillJSON(
    inv?.profile, inv?.client, inv?.details, inv?.items, inv?.totals, inv?.invoiceType, inv?.opts,
  ).billLists[0]),
});
