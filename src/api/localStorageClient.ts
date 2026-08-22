import type {
  Category,
  JobWork,
  Product,
  ReceiptRecord,
  Vendor,
} from '../types';

const STORAGE_KEY = 'shreenathji-portal';

type PersistedPortalState = {
  categories?: Category[];
  products?: Product[];
  jobWorks?: JobWork[];
  vendors?: Vendor[];
  receipts?: ReceiptRecord[];
};

function readPersistedState(): PersistedPortalState {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as PersistedPortalState;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function fetchVendors() {
  return (readPersistedState().vendors ?? []) as Vendor[];
}

export async function fetchCategories() {
  return (readPersistedState().categories ?? []) as Category[];
}

export async function fetchProducts() {
  return (readPersistedState().products ?? []) as Product[];
}

export async function fetchJobWorks() {
  return (readPersistedState().jobWorks ?? []) as JobWork[];
}

export async function fetchReceipts() {
  return (readPersistedState().receipts ?? []) as ReceiptRecord[];
}

export async function createVendor(vendor: {
  name: string;
  contactPerson: string;
  mobile: string;
  gstNumber?: string;
  specialization?: string;
  status: string;
}) {
  return {
    ...vendor,
    id: generateId('v'),
  } as Vendor;
}

export async function createReceipt(receipt: {
  jobWorkId: string;
  date: string;
  receivedBy: string;
  vendorChallanNumber?: string;
  remarks?: string;
  createdBy: string;
  items: { variantId: string; received: number }[];
}) {
  return {
    ...receipt,
    id: generateId('rc'),
  } as ReceiptRecord;
}
