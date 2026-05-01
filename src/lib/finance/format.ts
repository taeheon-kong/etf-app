/** 숫자 포맷팅 헬퍼. 한국식 표기 (억/조 USD, %). */

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtPctSigned(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

export function fmtNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

/** USD 금액을 한국식으로: 억/조 단위. */
export function fmtUsdKorean(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}조 USD`;
  if (abs >= 1e8) return `${(v / 1e8).toFixed(0)}억 USD`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}만 USD`;
  return `${v.toFixed(0)} USD`;
}

/** USD 금액을 영어식으로: B/M. */
export function fmtUsdShort(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

/** 날짜 "2024-12-31" → "2024년 12월" 또는 "2024년" */
export function fmtYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return `${dateStr.slice(0, 4)}년`;
}

/** 단순 USD: 711.24 → "711.24" */
export function fmtPriceUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}