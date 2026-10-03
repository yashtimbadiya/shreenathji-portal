/**
 * challanImport.ts
 *
 * Parses the "challan register" sheet (tab 4 of the production workbook) into
 * Challan records ready to be inserted through the store.
 *
 * The sheet has a fixed leading block then a repeating SIZE / ROUND grid:
 *   CHALAN NO., DATE, PRODUCT NAME, DEZAIN NO., PICK, FOLDER NO., PARTY NAME,
 *   MACHINE PATTI, MTR PER PIC, [SIZE, ROUND] x5, TOTAL PIC, TOTAL MTR
 *
 * Read by header name where possible; the repeating SIZE/ROUND pairs are
 * detected positionally (any header that normalises to SIZE followed by ROUND).
 *
 * Parsing is pure — product/vendor linking is done by the store, which has the
 * live product & vendor lists. This module only extracts + normalises rows and
 * reports the distinct party names it saw.
 */

import * as XLSX from 'xlsx';
import type { ChallanSizeLine } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedChallanRow {
  challanNumber: string;
  date: string;          // ISO YYYY-MM-DD
  productName: string;
  designNo: string;
  pick: number;
  folderNo: string;
  partyName: string;     // raw, trimmed
  machinePatti: number;
  mtrPerPic: number;
  lines: ChallanSizeLine[];
  totalPieces: number;
  totalMeters: number;
}

export interface ChallanParseResult {
  ok: boolean;
  message: string;
  rows: ParsedChallanRow[];
  /** Distinct non-internal party names discovered (EXTRA* excluded) */
  partyNames: string[];
  skipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normHeader(h: unknown): string {
  return String(h ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** A party name that means "internal / no customer" */
export function isInternalParty(name: string): boolean {
  return /^EXTRA\b/i.test(name.trim()) || name.trim() === '';
}

/**
 * Convert a sheet date cell to ISO YYYY-MM-DD.
 * Handles: JS Date (cellDates), Excel serial number, and "M/D/YYYY" strings.
 */
function toIsoDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date → JS date
    const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = str(v);
  // M/D/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const month = m[1].padStart(2, '0');
    const day = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return s; // leave as-is if unrecognised
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnMap {
  challanNumber: number;
  date: number;
  productName: number;
  designNo: number;
  pick: number;
  folderNo: number;
  partyName: number;
  machinePatti: number;
  mtrPerPic: number;
  totalPieces: number;
  totalMeters: number;
  /** [sizeCol, roundCol] pairs, in order */
  sizeRoundPairs: [number, number][];
}

function buildColumnMap(headerCells: string[]): ColumnMap | null {
  const find = (...aliases: string[]) =>
    headerCells.findIndex((h) => aliases.includes(h));

  const challanNumber = find('CHALAN NO.', 'CHALAN NO', 'CHALLAN NO.', 'CHALLAN NO');
  const productName = find('PRODUCT NAME');
  if (challanNumber === -1 || productName === -1) return null;

  // Detect repeating SIZE/ROUND pairs positionally
  const sizeRoundPairs: [number, number][] = [];
  for (let i = 0; i < headerCells.length - 1; i++) {
    if (headerCells[i] === 'SIZE' && headerCells[i + 1] === 'ROUND') {
      sizeRoundPairs.push([i, i + 1]);
    }
  }

  return {
    challanNumber,
    date: find('DATE'),
    productName,
    designNo: find('DEZAIN NO.', 'DESIGN NO.', 'DEZAIN NO', 'DESIGN NO'),
    pick: find('PICK'),
    folderNo: find('FOLDER NO.', 'FOLDER NO'),
    partyName: find('PARTY NAME'),
    machinePatti: find('MACHINE PATTI', 'MACHIN PATI', 'MACHIN PATTI'),
    mtrPerPic: find('MTR PER PIC', 'MTR PER PIC.'),
    totalPieces: find('TOTAL PIC', 'TOTAL PIC.'),
    totalMeters: find('TOTAL MTR', 'TOTAL MTR.'),
    sizeRoundPairs,
  };
}

export async function parseChallanRegister(file: File): Promise<ChallanParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Find the challan sheet: has CHALAN NO. + PARTY NAME + a SIZE/ROUND pair
    let target: XLSX.WorkSheet | undefined;
    let headerRow = -1;
    let matrix: unknown[][] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      for (let i = 0; i < Math.min(m.length, 10); i++) {
        const cells = m[i].map(normHeader);
        const looksLikeChallan =
          (cells.includes('CHALAN NO.') || cells.includes('CHALAN NO')) &&
          cells.includes('PARTY NAME') &&
          cells.includes('SIZE');
        if (looksLikeChallan) { target = ws; headerRow = i; matrix = m; break; }
      }
      if (target) break;
    }

    if (!target || headerRow === -1) {
      return {
        ok: false,
        message: 'No challan-register sheet found (need "CHALAN NO.", "PARTY NAME" and "SIZE" columns).',
        rows: [], partyNames: [], skipped: 0,
      };
    }

    const cols = buildColumnMap(matrix[headerRow].map(normHeader));
    if (!cols) {
      return { ok: false, message: 'Challan sheet header could not be mapped.', rows: [], partyNames: [], skipped: 0 };
    }

    const rows: ParsedChallanRow[] = [];
    const partySet = new Set<string>();
    let skipped = 0;

    for (let r = headerRow + 1; r < matrix.length; r++) {
      const row = matrix[r];
      const challanNumber = str(row[cols.challanNumber]);
      if (!challanNumber) { skipped++; continue; } // blank row

      const lines: ChallanSizeLine[] = [];
      for (const [sc, rc] of cols.sizeRoundPairs) {
        const size = str(row[sc]);
        const round = num(row[rc]);
        if (size) lines.push({ size, round });
      }

      const partyName = str(row[cols.partyName]);
      if (!isInternalParty(partyName)) partySet.add(partyName);

      rows.push({
        challanNumber,
        date: cols.date >= 0 ? toIsoDate(row[cols.date]) : '',
        productName: str(row[cols.productName]),
        designNo: cols.designNo >= 0 ? str(row[cols.designNo]) : '',
        pick: cols.pick >= 0 ? num(row[cols.pick]) : 0,
        folderNo: cols.folderNo >= 0 ? str(row[cols.folderNo]) : '',
        partyName,
        machinePatti: cols.machinePatti >= 0 ? num(row[cols.machinePatti]) : 0,
        mtrPerPic: cols.mtrPerPic >= 0 ? num(row[cols.mtrPerPic]) : 0,
        lines,
        totalPieces: cols.totalPieces >= 0 ? num(row[cols.totalPieces]) : 0,
        totalMeters: cols.totalMeters >= 0 ? num(row[cols.totalMeters]) : 0,
      });
    }

    if (rows.length === 0) {
      return { ok: false, message: 'Challan sheet had no usable rows.', rows: [], partyNames: [], skipped };
    }

    return {
      ok: true,
      message: `Parsed ${rows.length} challan${rows.length !== 1 ? 's' : ''} (${partySet.size} real parties, ${skipped} blank rows skipped).`,
      rows,
      partyNames: [...partySet],
      skipped,
    };
  } catch (err) {
    return { ok: false, message: `Failed to read file: ${String(err)}`, rows: [], partyNames: [], skipped: 0 };
  }
}
