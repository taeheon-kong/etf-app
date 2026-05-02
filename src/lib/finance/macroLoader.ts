/**
 * 매크로 데이터 로더 (CPI, FX, CD금리).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MACRO_DIR = join(process.cwd(), "data", "macro");

export type DateValue = { date: string; value: number };

function loadCsv(filename: string, valueCol: string): DateValue[] {
  const fp = join(MACRO_DIR, filename);
  if (!existsSync(fp)) return [];
  const text = readFileSync(fp, "utf-8").trim();
  const lines = text.split("\n");
  const header = lines[0].split(",").map((s) => s.trim());
  const idxDate = header.indexOf("Date");
  const idxVal = header.indexOf(valueCol);
  if (idxDate < 0 || idxVal < 0) return [];

  const rows: DateValue[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 2) continue;
    const v = Number(cols[idxVal]);
    if (!Number.isFinite(v)) continue;
    rows.push({ date: cols[idxDate], value: v });
  }
  return rows;
}

export const loadCpi = (): DateValue[] => loadCsv("kr_cpi.csv", "CPI");
export const loadFxUsdKrw = (): DateValue[] => loadCsv("usdkrw.csv", "Rate");
export const loadCd91 = (): DateValue[] => loadCsv("kr_cd91.csv", "Rate");

/** date 이하 가장 최근 값. (이진 탐색) */
export function valueAtOrBefore(series: DateValue[], date: string): number | null {
  if (series.length === 0) return null;
  if (date < series[0].date) return null;

  let lo = 0, hi = series.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (series[mid].date <= date) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].value;
}