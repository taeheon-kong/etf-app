/**
 * 한국 ETF 가격 데이터 로더 + CAGR/MDD 계산.
 *
 * data/raw_kr/{TICKER}.csv 형식:
 *   Date,Open,High,Low,Close,AdjClose,Volume,Dividends
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { calcCAGR, calcMDD } from "./metrics";
import type { EquityPoint, PriceSeries, PriceRow } from "./types";

const DATA_DIR = join(process.cwd(), "data", "raw_kr");

export type KrPerformance = {
  cagr: number | null;
  mdd: number | null;
  recentClose: number | null;
  recentDate: string | null;
  recentVolume: number | null;
  recentDollarVolume: number | null;
  rowCount: number;
};

function parseCsv(text: string): PriceRow[] {
  const lines = text.trim().split("\n");
  const rows: PriceRow[] = [];
  const header = lines[0].split(",").map((s) => s.trim());
  const idxDate = header.indexOf("Date");
  const idxOpen = header.indexOf("Open");
  const idxHigh = header.indexOf("High");
  const idxLow = header.indexOf("Low");
  const idxClose = header.indexOf("Close");
  const idxAdj = header.indexOf("AdjClose");
  const idxVol = header.indexOf("Volume");
  const idxDiv = header.indexOf("Dividends");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < header.length) continue;

    const date = cols[idxDate];
    const close = Number(cols[idxClose]);
    const adjClose = idxAdj >= 0 ? Number(cols[idxAdj]) : close;
    if (!date || !Number.isFinite(adjClose)) continue;

    rows.push({
      date,
      open: idxOpen >= 0 ? Number(cols[idxOpen]) : close,
      high: idxHigh >= 0 ? Number(cols[idxHigh]) : close,
      low: idxLow >= 0 ? Number(cols[idxLow]) : close,
      close,
      adjClose,
      volume: idxVol >= 0 ? Number(cols[idxVol]) : 0,
      dividends: idxDiv >= 0 ? Number(cols[idxDiv]) : 0,
    });
  }
  return rows;
}

/** 한국 ETF 가격 시계열 로드 (백테스트용). */
export function loadKrPrices(ticker: string): PriceSeries {
  const filepath = join(DATA_DIR, `${ticker}.csv`);
  if (!existsSync(filepath)) {
    throw new Error(`한국 ETF 가격 데이터 없음: ${ticker}`);
  }
  const text = readFileSync(filepath, "utf-8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error(`${ticker}: CSV가 비어있거나 파싱 실패`);
  }
  return { ticker, rows };
}

/** 한국 ETF 성과 지표 계산 (CAGR, MDD 등). */
export function loadKrPerformance(ticker: string): KrPerformance {
  const filepath = join(DATA_DIR, `${ticker}.csv`);
  if (!existsSync(filepath)) {
    return {
      cagr: null,
      mdd: null,
      recentClose: null,
      recentDate: null,
      recentVolume: null,
      recentDollarVolume: null,
      rowCount: 0,
    };
  }
  try {
    const text = readFileSync(filepath, "utf-8");
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return {
        cagr: null,
        mdd: null,
        recentClose: null,
        recentDate: null,
        recentVolume: null,
        recentDollarVolume: null,
        rowCount: rows.length,
      };
    }
    const first = rows[0].adjClose;
    const curve: EquityPoint[] = rows.map((r) => ({
      date: r.date,
      value: (r.adjClose / first) * 100,
    }));
    const last = rows[rows.length - 1];
    return {
      cagr: calcCAGR(curve),
      mdd: calcMDD(curve),
      recentClose: last.close,
      recentDate: last.date,
      recentVolume: last.volume,
      recentDollarVolume: last.close * last.volume,
      rowCount: rows.length,
    };
  } catch {
    return {
      cagr: null,
      mdd: null,
      recentClose: null,
      recentDate: null,
      recentVolume: null,
      recentDollarVolume: null,
      rowCount: 0,
    };
  }
}