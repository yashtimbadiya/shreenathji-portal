/**
 * vendorAccounting.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "how much do we owe a vendor and what makes it up".
 *
 * Rule of the business: we pay for GOOD pieces actually received back.
 *   job owed = Σ over items ( receivedQuantity × rate )
 *
 * Outstanding is always DERIVED (owed − paid), never stored, so it can't drift.
 */

import type { JobWork, Payment } from '../types';

/** Amount owed to the vendor for one job = Σ(receivedQuantity × rate). */
export function jobOwedAmount(job: JobWork): number {
  return job.items.reduce((sum, i) => sum + i.receivedQuantity * (i.rate ?? 0), 0);
}

/** "YYYY-MM" for an ISO date string. */
export function monthKey(iso: string): string {
  return (iso ?? '').slice(0, 7);
}

/** Human label for a "YYYY-MM" key, e.g. "Sep 2026". Empty key → "All time". */
export function monthLabel(key: string): string {
  if (!key) return 'All time';
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${months[idx]} ${y}` : key;
}

export interface VendorStatementJobRow {
  jobId: string;
  jobNumber: string;
  issueDate: string;
  process: string;
  sentQty: number;
  receivedQty: number;
  /** rejected + loss pieces (not paid for) */
  rejectedQty: number;
  /** weighted-average rate across items with received qty (for display) */
  rate: number;
  amount: number; // receivedQty-weighted owed for this job
}

export interface VendorStatementPaymentRow {
  id: string;
  date: string;
  receiptNumber?: string;
  method?: Payment['method'];
  reference?: string;
  paid: number;
}

export interface VendorStatement {
  vendorId: string;
  /** '' = all time */
  period: string;
  jobs: VendorStatementJobRow[];
  paymentsInScope: VendorStatementPaymentRow[];
  owed: number;
  paidInScope: number;
  balance: number;
  jobCount: number;
}

/**
 * Build a full statement for a vendor, optionally scoped to a month ("YYYY-MM").
 * Jobs are scoped by issueDate; payments by their own date.
 */
export function buildVendorStatement(
  vendorId: string,
  jobWorks: JobWork[],
  payments: Payment[],
  period = '',
): VendorStatement {
  const inScope = (iso: string) => period === '' || monthKey(iso) === period;

  const jobs: VendorStatementJobRow[] = jobWorks
    .filter((j) => j.vendorId === vendorId && inScope(j.issueDate))
    .map((j) => {
      const receivedQty = j.items.reduce((s, i) => s + i.receivedQuantity, 0);
      const sentQty = j.items.reduce((s, i) => s + i.sentQuantity, 0);
      const rejectedQty = j.items.reduce((s, i) => s + i.rejectedQuantity + i.lossQuantity, 0);
      const amount = jobOwedAmount(j);
      const rate = receivedQty > 0 ? amount / receivedQty : (j.items[0]?.rate ?? 0);
      return {
        jobId: j.id,
        jobNumber: j.jobNumber,
        issueDate: j.issueDate,
        process: j.process,
        sentQty,
        receivedQty,
        rejectedQty,
        rate,
        amount,
      };
    })
    // Only jobs that actually have a payable value contribute to the statement
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  const paymentsInScope: VendorStatementPaymentRow[] = payments
    .filter((p) => p.vendorId === vendorId && inScope(p.date))
    .map((p) => ({
      id: p.id,
      date: p.date,
      receiptNumber: p.receiptNumber,
      method: p.method,
      reference: p.reference,
      paid: p.paid,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const owed = jobs.reduce((s, r) => s + r.amount, 0);
  const paidInScope = paymentsInScope.reduce((s, p) => s + p.paid, 0);
  const balance = Math.max(0, owed - paidInScope);

  return {
    vendorId,
    period,
    jobs,
    paymentsInScope,
    owed,
    paidInScope,
    balance,
    jobCount: jobs.length,
  };
}

/** Months that have any payable work or any payment for a vendor (desc). */
export function vendorAvailableMonths(
  vendorId: string,
  jobWorks: JobWork[],
  payments: Payment[],
): string[] {
  const set = new Set<string>();
  jobWorks.forEach((j) => {
    if (j.vendorId === vendorId && jobOwedAmount(j) > 0) set.add(monthKey(j.issueDate));
  });
  payments.forEach((p) => {
    if (p.vendorId === vendorId) set.add(monthKey(p.date));
  });
  return Array.from(set).filter(Boolean).sort().reverse();
}
