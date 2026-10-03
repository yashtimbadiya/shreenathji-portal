/**
 * productMasterImport.ts
 *
 * Parses the "product master" sheet (tab 2 of the production workbook) into
 * Product records ready to be inserted through the store.
 *
 * The sheet is read by HEADER NAME (not cell position) so it tolerates column
 * reordering. Empty / pre-numbered rows (blank PRODUCT NAME) are skipped.
 *
 * Column headers (as they appear in the source sheet):
 *   NO, PRODUCT NAME, FOLDER NO, DESIGN NO, COLOUR, TIKDI PER ROLL, GEPING,
 *   PAR.ROLL MITTER, MACHIN PATI, PICK, RATE PER MTR, CUT MARK, MIRECAL NAME
 *
 * This module does NOT touch the database — it returns a parsed result and the
 * caller (store action) is responsible for assigning ids, resolving categories,
 * and persisting. That keeps parsing pure and testable.
 */

import * as XLSX from 'xlsx';
import type { ProductSpec } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single parsed product-master row (no id, no categoryId yet) */
export interface ParsedProductMasterRow {
  /** Full product name — used as the product identity */
  name: string;
  /** Derived category name (e.g. "NANA", "MOTA", "JQ") */
  categoryName: string;
  /** Product code derived from folder no (fallback: design no) */
  code: string;
  rate?: number;
  spec: ProductSpec;
}

export interface ProductMasterParseResult {
  ok: boolean;
  message: string;
  rows: ParsedProductMasterRow[];
  /** Distinct category names discovered, in first-seen order */
  categories: string[];
  /** Row numbers (1-based, data rows) that were skipped for being empty */
  skipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a header cell: trim, collapse inner whitespace, uppercase */
function normHeader(h: unknown): string {
  return String(h ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Trim a string cell; empty-safe */
function str(v: unknown): string {
  return String(v ?? '').trim();
}

/** Parse a number, ignoring surrounding text; returns undefined if none found */
function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

/**
 * Derive a category name from the product name using known keywords.
 * Order matters — more specific patterns win.
 */
export function deriveCategory(productName: string): string {
  const n = productName.toUpperCase();
  if (/\bJQ\b/.test(n)) return 'JQ';
  if (/LOGO|MCAHO|MACAHO|MACHO/.test(n)) return 'LOGO';
  if (/DRY\s*CLEAN/.test(n)) return 'DRY CLEAN';
  if (/\bBOX\b/.test(n)) return 'BOX';
  if (/\bMOTA\b/.test(n)) return 'MOTA';
  if (/\bNANA\b/.test(n)) return 'NANA';
  if (/DENIM/.test(n)) return 'DENIM';
  return 'OTHER';
}

/**
 * Build a product code from folder no (preferred) or design no.
 * e.g. folderNo "LB-67-46-320" -> "LB-67-46-320"; falls back to design or name.
 */
function deriveCode(folderNo: string, designNo: string, name: string): string {
  if (folderNo) return folderNo;
  if (designNo) return `D-${designNo}`;
  // Last resort: a slug of the name
  return name.replace(/\s+/g, '-').slice(0, 40).toUpperCase();
}

// Header aliases → canonical key. Tolerates the sheet's spelling quirks.
const HEADER_MAP: Record<string, string> = {
  'NO': 'no',
  'PRODUCT NAME': 'name',
  'FOLDER NO': 'folderNo',
  'FOLDER NO.': 'folderNo',
  'DESIGN NO': 'designNo',
  'DESIGN NO.': 'designNo',
  'DEZAIN NO.': 'designNo',
  'COLOUR': 'colour',
  'COLOR': 'colour',
  'TIKDI PER ROLL': 'tikdiNote',
  'GEPING': 'geping',
  'PAR.ROLL MITTER': 'meterPerRoll',
  'PAR ROLL MITTER': 'meterPerRoll',
  'MACHIN PATI': 'machinePatti',
  'MACHINE PATTI': 'machinePatti',
  'MACHIN PATTI': 'machinePatti',
  'PICK': 'pick',
  'RATE PER MTR': 'ratePerMtr',
  'CUT MARK': 'cutMark',
  'MIRECAL NAME': 'mirName',
  'MIRICAL NAME': 'mirName',
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Locate the header row in the sheet (the row containing "PRODUCT NAME"),
 * then read the rows below it. Returns a canonical-keyed object per data row.
 */
function readRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  // Find header row index
  let headerIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const cells = matrix[i].map(normHeader);
    if (cells.includes('PRODUCT NAME')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];

  const headerCells = matrix[headerIdx].map(normHeader);
  const keys = headerCells.map((h) => HEADER_MAP[h] ?? '');

  const out: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    const obj: Record<string, unknown> = {};
    keys.forEach((k, c) => { if (k) obj[k] = row[c]; });
    out.push(obj);
  }
  return out;
}

export async function parseProductMaster(file: File): Promise<ProductMasterParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

    // Pick the sheet that has a PRODUCT NAME header AND a FOLDER/GEPING column
    // (distinguishes the product master from the challan register, which also
    // has PRODUCT NAME but no GEPING column).
    let target: XLSX.WorkSheet | undefined;
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const hasHeader = matrix.some((row) => {
        const cells = row.map(normHeader);
        return cells.includes('PRODUCT NAME') && cells.includes('GEPING');
      });
      if (hasHeader) { target = ws; break; }
    }

    if (!target) {
      return {
        ok: false,
        message: 'No product-master sheet found (need a sheet with "PRODUCT NAME" and "GEPING" columns).',
        rows: [], categories: [], skipped: 0,
      };
    }

    const raw = readRows(target);
    const rows: ParsedProductMasterRow[] = [];
    const categorySet = new Set<string>();
    let skipped = 0;

    for (const r of raw) {
      const name = str(r.name);
      if (!name) { skipped++; continue; } // empty / pre-numbered row

      const folderNo = str(r.folderNo);
      const designNo = str(r.designNo);
      const categoryName = deriveCategory(name);
      categorySet.add(categoryName);

      const spec: ProductSpec = {
        designNo:     designNo || undefined,
        folderNo:     folderNo || undefined,
        colour:       str(r.colour) || undefined,
        geping:       num(r.geping),
        meterPerRoll: num(r.meterPerRoll),
        machinePatti: num(r.machinePatti),
        pick:         num(r.pick),
        ratePerMtr:   num(r.ratePerMtr),
        cutMark:      str(r.cutMark) || undefined,
        mirName:      str(r.mirName) || undefined,
        tikdiNote:    str(r.tikdiNote) || undefined,
      };

      rows.push({
        name,
        categoryName,
        code: deriveCode(folderNo, designNo, name),
        rate: spec.ratePerMtr,
        spec,
      });
    }

    if (rows.length === 0) {
      return { ok: false, message: 'Product-master sheet had no usable rows.', rows: [], categories: [], skipped };
    }

    return {
      ok: true,
      message: `Parsed ${rows.length} product${rows.length !== 1 ? 's' : ''} (${categorySet.size} categories, ${skipped} empty rows skipped).`,
      rows,
      categories: [...categorySet],
      skipped,
    };
  } catch (err) {
    return { ok: false, message: `Failed to read file: ${String(err)}`, rows: [], categories: [], skipped: 0 };
  }
}
