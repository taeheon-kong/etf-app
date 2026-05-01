/**
 * ETF 메타데이터 로더.
 *
 * data/meta/{TICKER}.json 을 읽어서 화면에서 쓰기 좋게 정규화.
 * 단위 처리:
 *   - yfinance가 expenseRatio를 "이미 %단위(3=3%)"로 주는 경우가 많음
 *   - yield, yield-like 필드도 마찬가지로 일관성 없음
 *   - 휴리스틱: 값이 1을 넘으면 이미 %단위, 1 이하면 소수
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const META_DIR = join(process.cwd(), "data", "meta");

export type TopHolding = {
  symbol: string;
  name: string | null;
  weight: number; // 0.0~1.0
};

export type EtfRichMeta = {
  ticker: string;
  longName: string | null;
  summary: string | null;
  fundFamily: string | null;
  totalAssets: number | null;        // USD
  expenseRatio: number | null;       // 소수 (0.0009 = 0.09%)
  yieldPct: number | null;           // 소수 (0.0344 = 3.44%)
  fundInceptionDate: string | null;
  navPrice: number | null;
  previousClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta3Year: number | null;
  topHoldings: TopHolding[];
  sectorWeightings: Record<string, number>;
};

/**
 * 0~1 사이면 이미 소수, 1 초과면 %단위로 들어온 거로 간주하고 /100.
 * null/undefined 안전 처리.
 */
function fromAlreadyPct(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function fromDecimal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function loadMeta(ticker: string): EtfRichMeta | null {
  const filename = ticker.replace(/\//g, "_") + ".json";
  const filepath = join(META_DIR, filename);

  if (!existsSync(filepath)) return null;

  try {
    const raw = JSON.parse(readFileSync(filepath, "utf-8"));

    // top holdings 정규화
    const holdings: TopHolding[] = Array.isArray(raw.topHoldings)
      ? raw.topHoldings
          .filter((h: { weight?: number | null }) => h && h.weight != null)
          .map((h: { symbol: string; name?: string | null; weight: number }) => ({
            symbol: String(h.symbol || ""),
            name: h.name ?? null,
            weight: Number(h.weight) || 0,
          }))
      : [];

    // sectorWeightings 정규화 (값이 % 단위로 들어올 수 있음)
    const sectors: Record<string, number> = {};
    if (raw.sectorWeightings && typeof raw.sectorWeightings === "object") {
      for (const [k, v] of Object.entries(raw.sectorWeightings)) {
        const n = Number(v);
        if (Number.isFinite(n)) {
          sectors[k] = Math.abs(n) > 1 ? n / 100 : n;
        }
      }
    }

    // inception date: epoch 또는 ISO 문자열
    let inception: string | null = null;
    const ip = raw.fundInceptionDate;
    if (ip) {
      if (typeof ip === "number") {
        // epoch seconds
        const d = new Date(ip * 1000);
        if (!isNaN(d.getTime())) inception = d.toISOString().slice(0, 10);
      } else if (typeof ip === "string") {
        // ISO 문자열 또는 yyyy-mm-dd 비슷한 형태
        const d = new Date(ip);
        if (!isNaN(d.getTime())) inception = d.toISOString().slice(0, 10);
      }
    }

    return {
      ticker: String(raw.ticker || ticker),
      longName: raw.longName ?? null,
      summary: raw.summary ?? null,
      fundFamily: raw.fundFamily ?? null,
      totalAssets: typeof raw.totalAssets === "number" ? raw.totalAssets : null,
      expenseRatio: fromAlreadyPct(raw.expenseRatio),
      yieldPct: fromDecimal(raw.yield),
      fundInceptionDate: inception,
      navPrice: typeof raw.navPrice === "number" ? raw.navPrice : null,
      previousClose: typeof raw.previousClose === "number" ? raw.previousClose : null,
      fiftyTwoWeekHigh: typeof raw.fiftyTwoWeekHigh === "number" ? raw.fiftyTwoWeekHigh : null,
      fiftyTwoWeekLow: typeof raw.fiftyTwoWeekLow === "number" ? raw.fiftyTwoWeekLow : null,
      beta3Year: typeof raw.beta3Year === "number" ? raw.beta3Year : null,
      topHoldings: holdings,
      sectorWeightings: sectors,
    };
  } catch {
    return null;
  }
}

/**
 * 가격 CSV에서 CAGR / MDD 빠르게 계산.
 * loader.ts와 metrics.ts를 활용.
 */
import { loadPrices } from "./loader";
import { calcCAGR, calcMDD } from "./metrics";
import type { EquityPoint } from "./types";

export type EtfPerformance = {
  cagr: number | null;
  mdd: number | null;
  recentClose: number | null;
  recentDate: string | null;
  // 전일 거래량/거래대금 (CSV 마지막 행 기준)
  recentVolume: number | null;
  recentDollarVolume: number | null;
};

export function loadPerformance(ticker: string): EtfPerformance {
  try {
    const series = loadPrices(ticker);
    if (series.rows.length < 2) {
      return {
        cagr: null,
        mdd: null,
        recentClose: null,
        recentDate: null,
        recentVolume: null,
        recentDollarVolume: null,
      };
    }

    // 가치곡선 (AdjClose 기반, 시작 100)
    const first = series.rows[0].adjClose;
    const curve: EquityPoint[] = series.rows.map((r) => ({
      date: r.date,
      value: (r.adjClose / first) * 100,
    }));

    const last = series.rows[series.rows.length - 1];

    return {
      cagr: calcCAGR(curve),
      mdd: calcMDD(curve),
      recentClose: last.close,
      recentDate: last.date,
      recentVolume: last.volume,
      recentDollarVolume: last.close * last.volume,
    };
  } catch {
    return {
      cagr: null,
      mdd: null,
      recentClose: null,
      recentDate: null,
      recentVolume: null,
      recentDollarVolume: null,
    };
  }
}