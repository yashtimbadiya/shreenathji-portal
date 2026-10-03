/**
 * challanMath.ts
 *
 * The production challan totals, mirroring the source spreadsheet formulas:
 *
 *   TOTAL PIC = MACHINE PATTI × Σ(rounds)
 *   TOTAL MTR = round( Σ(rounds) × MTR PER PIC , 2 )
 *
 * (Confirmed against the DATA STORE sheet: T = H × sum(rounds),
 *  U = round(sum(rounds) × I, 2), where I is meters per round/roll.)
 */

import type { ChallanSizeLine } from '../types';

export function sumRounds(lines: ChallanSizeLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.round) || 0), 0);
}

export function computeTotalPieces(lines: ChallanSizeLine[], machinePatti: number): number {
  return (Number(machinePatti) || 0) * sumRounds(lines);
}

export function computeTotalMeters(lines: ChallanSizeLine[], mtrPerPic: number): number {
  const raw = sumRounds(lines) * (Number(mtrPerPic) || 0);
  return Math.round(raw * 100) / 100;
}
