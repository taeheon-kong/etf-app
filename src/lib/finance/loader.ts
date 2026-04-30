/**
 * CSV 가격 데이터 로더
 *
 * data/raw/{TICKER}.csv 파일을 읽어 PriceSeries 객체로 변환한다.
 * 서버 사이드에서만 동작 (Node.js의 fs 모듈 사용).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { PriceRow, PriceSeries } from "./types";

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

// ──────────────────────────────────────────────────────────────
// CSV 파싱
// ──────────────────────────────────────────────────────────────

/**
 * CSV 텍스트를 PriceRow 배열로 변환.
 *
 * 첫 줄은 헤더라 건너뛰고, 나머지 줄을 콤마로 잘라 객체로 만든다.
 * 빈 줄이나 잘못된 줄은 무시.
 */
function parseCsv(text: string): PriceRow[] {
  const lines = text.trim().split("\n");
  const rows: PriceRow[] = [];

  // 첫 줄(헤더) 건너뛰고 1번 인덱스부터
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;  // 빈 줄 스킵

    const cols = line.split(",");
    if (cols.length < 8) continue;  // 컬럼 부족하면 스킵

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
 *
 * @param ticker 티커 심볼 ("SPY", "QQQ", "^IRX" 등)
 * @returns 날짜 오름차순으로 정렬된 PriceSeries
 * @throws 파일이 없거나 비어있으면 에러
 */
export function loadPrices(ticker: string): PriceSeries {
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

/**
 * 여러 티커를 한 번에 로드.
 *
 * @param tickers 티커 배열
 * @returns 티커별 PriceSeries 배열 (입력 순서 유지)
 */
export function loadMultiple(tickers: string[]): PriceSeries[] {
  return tickers.map((t) => loadPrices(t));
}

/**
 * 특정 날짜 범위로 자른 PriceSeries 반환.
 *
 * @param series 원본 시계열
 * @param startDate "YYYY-MM-DD" (포함)
 * @param endDate "YYYY-MM-DD" (포함)
 */
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