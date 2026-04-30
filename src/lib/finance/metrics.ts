/**
 * 백테스트 핵심 지표 6종.
 * - totalReturn, cagr, mdd, sharpe, sortino, volatility
 *
 * 지표별 데이터 사용 정책:
 *   MDD       → 일별 가치곡선 (정확한 깊이)
 *   CAGR      → 시작값/최종값 + 기간
 *   Sharpe/Sortino/Vol → 일별 수익률 → 연환산(√252)
 *   TotalReturn → 시작값/최종값
 */

import type {
  EquityPoint,
  Metrics,
  RiskFreeMode,
  YearlyReturn,
} from "./types";

const TRADING_DAYS_PER_YEAR = 252;

// ──────────────────────────────────────────────────────────────
// 통계 헬퍼
// ──────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

/** 표본 표준편차 (n-1로 나눔). */
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/** 다운사이드 표준편차 (음수 수익률만, Sortino용). */
function downsideStddev(arr: number[], target: number = 0): number {
  const downside = arr.filter((x) => x < target).map((x) => x - target);
  if (downside.length < 2) return 0;
  const variance =
    downside.reduce((s, x) => s + x ** 2, 0) / (downside.length - 1);
  return Math.sqrt(variance);
}

// ──────────────────────────────────────────────────────────────
// 무위험 수익률 처리 (일별 단위로 변환)
// ──────────────────────────────────────────────────────────────

/**
 * 무위험 수익률을 "일별 수익률" 단위로 반환.
 *
 * - none:    0
 * - fixed:   연 r → 일별 (1+r)^(1/252) - 1
 * - dynamic: irxSeries 일별 평균을 사용 (^IRX는 연환산 % 단위)
 */
function dailyRiskFreeRate(
  mode: RiskFreeMode,
  irxSeries?: { date: string; rate: number }[]
): number {
  if (mode.type === "none") return 0;

  if (mode.type === "fixed") {
    return Math.pow(1 + mode.rate, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }

  // dynamic: ^IRX 평균 사용 (간단화 — 시점별 동적 매칭은 Phase 4에서)
  if (mode.type === "dynamic") {
    if (!irxSeries || irxSeries.length === 0) return 0;
    const avgAnnual = mean(irxSeries.map((r) => r.rate / 100));
    return Math.pow(1 + avgAnnual, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }

  return 0;
}

// ──────────────────────────────────────────────────────────────
// 개별 지표
// ──────────────────────────────────────────────────────────────

/** 총수익률 = 최종값/시작값 - 1 */
export function calcTotalReturn(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  return curve[curve.length - 1].value / curve[0].value - 1;
}

/**
 * CAGR = (1 + totalReturn)^(252/days) - 1
 * (거래일 기준 연환산. 캘린더 일 기준이 아닌 점 주의)
 */
export function calcCAGR(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  const totalRet = calcTotalReturn(curve);
  const tradingDays = curve.length - 1;
  if (tradingDays <= 0) return 0;
  return Math.pow(1 + totalRet, TRADING_DAYS_PER_YEAR / tradingDays) - 1;
}

/**
 * MDD (최대 낙폭).
 * 가치곡선의 모든 점에서 "이전 최고점 대비 하락률" 중 가장 큰 값.
 * 음수로 반환 (예: -0.34 = -34%).
 */
export function calcMDD(curve: EquityPoint[]): number {
  if (curve.length === 0) return 0;
  let peak = curve[0].value;
  let mdd = 0;

  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    const drawdown = pt.value / peak - 1;
    if (drawdown < mdd) mdd = drawdown;
  }

  return mdd;
}

/**
 * 변동성 (연환산 표준편차).
 * 일별 수익률의 표본표준편차 × √252
 */
export function calcVolatility(dailyRets: number[]): number {
  return stddev(dailyRets) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Sharpe = (평균초과수익률 / 표준편차) × √252
 *   초과수익률 = 일별 수익률 - 일별 무위험 수익률
 */
export function calcSharpe(
  dailyRets: number[],
  rfDaily: number = 0
): number {
  if (dailyRets.length < 2) return 0;
  const excess = dailyRets.map((r) => r - rfDaily);
  const sd = stddev(excess);
  if (sd === 0) return 0;
  return (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Sortino = (평균초과수익률 / 다운사이드편차) × √252
 *   다운사이드편차: 0 미만(또는 target 미만) 수익률만 사용
 */
export function calcSortino(
  dailyRets: number[],
  rfDaily: number = 0
): number {
  if (dailyRets.length < 2) return 0;
  const excess = dailyRets.map((r) => r - rfDaily);
  const ds = downsideStddev(excess, 0);
  if (ds === 0) return 0;
  return (mean(excess) / ds) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// ──────────────────────────────────────────────────────────────
// 통합: 6개 지표 한 번에
// ──────────────────────────────────────────────────────────────

/**
 * 가치곡선 + 일별수익률 → 6개 지표.
 *
 * @param curve 가치곡선 (시작점 포함, 길이 = dailyRets.length + 1)
 * @param dailyRets 일별 수익률 배열
 * @param rfMode 무위험 수익률 모드
 * @param irxSeries dynamic 모드 시 ^IRX 일별 데이터
 */
export function calcAllMetrics(
  curve: EquityPoint[],
  dailyRets: number[],
  rfMode: RiskFreeMode = { type: "none" },
  irxSeries?: { date: string; rate: number }[]
): Metrics {
  const rfDaily = dailyRiskFreeRate(rfMode, irxSeries);

  return {
    totalReturn: calcTotalReturn(curve),
    cagr: calcCAGR(curve),
    mdd: calcMDD(curve),
    sharpe: calcSharpe(dailyRets, rfDaily),
    sortino: calcSortino(dailyRets, rfDaily),
    volatility: calcVolatility(dailyRets),
  };
}

// ──────────────────────────────────────────────────────────────
// 연도별 수익률
// ──────────────────────────────────────────────────────────────

/**
 * 가치곡선에서 "연도별 수익률" 추출.
 * 각 연도의 마지막 거래일 가치 / 전년도 마지막 가치 - 1.
 *
 * 첫 해는 시작 시점 가치 기준.
 */
export function calcYearlyReturns(
  portfolioCurve: EquityPoint[],
  benchmarkCurve: EquityPoint[]
): YearlyReturn[] {
  // 연도별 마지막 가치 추출
  const portByYear = lastValueByYear(portfolioCurve);
  const benchByYear = lastValueByYear(benchmarkCurve);

  // 연속 연도 키 (정렬)
  const years = Array.from(
    new Set([...portByYear.keys(), ...benchByYear.keys()])
  ).sort();

  const result: YearlyReturn[] = [];
  let prevPort = portfolioCurve[0]?.value ?? 100;
  let prevBench = benchmarkCurve[0]?.value ?? 100;

  for (const year of years) {
    const currPort = portByYear.get(year);
    const currBench = benchByYear.get(year);
    if (currPort === undefined || currBench === undefined) continue;

    result.push({
      year,
      portfolio: currPort / prevPort - 1,
      benchmark: currBench / prevBench - 1,
    });

    prevPort = currPort;
    prevBench = currBench;
  }

  return result;
}

/** 가치곡선에서 각 연도의 마지막 값 추출. */
function lastValueByYear(curve: EquityPoint[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const pt of curve) {
    const year = parseInt(pt.date.slice(0, 4), 10);
    map.set(year, pt.value); // 같은 연도면 덮어써서 마지막 값 유지
  }
  return map;
}