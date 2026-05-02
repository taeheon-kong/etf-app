/**
 * 백테스트 핵심 지표 6종 + Phase 4 고급 지표.
 * - totalReturn, cagr, mdd, sharpe, sortino, volatility
 * - rollingReturns, regression, captureRatios, tailRisk
 *
 * 지표별 데이터 사용 정책:
 *   MDD, Rolling, Ulcer → 일별 가치곡선 (정확한 깊이 및 가격 기반)
 *   CAGR                → 시작값/최종값 + 기간
 *   Sharpe/Sortino/Vol  → 일별 수익률 → 연환산(√252)
 *   TotalReturn         → 시작값/최종값
 *   Regression/Capture  → 포트폴리오 vs 벤치마크 일별 수익률 비교
 */

import type {
  EquityPoint,
  Metrics,
  RiskFreeMode,
  YearlyReturn,
} from "./types";
import { loadCd91, valueAtOrBefore } from "./macroLoader";

const TRADING_DAYS_PER_YEAR = 252;

// ──────────────────────────────────────────────────────────────
// 통계 헬퍼
// ──────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

/** 표본 분산 (n-1로 나눔). */
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

/** 공분산 (n-1로 나눔). */
function covariance(arrX: number[], arrY: number[]): number {
  if (arrX.length !== arrY.length || arrX.length < 2) return 0;
  const mx = mean(arrX);
  const my = mean(arrY);
  let cov = 0;
  for (let i = 0; i < arrX.length; i++) {
    cov += (arrX[i] - mx) * (arrY[i] - my);
  }
  return cov / (arrX.length - 1);
}

/** 표본 표준편차 (n-1로 나눔). */
function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

/** 다운사이드 표준편차 (음수 수익률만, Sortino용). */
function downsideStddev(arr: number[], target: number = 0): number {
  const downside = arr.filter((x) => x < target).map((x) => x - target);
  if (downside.length < 2) return 0;
  const v = downside.reduce((s, x) => s + x ** 2, 0) / (downside.length - 1);
  return Math.sqrt(v);
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
  irxSeries?: { date: string; rate: number }[],
  korWeight: number = 0,
): number {
  // 평균값(legacy fallback). 정밀 매칭은 dailyRiskFreeSeries() 사용.
  if (mode.type === "none") return 0;

  if (mode.type === "fixed") {
    return Math.pow(1 + mode.rate, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }

  if (mode.type === "dynamic") {
    const cd91 = loadCd91();
    let krAnnual: number | null = null;
    let usAnnual: number | null = null;

    if (cd91.length > 0) {
      krAnnual = cd91.reduce((s, r) => s + r.value, 0) / cd91.length;
    }
    if (irxSeries && irxSeries.length > 0) {
      usAnnual = mean(irxSeries.map((r) => r.rate / 100));
    }

    let blendedAnnual = 0;
    const usWeight = 1 - korWeight;
    if (krAnnual !== null && usAnnual !== null) {
      blendedAnnual = krAnnual * korWeight + usAnnual * usWeight;
    } else if (krAnnual !== null) {
      blendedAnnual = krAnnual;
    } else if (usAnnual !== null) {
      blendedAnnual = usAnnual;
    } else {
      return 0;
    }
    return Math.pow(1 + blendedAnnual, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }
  return 0;
}

/**
 * 시점별 일별 무위험수익률.
 * 각 거래일에 그 시점 CD91 + ^IRX를 가중평균한 일별 비율 반환.
 */
export function dailyRiskFreeSeries(
  dates: string[],
  mode: RiskFreeMode,
  irxSeries: { date: string; rate: number }[] | undefined,
  korWeight: number,
): number[] {
  if (mode.type === "none") return dates.map(() => 0);
  if (mode.type === "fixed") {
    const d = Math.pow(1 + mode.rate, 1 / TRADING_DAYS_PER_YEAR) - 1;
    return dates.map(() => d);
  }
  // dynamic
  const cd91 = loadCd91();
  const irxArr = irxSeries
    ? irxSeries.map((r) => ({ date: r.date, value: r.rate / 100 }))
    : [];
  const usWeight = 1 - korWeight;

  return dates.map((d) => {
    const kr = valueAtOrBefore(cd91, d);
    const us = valueAtOrBefore(irxArr, d);
    let annual = 0;
    if (kr !== null && us !== null) annual = kr * korWeight + us * usWeight;
    else if (kr !== null) annual = kr;
    else if (us !== null) annual = us;
    else return 0;
    return Math.pow(1 + annual, 1 / TRADING_DAYS_PER_YEAR) - 1;
  });
}

// ──────────────────────────────────────────────────────────────
// 개별 지표
// ──────────────────────────────────────────────────────────────

export function calcTotalReturn(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  return curve[curve.length - 1].value / curve[0].value - 1;
}

export function calcCAGR(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  const totalRet = calcTotalReturn(curve);
  const tradingDays = curve.length - 1;
  if (tradingDays <= 0) return 0;
  return Math.pow(1 + totalRet, TRADING_DAYS_PER_YEAR / tradingDays) - 1;
}

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

export function calcVolatility(dailyRets: number[]): number {
  return stddev(dailyRets) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function calcSharpe(
  dailyRets: number[],
  rfDaily: number | number[] = 0,
): number {
  if (dailyRets.length < 2) return 0;
  const excess = Array.isArray(rfDaily)
    ? dailyRets.map((r, i) => r - (rfDaily[i] ?? 0))
    : dailyRets.map((r) => r - rfDaily);
  const sd = stddev(excess);
  if (sd === 0) return 0;
  return (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function calcSortino(
  dailyRets: number[],
  rfDaily: number | number[] = 0,
): number {
  if (dailyRets.length < 2) return 0;
  const excess = Array.isArray(rfDaily)
    ? dailyRets.map((r, i) => r - (rfDaily[i] ?? 0))
    : dailyRets.map((r) => r - rfDaily);
  const ds = downsideStddev(excess, 0);
  if (ds === 0) return 0;
  return (mean(excess) / ds) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// ──────────────────────────────────────────────────────────────
// 통합: 6개 기본 지표 한 번에
// ──────────────────────────────────────────────────────────────

export function calcAllMetrics(
  curve: EquityPoint[],
  dailyRets: number[],
  rfMode: RiskFreeMode = { type: "none" },
  irxSeries?: { date: string; rate: number }[],
  korWeight: number = 0,
): Metrics {
  const retDates = curve.slice(1).map((p) => p.date);
  const rfSeries = dailyRiskFreeSeries(retDates, rfMode, irxSeries, korWeight);
  void dailyRiskFreeRate; // legacy fallback 경고 무시

  return {
    totalReturn: calcTotalReturn(curve),
    cagr: calcCAGR(curve),
    mdd: calcMDD(curve),
    sharpe: calcSharpe(dailyRets, rfSeries),
    sortino: calcSortino(dailyRets, rfSeries),
    volatility: calcVolatility(dailyRets),
  };
}

// ──────────────────────────────────────────────────────────────
// 연도별 수익률
// ──────────────────────────────────────────────────────────────

export function calcYearlyReturns(
  portfolioCurve: EquityPoint[],
  benchmarkCurve: EquityPoint[]
): YearlyReturn[] {
  const portByYear = lastValueByYear(portfolioCurve);
  const benchByYear = lastValueByYear(benchmarkCurve);

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

function lastValueByYear(curve: EquityPoint[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const pt of curve) {
    const year = parseInt(pt.date.slice(0, 4), 10);
    map.set(year, pt.value);
  }
  return map;
}

// ──────────────────────────────────────────────────────────────
// Phase 4: 고급 분석 지표 (Advanced Metrics)
// ──────────────────────────────────────────────────────────────

/** 
 * 1. 롤링 수익률 (1년=252일, 3년=756일, 5년=1260일) 
 * 일별 수익률을 곱할 필요 없이, 가치곡선의 (현재값 / 과거값)을 이용해 정확하고 빠르게 계산합니다.
 */
export function calcRollingReturns(
  curve: EquityPoint[], 
  periods: number[] = [252, 756, 1260]
) {
  const results: Record<number, { min: number; max: number; avg: number; current: number }> = {};
  
  for (const period of periods) {
    if (curve.length <= period) continue;
    
    let minReturn = Infinity;
    let maxReturn = -Infinity;
    let sumReturn = 0;
    let count = 0;
    let currentReturn = 0;

    // period 거래일 전의 가치와 현재 가치를 비교
    for (let i = period; i < curve.length; i++) {
      const pastValue = curve[i - period].value;
      const currentValue = curve[i].value;
      if (pastValue <= 0) continue;

      const periodReturn = (currentValue / pastValue) - 1;
      
      if (periodReturn < minReturn) minReturn = periodReturn;
      if (periodReturn > maxReturn) maxReturn = periodReturn;
      sumReturn += periodReturn;
      count++;
      
      if (i === curve.length - 1) currentReturn = periodReturn;
    }
    
    if (count > 0) {
      results[period] = {
        min: minReturn,
        max: maxReturn,
        avg: sumReturn / count,
        current: currentReturn
      };
    }
  }
  return results;
}

/** 
 * 2. 회귀분석 (Alpha, Beta, R², Tracking Error, Info Ratio, Treynor)
 * 포트폴리오와 벤치마크의 일별 수익률 배열 길이는 같아야 합니다.
 */
export function calcRegressionMetrics(
  portDaily: number[], 
  benchDaily: number[], 
  rfDailyArray: number[]
) {
  if (portDaily.length !== benchDaily.length || portDaily.length < 2) return null;

  const portExcess = portDaily.map((r, i) => r - (rfDailyArray[i] ?? 0));
  const benchExcess = benchDaily.map((r, i) => r - (rfDailyArray[i] ?? 0));

  const cov = covariance(portExcess, benchExcess);
  const varBench = variance(benchExcess);
  const varPort = variance(portExcess);

  // Beta = Cov(Rp, Rb) / Var(Rb)
  const beta = varBench > 0 ? cov / varBench : 1;
  
  // Alpha (연환산): AnnRp - [AnnRf + Beta * (AnnRb - AnnRf)]
  const annPortExcess = mean(portExcess) * TRADING_DAYS_PER_YEAR;
  const annBenchExcess = mean(benchExcess) * TRADING_DAYS_PER_YEAR;
  const alpha = annPortExcess - (beta * annBenchExcess);

  // R-Squared = (Cov(P,B)^2) / (Var(P) * Var(B))
  const rSquared = (varPort > 0 && varBench > 0) ? Math.pow(cov, 2) / (varPort * varBench) : 0;

  // Tracking Error (추적오차 연환산) = StdDev(Rp - Rb) * √252
  const activeReturns = portDaily.map((pr, i) => pr - benchDaily[i]);
  const trackingError = stddev(activeReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Information Ratio = (AnnRp - AnnRb) / TrackingError
  const annPort = mean(portDaily) * TRADING_DAYS_PER_YEAR;
  const annBench = mean(benchDaily) * TRADING_DAYS_PER_YEAR;
  const infoRatio = trackingError > 0 ? (annPort - annBench) / trackingError : 0;

  // Treynor Ratio = (AnnRp - AnnRf) / Beta
  const treynorRatio = beta !== 0 ? annPortExcess / beta : 0;

  return { alpha, beta, rSquared, trackingError, infoRatio, treynorRatio };
}

/**
 * 3. Up/Down Capture Ratio
 * 벤치마크가 상승한 날/하락한 날의 포트폴리오 기하 누적 수익률을 연환산하여 비교.
 */
export function calcCaptureRatios(portDaily: number[], benchDaily: number[]) {
  if (portDaily.length !== benchDaily.length || portDaily.length === 0) return null;

  let upPortProd = 1, upBenchProd = 1, upDays = 0;
  let downPortProd = 1, downBenchProd = 1, downDays = 0;

  for (let i = 0; i < benchDaily.length; i++) {
    const rb = benchDaily[i];
    const rp = portDaily[i];

    if (rb > 0) {
      upPortProd *= (1 + rp);
      upBenchProd *= (1 + rb);
      upDays++;
    } else if (rb < 0) {
      downPortProd *= (1 + rp);
      downBenchProd *= (1 + rb);
      downDays++;
    }
  }

  // 연환산 수익률 (기하) = (누적수익률)^(252 / 해당 조건의 누적일수) - 1
  const annUpPort = upDays > 0 ? Math.pow(upPortProd, TRADING_DAYS_PER_YEAR / upDays) - 1 : 0;
  const annUpBench = upDays > 0 ? Math.pow(upBenchProd, TRADING_DAYS_PER_YEAR / upDays) - 1 : 0;
  const annDownPort = downDays > 0 ? Math.pow(downPortProd, TRADING_DAYS_PER_YEAR / downDays) - 1 : 0;
  const annDownBench = downDays > 0 ? Math.pow(downBenchProd, TRADING_DAYS_PER_YEAR / downDays) - 1 : 0;

  const upCapture = annUpBench !== 0 ? annUpPort / Math.abs(annUpBench) : 0;
  const downCapture = annDownBench !== 0 ? annDownPort / Math.abs(annDownBench) : 0;

  return { upCapture, downCapture };
}

/**
 * 4. 테일 리스크 (Ulcer Index, VaR 95%, CVaR 95%)
 */
export function calcTailRisk(curve: EquityPoint[], dailyRets: number[]) {
  if (curve.length === 0 || dailyRets.length === 0) return null;

  // 4-1. Ulcer Index (낙폭 제곱의 평균의 제곱근, % 단위로 계산)
  let peak = curve[0].value;
  let sumSquaredDrawdowns = 0;
  
  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    const drawdown = peak > 0 ? (pt.value - peak) / peak : 0;
    sumSquaredDrawdowns += Math.pow(drawdown * 100, 2); 
  }
  const ulcerIndex = Math.sqrt(sumSquaredDrawdowns / curve.length);

  // 4-2. VaR & CVaR 95% (Historical Method)
  // 일별 수익률을 오름차순 정렬하여 하위 5% 구간 탐색
  const sortedReturns = [...dailyRets].sort((a, b) => a - b);
  const percentile95Idx = Math.floor(sortedReturns.length * 0.05);
  
  const var95 = sortedReturns[percentile95Idx] ?? 0;
  
  const tailReturns = sortedReturns.slice(0, percentile95Idx);
  const cvar95 = tailReturns.length > 0 ? mean(tailReturns) : var95;

  return { ulcerIndex, var95, cvar95 };
}