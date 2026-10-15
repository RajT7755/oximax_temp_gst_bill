import { generateEWayBillJSON, generateBulkEWayBillJSON } from '../src/eway-bill.js';

const billKeys = ['genMode','userGstin','supplyType','subSupplyType','subSupplyDesc','docType','docNo','docDate','transType','fromGstin','fromTrdName','fromAddr1','fromAddr2','fromPlace','fromPincode','fromStateCode','actualFromStateCode','toGstin','toTrdName','toAddr1','toAddr2','toPlace','toPincode','toStateCode','actualToStateCode','totalValue','cgstValue','sgstValue','igstValue','cessValue','TotNonAdvolVal','OthValue','totInvValue','transMode','transDistance','transporterName','transporterId','transDocNo','transDocDate','vehicleNo','vehicleType','mainHsnCode','itemList'];
const itemKeys = ['itemNo','productName','productDesc','hsnCode','quantity','qtyUnit','taxableAmount','sgstRate','cgstRate','igstRate','cessRate','cessNonAdvol'];

let failed = 0;
const check = (name, ok) => {
  if (!ok) {
    failed += 1;
    console.error('FAIL', name);
  }
};

const seller = {
  country: 'India', businessName: 'Acme Mills', gstin: '29AAACG0569P1Z3',
  address: 'Old Airport Road', city: 'Bangalore', state: 'Karnataka', pin: '560090',
};
const buyer = {
  name: 'Sri Sai', gstin: '29ACEFS6707L1ZL', address: 'By Road',
  city: 'Bantwal', state: 'Karnataka', pin: '560090',
};
const road = { distance: 80, vehicleNo: 'KA12KA1234', transMode: 1, vehicleType: 'R' };
const items = [{ name: 'Steel rod', hsn: '26180000', quantity: 2, rate: 100, taxPercent: 18, unit: 'Kg' }];
const intra = generateEWayBillJSON(
  seller, buyer,
  { invoiceNumber: 'INV/2026-27/0003', invoiceDate: '2026-10-01' },
  items,
  { taxableAmount: 200, cgst: 18, sgst: 18, igst: 0, cess: 0, total: 236.4 },
  'tax-invoice',
  road,
);
const bill = intra.billLists[0];
check('version', intra.version === '1.0.0621' && bill.genMode === 'Excel');
check('bill key order', JSON.stringify(Object.keys(bill)) === JSON.stringify(billKeys));
check('item key order', JSON.stringify(Object.keys(bill.itemList[0])) === JSON.stringify(itemKeys));
check('date slashes', bill.docDate === '01/10/2026');
check('numbers', bill.subSupplyType === 1 && bill.transType === 1 && bill.transMode === 1 && bill.transDistance === 80 && bill.fromPincode === 560090 && bill.fromStateCode === 29);
check('intra rates', bill.itemList[0].cgstRate === 9 && bill.itemList[0].sgstRate === 9 && bill.itemList[0].igstRate === 0);
check('unit', bill.itemList[0].qtyUnit === 'KGS');
check('hsn string', bill.itemList[0].hsnCode === '26180000' && bill.mainHsnCode === '26180000');
check('other value', bill.OthValue === 0.4 && bill.totalValue + bill.cgstValue + bill.sgstValue + bill.igstValue + bill.cessValue + bill.TotNonAdvolVal + bill.OthValue === bill.totInvValue);
check('no api aliases', !('actFromStateCode' in bill) && !('transactionType' in bill) && !('otherValue' in bill));

const inter = generateEWayBillJSON(
  seller,
  { ...buyer, name: 'Coastal', gstin: '37BZNPM9430M1KL', state: 'Andhra Pradesh', city: 'Guntur', pin: '522101' },
  { invoiceNumber: 'INV/9', invoiceDate: '2026-10-02' },
  items,
  { taxableAmount: 200, cgst: 0, sgst: 0, igst: 36, cess: 0, total: 236 },
  'tax-invoice',
  road,
).billLists[0];
check('inter igst', inter.igstValue === 36 && inter.itemList[0].igstRate === 18 && inter.itemList[0].cgstRate === 0 && inter.toStateCode === 37);

const challan = generateEWayBillJSON(
  seller, buyer,
  { invoiceNumber: 'CHL/1', invoiceDate: '2026-10-03' },
  [{ ...items[0], taxPercent: 0 }],
  { taxableAmount: 200, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 200 },
  'delivery-challan',
  road,
).billLists[0];
check('challan', challan.docType === 'CHL');

const bulk = generateBulkEWayBillJSON([
  { profile: seller, client: buyer, details: { invoiceNumber: 'A', invoiceDate: '2026-10-01' }, items, totals: { taxableAmount: 200, cgst: 18, sgst: 18, total: 236 }, invoiceType: 'tax-invoice', opts: road },
  { profile: seller, client: buyer, details: { invoiceNumber: 'B', invoiceDate: '2026-10-02' }, items, totals: { taxableAmount: 200, cgst: 18, sgst: 18, total: 236 }, invoiceType: 'tax-invoice', opts: road },
]);
check('bulk', bulk.version === '1.0.0621' && bulk.billLists.length === 2 && bulk.billLists[0].genMode === 'Excel' && bulk.billLists[0].docNo === 'A' && bulk.billLists[1].docNo === 'B');

let pinThrew = false;
try {
  generateEWayBillJSON({ ...seller, pin: '' }, buyer, { invoiceNumber: 'X', invoiceDate: '2026-10-01' }, items, { taxableAmount: 200, total: 200 }, 'tax-invoice', road);
} catch (err) {
  pinThrew = /PIN/.test(err.message);
}
check('missing pin throws', pinThrew);

let foreignThrew = false;
try {
  generateEWayBillJSON({ ...seller, country: 'UAE' }, buyer, { invoiceNumber: 'X', invoiceDate: '2026-10-01' }, items, { total: 1 }, 'tax-invoice', road);
} catch (err) {
  foreignThrew = /India/.test(err.message);
}
check('foreign country throws', foreignThrew);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('eway schema ok');
