/**
 * 한국 ETF 메타데이터 로더.
 *
 * data/meta_kr/{TICKER}.json 을 읽어서 화면용 형태로 변환.
 * 네이버 모바일 API 응답을 보존한 형태.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const META_DIR = join(process.cwd(), "data", "meta_kr");

export type KrTotalInfo = {
  code: string;
  key: string;
  value: string;
};

export type KrCompareItem = {
  itemCode: string;
  stockName: string;
  closePrice: string;
  fluctuationsRatio: string;
  marketValue: string;
};

export type KrEtfRichMeta = {
  ticker: string;
  stockName: string | null;
  description: string | null;

  // etfKeyIndicator
  issuerName: string | null;
  marketValue: string | null;       // "21조 9,042억"
  totalNav: string | null;
  nav: number | null;
  totalFee: number | null;          // % 단위 그대로 (0.15 = 0.15%)
  dividendYieldTtm: number | null;  // % 단위 그대로
  deviationSign: string | null;
  deviationRate: number | null;
  returnRate1m: number | null;
  returnRate3m: number | null;
  returnRate1y: number | null;

  totalInfos: KrTotalInfo[];
  industryCompareInfo: KrCompareItem[];
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // 문자열에 콤마 들어있으면 제거 ("101,172.04" → "101172.04")
  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function loadKrMeta(ticker: string): KrEtfRichMeta | null {
  const filepath = join(META_DIR, `${ticker}.json`);
  if (!existsSync(filepath)) return null;

  try {
    const raw = JSON.parse(readFileSync(filepath, "utf-8"));

    // 빈 깡통 (ticker만 있는 경우) 거르기
    if (Object.keys(raw).length < 3) return null;

    return {
      ticker: String(raw.ticker || ticker),
      stockName: raw.stockName ?? null,
      description: raw.description ?? null,
      issuerName: raw.issuerName ?? null,
      marketValue: raw.marketValue ?? null,
      totalNav: raw.totalNav ?? null,
      nav: toNum(raw.nav),
      totalFee: toNum(raw.totalFee),
      dividendYieldTtm: toNum(raw.dividendYieldTtm),
      deviationSign: raw.deviationSign ?? null,
      deviationRate: toNum(raw.deviationRate),
      returnRate1m: toNum(raw.returnRate1m),
      returnRate3m: toNum(raw.returnRate3m),
      returnRate1y: toNum(raw.returnRate1y),
      totalInfos: Array.isArray(raw.totalInfos) ? raw.totalInfos : [],
      industryCompareInfo: Array.isArray(raw.industryCompareInfo)
        ? raw.industryCompareInfo
        : [],
    };
  } catch {
    return null;
  }
}

/** 1좌당 배당금 = NAV × (배당률 / 100). */
export function calcDividendPerShare(meta: KrEtfRichMeta | null): number | null {
  if (!meta || meta.nav === null || meta.dividendYieldTtm === null) return null;
  return meta.nav * (meta.dividendYieldTtm / 100);
}