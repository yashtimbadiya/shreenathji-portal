import type {
  ActivityLog,
  Category,
  DispatchRecord,
  JobWork,
  Payment,
  Product,
  ReceiptRecord,
  StockTransaction,
  User,
  Vendor,
} from '../types';

export const USERS: User[] = [
  { id: 'u1', name: 'Yash Patel', email: 'yash@shreenathji.com', password: 'admin123' },
  { id: 'u2', name: 'Raj Manager', email: 'raj@shreenathji.com', password: 'manager123' },
  { id: 'u3', name: 'Store Staff', email: 'store@shreenathji.com', password: 'store123' },
  { id: 'u4', name: 'Accounts Team', email: 'accounts@shreenathji.com', password: 'accounts123' },
  { id: 'u5', name: 'Viewer User', email: 'viewer@shreenathji.com', password: 'viewer123' },
];

export const CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Elastic', status: 'Active', createdDate: '2024-01-15', productCount: 2 },
  { id: 'cat2', name: 'Name Tag', status: 'Active', createdDate: '2024-02-10', productCount: 1 },
  { id: 'cat3', name: 'Woven Label', status: 'Active', createdDate: '2024-03-05', productCount: 1 },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    categoryId: 'cat1',
    name: 'Maroon Elastic',
    code: 'MAR-ELA',
    unit: 'Pic',
    status: 'Active',
    variants: [
      { id: 'v1', productId: 'p1', name: 'X', sku: 'MAR-ELA-X', attributes: [{ key: 'Size', value: 'X' }, { key: 'Width', value: '25mm' }, { key: 'Color', value: 'Maroon' }, { key: 'Quality', value: 'Premium' }], factoryStock: 1500, withVendor: 500, rejected: 0, status: 'Active' },
      { id: 'v2', productId: 'p1', name: 'M', sku: 'MAR-ELA-M', attributes: [{ key: 'Size', value: 'M' }, { key: 'Width', value: '25mm' }, { key: 'Color', value: 'Maroon' }, { key: 'Quality', value: 'Premium' }], factoryStock: 3000, withVendor: 1000, rejected: 50, status: 'Active' },
      { id: 'v3', productId: 'p1', name: 'L', sku: 'MAR-ELA-L', attributes: [{ key: 'Size', value: 'L' }, { key: 'Width', value: '25mm' }, { key: 'Color', value: 'Maroon' }, { key: 'Quality', value: 'Premium' }], factoryStock: 4000, withVendor: 1500, rejected: 0, status: 'Active' },
      { id: 'v4', productId: 'p1', name: 'XXL', sku: 'MAR-ELA-XXL', attributes: [{ key: 'Size', value: 'XXL' }, { key: 'Width', value: '25mm' }, { key: 'Color', value: 'Maroon' }, { key: 'Quality', value: 'Premium' }], factoryStock: 1500, withVendor: 500, rejected: 0, status: 'Active' },
    ],
  },
  {
    id: 'p2',
    categoryId: 'cat1',
    name: 'Black Elastic',
    code: 'BLK-ELA',
    unit: 'Pic',
    status: 'Active',
    variants: [
      { id: 'v5', productId: 'p2', name: 'X', sku: 'BLK-ELA-X', attributes: [{ key: 'Size', value: 'X' }, { key: 'Width', value: '20mm' }, { key: 'Color', value: 'Black' }], factoryStock: 2000, withVendor: 800, rejected: 0, status: 'Active' },
      { id: 'v6', productId: 'p2', name: 'M', sku: 'BLK-ELA-M', attributes: [{ key: 'Size', value: 'M' }, { key: 'Width', value: '20mm' }, { key: 'Color', value: 'Black' }], factoryStock: 3500, withVendor: 1200, rejected: 25, status: 'Active' },
      { id: 'v7', productId: 'p2', name: 'L', sku: 'BLK-ELA-L', attributes: [{ key: 'Size', value: 'L' }, { key: 'Width', value: '20mm' }, { key: 'Color', value: 'Black' }], factoryStock: 2800, withVendor: 600, rejected: 0, status: 'Active' },
      { id: 'v8', productId: 'p2', name: 'XXL', sku: 'BLK-ELA-XXL', attributes: [{ key: 'Size', value: 'XXL' }, { key: 'Width', value: '20mm' }, { key: 'Color', value: 'Black' }], factoryStock: 1200, withVendor: 400, rejected: 0, status: 'Active' },
    ],
  },
  {
    id: 'p3',
    categoryId: 'cat2',
    name: 'School Name Tag',
    code: 'SCH-NT',
    unit: 'Piece',
    status: 'Active',
    variants: [
      { id: 'v9', productId: 'p3', name: 'Small', sku: 'SCH-NT-S', attributes: [{ key: 'Size', value: 'Small' }], factoryStock: 5000, withVendor: 2000, rejected: 50, status: 'Active' },
      { id: 'v10', productId: 'p3', name: 'Medium', sku: 'SCH-NT-M', attributes: [{ key: 'Size', value: 'Medium' }], factoryStock: 8000, withVendor: 3000, rejected: 0, status: 'Active' },
      { id: 'v11', productId: 'p3', name: 'Large', sku: 'SCH-NT-L', attributes: [{ key: 'Size', value: 'Large' }], factoryStock: 4000, withVendor: 1500, rejected: 0, status: 'Active' },
    ],
  },
  {
    id: 'p4',
    categoryId: 'cat3',
    name: 'Premium Woven Label',
    code: 'PWL-001',
    unit: 'Piece',
    status: 'Active',
    variants: [
      { id: 'v12', productId: 'p4', name: 'Standard', sku: 'PWL-001-STD', attributes: [{ key: 'Design', value: 'Standard' }], factoryStock: 10000, withVendor: 3500, rejected: 0, status: 'Active' },
    ],
  },
];

export const VENDORS: Vendor[] = [
  { id: 'ven1', name: 'ABC Printing', contactPerson: 'Ramesh Kumar', mobile: '9876543210', gstNumber: '24AABCU9603R1ZM', specialization: 'Printing, Dyeing', status: 'Active', address: 'Surat, Gujarat' },
  { id: 'ven2', name: 'XYZ Stitching Works', contactPerson: 'Suresh Shah', mobile: '9876543211', gstNumber: '24AABCU9603R2ZN', specialization: 'Stitching, Folding', status: 'Active', address: 'Ahmedabad, Gujarat' },
  { id: 'ven3', name: 'Prime Cutting House', contactPerson: 'Mahesh Patel', mobile: '9876543212', gstNumber: '24AABCU9603R3ZO', specialization: 'Cutting, Packing', status: 'Active', address: 'Vadodara, Gujarat' },
  { id: 'ven4', name: 'Global Dyeing Unit', contactPerson: 'Anil Mehta', mobile: '9876543213', gstNumber: '24AABCU9603R4ZP', specialization: 'Dyeing', status: 'Active', address: 'Bhavnagar, Gujarat' },
];

export const JOB_WORKS: JobWork[] = [
  {
    id: 'jw1',
    jobNumber: 'JW-2026-00128',
    vendorId: 'ven1',
    process: 'Printing',
    issueDate: '2026-07-25',
    expectedReturnDate: '2026-07-30',
    priority: 'Normal',
    reference: 'PO-4521',
    remarks: 'Handle with care',
    status: 'Partial',
    createdBy: 'Yash Patel',
    createdAt: '2026-07-25T10:32:00',
    items: [
      { id: 'ji1', productId: 'p1', variantId: 'v1', sentQuantity: 500, receivedQuantity: 490, rejectedQuantity: 10, lossQuantity: 0, rate: 2.5 },
      { id: 'ji2', productId: 'p1', variantId: 'v2', sentQuantity: 1000, receivedQuantity: 480, rejectedQuantity: 20, lossQuantity: 0, rate: 2.7 },
      { id: 'ji3', productId: 'p1', variantId: 'v3', sentQuantity: 1500, receivedQuantity: 490, rejectedQuantity: 10, lossQuantity: 0, rate: 2.8 },
      { id: 'ji4', productId: 'p1', variantId: 'v4', sentQuantity: 500, receivedQuantity: 500, rejectedQuantity: 0, lossQuantity: 0, rate: 2.6 },
    ],
  },
  {
    id: 'jw2',
    jobNumber: 'JW-2026-00129',
    vendorId: 'ven2',
    process: 'Stitching',
    issueDate: '2026-07-20',
    expectedReturnDate: '2026-07-24',
    priority: 'High',
    status: 'Overdue',
    createdBy: 'Yash Patel',
    createdAt: '2026-07-20T09:00:00',
    items: [
      { id: 'ji5', productId: 'p2', variantId: 'v6', sentQuantity: 2000, receivedQuantity: 0, rejectedQuantity: 0, lossQuantity: 0, rate: 3.0 },
    ],
  },
  {
    id: 'jw3',
    jobNumber: 'JW-2026-00130',
    vendorId: 'ven3',
    process: 'Cutting',
    issueDate: '2026-07-26',
    expectedReturnDate: '2026-07-28',
    priority: 'Normal',
    status: 'Sent',
    createdBy: 'Raj Manager',
    createdAt: '2026-07-26T11:00:00',
    items: [
      { id: 'ji6', productId: 'p3', variantId: 'v10', sentQuantity: 3000, receivedQuantity: 0, rejectedQuantity: 0, lossQuantity: 0, rate: 1.8 },
    ],
  },
  {
    id: 'jw4',
    jobNumber: 'JW-2026-00131',
    vendorId: 'ven1',
    process: 'Dyeing',
    issueDate: '2026-07-22',
    expectedReturnDate: '2026-07-27',
    priority: 'Urgent',
    status: 'Processing',
    createdBy: 'Yash Patel',
    createdAt: '2026-07-22T14:00:00',
    items: [
      { id: 'ji7', productId: 'p2', variantId: 'v5', sentQuantity: 1500, receivedQuantity: 0, rejectedQuantity: 0, lossQuantity: 0, rate: 4.2 },
      { id: 'ji8', productId: 'p2', variantId: 'v7', sentQuantity: 1000, receivedQuantity: 0, rejectedQuantity: 0, lossQuantity: 0, rate: 4.4 },
    ],
  },
  {
    id: 'jw5',
    jobNumber: 'JW-2026-00132',
    vendorId: 'ven4',
    process: 'Dyeing',
    issueDate: '2026-07-15',
    expectedReturnDate: '2026-07-20',
    priority: 'Normal',
    status: 'Completed',
    createdBy: 'Raj Manager',
    createdAt: '2026-07-15T08:00:00',
    items: [
      { id: 'ji9', productId: 'p4', variantId: 'v12', sentQuantity: 5000, receivedQuantity: 4950, rejectedQuantity: 50, lossQuantity: 0, rate: 4.0 },
    ],
  },
  {
    id: 'jw6',
    jobNumber: 'JW-2026-00133',
    vendorId: 'ven2',
    process: 'Folding',
    issueDate: '2026-07-27',
    expectedReturnDate: '2026-07-29',
    priority: 'Normal',
    status: 'Draft',
    createdBy: 'Store Staff',
    createdAt: '2026-07-27T16:00:00',
    items: [
      { id: 'ji10', productId: 'p3', variantId: 'v9', sentQuantity: 0, receivedQuantity: 0, rejectedQuantity: 0, lossQuantity: 0, rate: 1.6 },
    ],
  },
];

export const DISPATCHES: DispatchRecord[] = [
  {
    id: 'd1',
    jobWorkId: 'jw1',
    challanNumber: 'CH-2026-00125',
    date: '2026-07-25',
    vehicleNumber: 'GJ-05-AB-1234',
    driver: 'Mohan Singh',
    transport: 'Own Vehicle',
    remarks: 'First dispatch',
    items: [
      { variantId: 'v1', quantity: 500 },
      { variantId: 'v2', quantity: 1000 },
      { variantId: 'v3', quantity: 1500 },
      { variantId: 'v4', quantity: 500 },
    ],
    createdBy: 'Store Staff',
  },
];

export const RECEIPTS: ReceiptRecord[] = [
  {
    id: 'r1',
    jobWorkId: 'jw1',
    date: '2026-07-27',
    receivedBy: 'Store Staff',
    vendorChallanNumber: 'VC-4521',
    remarks: 'Partial receipt - first batch',
    items: [
      { variantId: 'v1', received: 490, rejected: 0, loss: 0 },
      { variantId: 'v2', received: 480, rejected: 0, loss: 0 },
      { variantId: 'v3', received: 490, rejected: 0, loss: 0 },
      { variantId: 'v4', received: 500, rejected: 0, loss: 0 },
    ],
    createdBy: 'Store Staff',
  },
];

export const STOCK_TRANSACTIONS: StockTransaction[] = [
  { id: 'st1', date: '2026-07-25', productId: 'p1', variantId: 'v2', transaction: 'Job Work Dispatch', reference: 'JW-2026-00128', vendorId: 'ven1', inQty: 0, outQty: 1000, balance: 3000, user: 'Store Staff' },
  { id: 'st2', date: '2026-07-27', productId: 'p1', variantId: 'v2', transaction: 'Job Work Receipt', reference: 'JW-2026-00128', vendorId: 'ven1', inQty: 480, outQty: 0, balance: 3480, user: 'Store Staff' },
];

export const PAYMENTS: Payment[] = [
  { id: 'pay1', vendorId: 'ven1', jobWorkId: 'jw1', process: 'Printing', quantity: 5000, rate: 2.5, amount: 12500, paid: 5000, status: 'Partial', paymentType: 'Running', date: '2026-07-25', remarks: 'Advance against first batch' },
  { id: 'pay2', vendorId: 'ven2', jobWorkId: 'jw2', process: 'Stitching', quantity: 2000, rate: 3.0, amount: 6000, paid: 0, status: 'Pending', paymentType: 'Advance', date: '2026-07-20', remarks: 'Awaiting release' },
  { id: 'pay3', vendorId: 'ven4', jobWorkId: 'jw5', process: 'Dyeing', quantity: 5000, rate: 4.0, amount: 20000, paid: 20000, status: 'Paid', paymentType: 'Final', date: '2026-07-20', remarks: 'Final settlement completed' },
];

export const ACTIVITY_LOGS: ActivityLog[] = [
  { id: 'a1', entityType: 'JobWork', entityId: 'jw1', message: 'Yash created JW-2026-00128', user: 'Yash Patel', timestamp: '2026-07-25T10:32:00' },
  { id: 'a2', entityType: 'JobWork', entityId: 'jw1', message: 'Material dispatched', user: 'Store Staff', timestamp: '2026-07-25T10:45:00' },
  { id: 'a3', entityType: 'JobWork', entityId: 'jw1', message: '500m M variant received', user: 'Store Staff', timestamp: '2026-07-27T14:15:00' },
  { id: 'a4', entityType: 'JobWork', entityId: 'jw1', message: '20m rejected', user: 'Store Staff', timestamp: '2026-07-27T15:20:00' },
];

export const PROCESSES = ['Printing', 'Cutting', 'Folding', 'Stitching', 'Dyeing', 'Packing', 'Other'];

export const VARIANT_ATTRIBUTE_KEYS = ['Size', 'Color', 'Width', 'Quality', 'Design'];

export function getProductById(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getVariantById(id: string) {
  for (const p of PRODUCTS) {
    const v = p.variants.find((vr) => vr.id === id);
    if (v) return { product: p, variant: v };
  }
  return null;
}

export function getVendorById(id: string) {
  return VENDORS.find((v) => v.id === id);
}

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function getJobSentTotal(job: JobWork) {
  return job.items.reduce((s, i) => s + i.sentQuantity, 0);
}

export function getJobReceivedTotal(job: JobWork) {
  return job.items.reduce((s, i) => s + i.receivedQuantity, 0);
}

export function getJobRejectedTotal(job: JobWork) {
  return job.items.reduce((s, i) => s + i.rejectedQuantity + i.lossQuantity, 0);
}

export function getJobPendingTotal(job: JobWork) {
  return job.items.reduce(
    (s, i) => s + Math.max(0, i.sentQuantity - i.receivedQuantity - i.rejectedQuantity - i.lossQuantity),
    0,
  );
}

export function formatQty(qty: number, unit: string) {
  return `${qty.toLocaleString('en-IN')} ${unit}`;
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}
