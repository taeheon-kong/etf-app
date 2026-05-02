/**
 * 수익률 계산 모듈
 *
 * - 일별 수익률 (단일 종목)
 * - 포트폴리오 일별 수익률 (비중 적용)
 * - 가치 곡선 생성 (100 정규화)
 *
 * 리밸런싱은 portfolio.ts에서 처리, 여기는 순수 계산만.
 */

import type { PriceSeries, EquityPoint } from "./types";

// ──────────────────────────────────────────────────────────────
// 단일 종목 일별 수익률
// ──────────────────────────────────────────────────────────────

/**
 * 한 종목의 일별 수익률 시계열.
 *
 * 입력: PriceSeries (n행)
 * 출력: { date, return }[] (n-1행, 첫날은 "어제"가 없어 제외)
 *
 * 수익률 공식: r_t = adjClose_t / adjClose_(t-1) - 1
 * AdjClose 사용 = 배당 자동 재투자된 가격 → 총수익률 반영
 */
export function dailyReturns(
  series: PriceSeries
): { date: string; ret: number }[] {
  const result: { date: string; ret: number }[] = [];
  const rows = series.rows;

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].adjClose;
    const curr = rows[i].adjClose;

    // 0이나 음수 방어 (이상 데이터 시 NaN 되지 않게)
    if (prev <= 0 || curr <= 0) {
      result.push({ date: rows[i].date, ret: 0 });
      continue;
    }

    result.push({
      date: rows[i].date,
      ret: curr / prev - 1,
    });
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
// 다종목 정렬: 공통 거래일만 추출
// ──────────────────────────────────────────────────────────────

/**
 * 여러 종목의 일별 수익률을 정렬 (Forward Fill 방식).
 *
 * 한국·미국 거래일이 다르므로(설/추석 vs Memorial Day 등) "공통 거래일"만 쓰면
 * 데이터 손실이 큼 → 모든 종목의 거래일 합집합을 사용하고, 누락일은 수익률 0으로 채움.
 *
 * 단, "최초 거래 시작일"은 모든 종목이 데이터를 보유한 시점 이후로 한정 (look-ahead 방지).
 */
export function alignReturns(
  seriesList: { ticker: string; rows: { date: string; ret: number }[] }[]
): {
  dates: string[];
  matrix: number[][];
} {
  if (seriesList.length === 0) {
    return { dates: [], matrix: [] };
  }

  // 각 종목의 날짜→수익률 맵
  const maps = seriesList.map(
    (s) => new Map(s.rows.map((r) => [r.date, r.ret]))
  );

  // 각 종목의 최초 데이터 날짜 (그 종목이 시작하기 전엔 NaN, 그 이후엔 수익률 0으로 fill 가능)
  const firstDates = seriesList.map((s) =>
    s.rows.length > 0 ? s.rows[0].date : "9999-99-99"
  );

  // 모든 종목 거래일의 합집합 정렬
  const allDatesSet = new Set<string>();
  for (const s of seriesList) {
    for (const r of s.rows) allDatesSet.add(r.date);
  }
  const allDates = Array.from(allDatesSet).sort();

  // 최초 시작일 = 모든 종목의 firstDate 중 최댓값 (그 시점에는 모든 종목이 존재)
  const startDate = firstDates.reduce((a, b) => (a > b ? a : b), "0000-00-00");

  // startDate 이후의 날짜만 사용
  const usableDates = allDates.filter((d) => d >= startDate);

  // 행렬 구성: 누락된 날에는 수익률 0 (forward fill에 해당 — 가격 유지)
  const matrix: number[][] = usableDates.map((d) =>
    maps.map((m) => m.get(d) ?? 0)
  );

  return { dates: usableDates, matrix };
}

// ──────────────────────────────────────────────────────────────
// 포트폴리오 일별 수익률 (비중 적용)
// ──────────────────────────────────────────────────────────────

/**
 * 비중 가중 평균 수익률 계산.
 *
 * 매일: portfolio_ret = Σ (weight_i × asset_return_i)
 *
 * 주의: 이 함수는 "비중이 매일 일정하게 유지된다"는 가정.
 * 실제로는 가격 변동에 따라 비중이 표류(drift)하는데,
 * 그 처리는 portfolio.ts의 리밸런싱 로직에서 다룸.
 *
 * @param matrix matrix[t][i]: t시점의 i종목 수익률
 * @param weights 종목별 비중 (합 1.0 기준)
 */
export function weightedReturns(
  matrix: number[][],
  weights: number[]
): number[] {
  return matrix.map((row) =>
    row.reduce((sum, ret, i) => sum + ret * weights[i], 0)
  );
}

// ──────────────────────────────────────────────────────────────
// 가치 곡선 생성
// ──────────────────────────────────────────────────────────────

/**
 * 일별 수익률 → 가치 곡선 (시작값 100).
 *
 * value_0 = 100
 * value_t = value_(t-1) × (1 + return_t)
 *
 * 출력: 시작 시점(value=100)을 포함한 n+1개 포인트.
 *
 * @param returns 일별 수익률 배열
 * @param dates 일별 수익률에 대응하는 날짜 (returns와 길이 같음)
 * @param startDate 시작 시점 날짜 ("어제"에 해당, returns[0]의 전날)
 */
export function buildEquityCurve(
  returns: number[],
  dates: string[],
  startDate: string
): EquityPoint[] {
  const curve: EquityPoint[] = [{ date: startDate, value: 100 }];

  let value = 100;
  for (let i = 0; i < returns.length; i++) {
    value = value * (1 + returns[i]);
    curve.push({ date: dates[i], value });
  }

  return curve;
}