/**
 * CSV 가격 데이터 로더
 *
 * 미국 ETF: data/raw/{TICKER}.csv
 * 한국 ETF: data/raw_kr/{TICKER}.csv (loaderKr.ts 위임)
 *
 * 서버 사이드에서만 동작 (Node.js의 fs 모듈 사용).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { PriceRow, PriceSeries } from "./types";
import { loadKrPrices } from "./loaderKr";

// ──────────────────────────────────────────────────────────────
// 경로 헬퍼
// ──────────────────────────────────────────────────────────────

/** 프로젝트 루트의 data/raw 폴더 경로. */
const DATA_DIR = join(process.cwd(), "data", "raw");

/**
 * 티커를 파일명으로 변환.
 * "^IRX" → "_IRX.csv"  (Python 스크립트와 동일한 규칙)
 */
function tickerToFilename(ticker: string): string {
  return ticker.replace(/\^/g, "_").replace(/\//g, "_") + ".csv";
}

/**
 * 한국 티커 판별: 6자리 숫자 또는 영문/숫자 섞인 6자리 (예: 0043B0)
 * 미국 티커는 보통 1~5자리 영문이고 ^IRX 같은 특수문자 포함.
 */
function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

// ──────────────────────────────────────────────────────────────
// CSV 파싱
// ──────────────────────────────────────────────────────────────

function parseCsv(text: string): PriceRow[] {
  const lines = text.trim().split("\n");
  const rows: PriceRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",");
    if (cols.length < 8) continue;

    rows.push({
      date: cols[0],
      open: Number(cols[1]),
      high: Number(cols[2]),
      low: Number(cols[3]),
      close: Number(cols[4]),
      adjClose: Number(cols[5]),
      volume: Number(cols[6]),
      dividends: Number(cols[7]),
    });
  }

  return rows;
}

// ──────────────────────────────────────────────────────────────
// 공개 함수
// ──────────────────────────────────────────────────────────────

/**
 * 단일 티커의 가격 시계열 로드.
 * 한국 티커(6자리 숫자/영숫자)면 loaderKr.loadKrPrices로 위임.
 */
export function loadPrices(ticker: string): PriceSeries {
  // 한국 티커 자동 분기
  if (isKoreanTicker(ticker)) {
    return loadKrPrices(ticker);
  }

  const filename = tickerToFilename(ticker);
  const filepath = join(DATA_DIR, filename);

  if (!existsSync(filepath)) {
    throw new Error(
      `가격 데이터 파일이 없습니다: ${filepath}\n` +
      `먼저 'python scripts/fetch_prices.py ${ticker}'를 실행하세요.`
    );
  }

  const text = readFileSync(filepath, "utf-8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    throw new Error(`${ticker}: CSV가 비어있거나 파싱 실패`);
  }

  return { ticker, rows };
}

export function loadMultiple(tickers: string[]): PriceSeries[] {
  return tickers.map((t) => loadPrices(t));
}

export function sliceByDate(
  series: PriceSeries,
  startDate: string,
  endDate: string,
): PriceSeries {
  const filtered = series.rows.filter(
    (r) => r.date >= startDate && r.date <= endDate
  );
  return { ticker: series.ticker, rows: filtered };
}