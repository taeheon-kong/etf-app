/**
 * 백테스트 핵심 지표 6종 + Phase 4 고급 지표 + 상세 성과 지표.
 */

import type {
  EquityPoint,
  Metrics,
  RiskFreeMode,
  YearlyReturn,
} from "./types";
import { loadCd91, valueAtOrBefore } from "./macroLoader";

const TRADING_DAYS_PER_YEAR = 252;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

// ──────────────────────────────────────────────────────────────
// Phase 4 추가 — 구간별 수익률 / 자산 기여도
// ──────────────────────────────────────────────────────────────

/**
 * 구간별 수익률 (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y).
 * 가치곡선 마지막 시점 기준으로 N영업일 전 대비 수익률.
 */
export function calcPeriodReturns(curve: EquityPoint[]) {
  const periods: { label: string; days: number }[] = [
    { label: "1M", days: 21 },
    { label: "3M", days: 63 },
    { label: "6M", days: 126 },
    { label: "YTD", days: -1 }, // 특별 처리
    { label: "1Y", days: 252 },
    { label: "3Y", days: 756 },
    { label: "5Y", days: 1260 },
  ];

  if (curve.length === 0) return periods.map((p) => ({ label: p.label, return: 0, available: false }));

  const lastIdx = curve.length - 1;
  const lastValue = curve[lastIdx].value;
  const lastDate = curve[lastIdx].date;
  const lastYear = lastDate.slice(0, 4);

  return periods.map((p) => {
    if (p.days === -1) {
      // YTD: 같은 해 첫 거래일 찾기
      const ytdStart = curve.findIndex((pt) => pt.date.startsWith(lastYear));
      if (ytdStart < 0 || ytdStart === lastIdx) {
        return { label: p.label, return: 0, available: false };
      }
      const startVal = curve[ytdStart].value;
      return {
        label: p.label,
        return: lastValue / startVal - 1,
        available: true,
      };
    }
    const targetIdx = lastIdx - p.days;
    if (targetIdx < 0) {
      return { label: p.label, return: 0, available: false };
    }
    const startVal = curve[targetIdx].value;
    if (startVal <= 0) return { label: p.label, return: 0, available: false };
    return {
      label: p.label,
      return: lastValue / startVal - 1,
      available: true,
    };
  });
}

/**
 * 자산별 수익 기여도.
 *
 * 기여도 = 비중 × 종목 누적수익률
 * 합산 = 포트폴리오 총수익률 (리밸런싱 무시 시 근사치)
 *
 * 정확한 기여도는 시점별 비중 변화를 고려해야 하지만,
 * 시각화 목적으로는 단순 가중 기여도로 충분.
 */
export function calcAssetContributions(
  prices: { ticker: string; rows: { date: string; adjClose: number; dividends: number }[] }[],
  weights: number[],
  startDate: string,
  endDate: string,
) {
  const byAsset = prices.map((p, i) => {
    const inRange = p.rows.filter((r) => r.date >= startDate && r.date <= endDate);
    if (inRange.length < 2) {
      return {
        ticker: p.ticker,
        weight: weights[i],
        totalReturn: 0,
        contribution: 0,
        contributionPct: 0,
      };
    }
    const startPx = inRange[0].adjClose;
    const endPx = inRange[inRange.length - 1].adjClose;
    if (startPx <= 0) {
      return {
        ticker: p.ticker,
        weight: weights[i],
        totalReturn: 0,
        contribution: 0,
        contributionPct: 0,
      };
    }
    const totalReturn = endPx / startPx - 1;
    const contribution = weights[i] * totalReturn;
    return {
      ticker: p.ticker,
      weight: weights[i],
      totalReturn,
      contribution,
      contributionPct: 0, // 아래서 채움
    };
  });

  const totalContrib = byAsset.reduce((s, a) => s + a.contribution, 0);
  if (totalContrib !== 0) {
    for (const a of byAsset) {
      a.contributionPct = a.contribution / totalContrib;
    }
  }

  // 주가 vs 배당 기여도 분리
  // adjClose 사용했으므로 totalReturn에 배당 재투자 포함
  // close 기준으로 가격 수익률만 따로 계산해서 차이 = 배당 기여
  let priceTotalRet = 0;
  let withDivTotalRet = 0;
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    const inRange = p.rows.filter((r) => r.date >= startDate && r.date <= endDate);
    if (inRange.length < 2) continue;
    const adjStart = inRange[0].adjClose;
    const adjEnd = inRange[inRange.length - 1].adjClose;

    // close 데이터가 있으면 사용. 없으면 배당 기여 0으로
    // (rows에 close가 없는 경우 대비 — 이 함수는 PriceRow 전체를 받지 않음)
    const adjRet = adjStart > 0 ? adjEnd / adjStart - 1 : 0;
    withDivTotalRet += weights[i] * adjRet;

    // 가격만의 수익률은 dividends 누적분 차감으로 추정
    // adjClose는 배당 재투자 반영, 따라서 close 기준 수익률 추정 어려움
    // 단순화: 종목별 dividends 합 / 시작가격 = 배당수익률 추정
    let divSum = 0;
    for (const r of inRange) divSum += r.dividends;
    const divYield = adjStart > 0 ? divSum / adjStart : 0;
    const priceOnlyRet = adjRet - divYield;
    priceTotalRet += weights[i] * priceOnlyRet;
  }

  const divContrib = withDivTotalRet - priceTotalRet;
  const totalAbs = Math.abs(priceTotalRet) + Math.abs(divContrib);
  const priceContributionPct = totalAbs > 0 ? Math.abs(priceTotalRet) / totalAbs : 1;
  const dividendContributionPct = totalAbs > 0 ? Math.abs(divContrib) / totalAbs : 0;

  return {
    byAsset,
    priceContributionPct,
    dividendContributionPct,
  };
}

/**
 * Phase 4용 주요 하락기 (TopN, 회복 일수 + null 처리).
 * 기존 calcDrawdowns는 정렬 후 5개만 자르는 단순 버전.
 * 이건 더 풍부한 정보를 반환.
 */
export function calcTopDrawdowns(curve: EquityPoint[], topN: number = 5) {
  if (curve.length === 0) return [];

  type Period = {
    peakDate: string;
    peakIdx: number;
    troughDate: string;
    troughIdx: number;
    recoveryDate: string | null;
    recoveryIdx: number | null;
    depth: number;
  };

  const periods: Period[] = [];
  let peak = curve[0].value;
  let peakIdx = 0;
  let trough = curve[0].value;
  let troughIdx = 0;
  let inDrawdown = false;

  for (let i = 1; i < curve.length; i++) {
    const v = curve[i].value;
    if (v >= peak) {
      if (inDrawdown) {
        periods.push({
          peakDate: curve[peakIdx].date,
          peakIdx,
          troughDate: curve[troughIdx].date,
          troughIdx,
          recoveryDate: curve[i].date,
          recoveryIdx: i,
          depth: trough / peak - 1,
        });
        inDrawdown = false;
      }
      peak = v;
      peakIdx = i;
      trough = v;
      troughIdx = i;
    } else {
      if (!inDrawdown) {
        inDrawdown = true;
        trough = v;
        troughIdx = i;
      } else if (v < trough) {
        trough = v;
        troughIdx = i;
      }
    }
  }

  // 회복 못한 진행 중인 하락기
  if (inDrawdown) {
    periods.push({
      peakDate: curve[peakIdx].date,
      peakIdx,
      troughDate: curve[troughIdx].date,
      troughIdx,
      recoveryDate: null,
      recoveryIdx: null,
      depth: trough / peak - 1,
    });
  }

  return periods
    .sort((a, b) => a.depth - b.depth)
    .slice(0, topN)
    .map((p) => ({
      peakDate: p.peakDate,
      troughDate: p.troughDate,
      recoveryDate: p.recoveryDate,
      depth: p.depth,
      declineDays: p.troughIdx - p.peakIdx,
      recoveryDays: p.recoveryIdx !== null ? p.recoveryIdx - p.troughIdx : null,
      totalDays: p.recoveryIdx !== null ? p.recoveryIdx - p.peakIdx : null,
    }));
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

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

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function downsideStddev(arr: number[], target: number = 0): number {
  const downside = arr.filter((x) => x < target).map((x) => x - target);
  if (downside.length < 2) return 0;
  const v = downside.reduce((s, x) => s + x ** 2, 0) / (downside.length - 1);
  return Math.sqrt(v);
}

function dailyRiskFreeRate(
  mode: RiskFreeMode,
  irxSeries?: { date: string; rate: number }[],
  korWeight: number = 0,
): number {
  if (mode.type === "none") return 0;
  if (mode.type === "fixed") {
    return Math.pow(1 + mode.rate, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }
  if (mode.type === "dynamic") {
    const cd91 = loadCd91();
    let krAnnual: number | null = null;
    let usAnnual: number | null = null;
    if (cd91.length > 0) krAnnual = cd91.reduce((s, r) => s + r.value, 0) / cd91.length;
    if (irxSeries && irxSeries.length > 0) usAnnual = mean(irxSeries.map((r) => r.rate / 100));

    let blendedAnnual = 0;
    const usWeight = 1 - korWeight;
    if (krAnnual !== null && usAnnual !== null) blendedAnnual = krAnnual * korWeight + usAnnual * usWeight;
    else if (krAnnual !== null) blendedAnnual = krAnnual;
    else if (usAnnual !== null) blendedAnnual = usAnnual;
    else return 0;
    return Math.pow(1 + blendedAnnual, 1 / TRADING_DAYS_PER_YEAR) - 1;
  }
  return 0;
}

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
  const cd91 = loadCd91();
  const irxArr = irxSeries ? irxSeries.map((r) => ({ date: r.date, value: r.rate / 100 })) : [];
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

export function calcSharpe(dailyRets: number[], rfDaily: number | number[] = 0): number {
  if (dailyRets.length < 2) return 0;
  const excess = Array.isArray(rfDaily)
    ? dailyRets.map((r, i) => r - (rfDaily[i] ?? 0))
    : dailyRets.map((r) => r - rfDaily);
  const sd = stddev(excess);
  if (sd === 0) return 0;
  return (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function calcSortino(dailyRets: number[], rfDaily: number | number[] = 0): number {
  if (dailyRets.length < 2) return 0;
  const excess = Array.isArray(rfDaily)
    ? dailyRets.map((r, i) => r - (rfDaily[i] ?? 0))
    : dailyRets.map((r) => r - rfDaily);

  const meanExcess = mean(excess);

  // 다운사이드: 초과수익률이 음수인 날만, 0과의 편차 제곱 평균 → √
  // (target = 0 of excess return = 무위험 미달분)
  const downside = excess.filter((x) => x < 0);
  if (downside.length < 2) return 0;
  const downsideVar = downside.reduce((s, x) => s + x * x, 0) / (downside.length - 1);
  const downsideDev = Math.sqrt(downsideVar);

  if (downsideDev === 0) return 0;
  return (meanExcess / downsideDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function calcAllMetrics(
  curve: EquityPoint[],
  dailyRets: number[],
  rfMode: RiskFreeMode = { type: "none" },
  irxSeries?: { date: string; rate: number }[],
  korWeight: number = 0,
): Metrics {
  const retDates = curve.slice(1).map((p) => p.date);
  const rfSeries = dailyRiskFreeSeries(retDates, rfMode, irxSeries, korWeight);
  void dailyRiskFreeRate;

  return {
    totalReturn: calcTotalReturn(curve),
    cagr: calcCAGR(curve),
    mdd: calcMDD(curve),
    sharpe: calcSharpe(dailyRets, rfSeries),
    sortino: calcSortino(dailyRets, rfSeries),
    volatility: calcVolatility(dailyRets),
  };
}

export function calcYearlyReturns(portfolioCurve: EquityPoint[], benchmarkCurve: EquityPoint[]): YearlyReturn[] {
  const portByYear = lastValueByYear(portfolioCurve);
  const benchByYear = lastValueByYear(benchmarkCurve);
  const years = Array.from(new Set([...portByYear.keys(), ...benchByYear.keys()])).sort();

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

export function calcRollingReturns(curve: EquityPoint[], periods: number[] = [252, 756, 1260]) {
  const results: Record<number, { min: number; max: number; avg: number; current: number }> = {};
  for (const period of periods) {
    if (curve.length <= period) continue;
    let minReturn = Infinity; let maxReturn = -Infinity; let sumReturn = 0; let count = 0; let currentReturn = 0;
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
    if (count > 0) results[period] = { min: minReturn, max: maxReturn, avg: sumReturn / count, current: currentReturn };
  }
  return results;
}

export function calcRegressionMetrics(portDaily: number[], benchDaily: number[], rfDailyArray: number[]) {
  if (portDaily.length !== benchDaily.length || portDaily.length < 2) return null;
  const portExcess = portDaily.map((r, i) => r - (rfDailyArray[i] ?? 0));
  const benchExcess = benchDaily.map((r, i) => r - (rfDailyArray[i] ?? 0));
  const cov = covariance(portExcess, benchExcess);
  const varBench = variance(benchExcess);
  const varPort = variance(portExcess);

  const beta = varBench > 0 ? cov / varBench : 1;
  const annPortExcess = mean(portExcess) * TRADING_DAYS_PER_YEAR;
  const annBenchExcess = mean(benchExcess) * TRADING_DAYS_PER_YEAR;
  const alpha = annPortExcess - (beta * annBenchExcess);
  const rSquared = (varPort > 0 && varBench > 0) ? Math.pow(cov, 2) / (varPort * varBench) : 0;
  const activeReturns = portDaily.map((pr, i) => pr - benchDaily[i]);
  const trackingError = stddev(activeReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const annPort = mean(portDaily) * TRADING_DAYS_PER_YEAR;
  const annBench = mean(benchDaily) * TRADING_DAYS_PER_YEAR;
  const infoRatio = trackingError > 0 ? (annPort - annBench) / trackingError : 0;
  const treynorRatio = beta !== 0 ? annPortExcess / beta : 0;
  return { alpha, beta, rSquared, trackingError, infoRatio, treynorRatio };
}

export function calcCaptureRatios(portDaily: number[], benchDaily: number[]) {
  if (portDaily.length !== benchDaily.length || portDaily.length === 0) return null;

  let upPortProd = 1, upBenchProd = 1, upDays = 0;
  let downPortProd = 1, downBenchProd = 1, downDays = 0;

  for (let i = 0; i < benchDaily.length; i++) {
    const rb = benchDaily[i];
    const rp = portDaily[i];
    if (rb > 0) {
      upPortProd *= 1 + rp;
      upBenchProd *= 1 + rb;
      upDays++;
    } else if (rb < 0) {
      downPortProd *= 1 + rp;
      downBenchProd *= 1 + rb;
      downDays++;
    }
  }

  // 연환산 누적수익률
  const annUpPort = upDays > 0 ? Math.pow(upPortProd, TRADING_DAYS_PER_YEAR / upDays) - 1 : 0;
  const annUpBench = upDays > 0 ? Math.pow(upBenchProd, TRADING_DAYS_PER_YEAR / upDays) - 1 : 0;
  const annDownPort = downDays > 0 ? Math.pow(downPortProd, TRADING_DAYS_PER_YEAR / downDays) - 1 : 0;
  const annDownBench = downDays > 0 ? Math.pow(downBenchProd, TRADING_DAYS_PER_YEAR / downDays) - 1 : 0;

  // Up Capture: 벤치 상승장에서 포트폴리오가 얼마나 따라갔나
  // 부호 그대로. 벤치 양수, 포트도 양수면 양수 비율.
  const upCapture = annUpBench !== 0 ? annUpPort / annUpBench : 0;

  // Down Capture: 벤치 하락장에서 포트폴리오가 얼마나 떨어졌나
  // 둘 다 음수 → 음수/음수 = 양수. 100% = 똑같이 떨어짐, 70% = 덜 떨어짐(좋음), 130% = 더 떨어짐(나쁨)
  const downCapture = annDownBench !== 0 ? annDownPort / annDownBench : 0;

  return { upCapture, downCapture };
}

export function calcTailRisk(curve: EquityPoint[], dailyRets: number[]) {
  if (curve.length === 0 || dailyRets.length === 0) return null;
  let peak = curve[0].value;
  let sumSquaredDrawdowns = 0;
  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    const drawdown = peak > 0 ? (pt.value - peak) / peak : 0;
    sumSquaredDrawdowns += Math.pow(drawdown * 100, 2); 
  }
  const ulcerIndex = Math.sqrt(sumSquaredDrawdowns / curve.length);
  const sortedReturns = [...dailyRets].sort((a, b) => a - b);
  const percentile95Idx = Math.floor(sortedReturns.length * 0.05);
  const var95 = sortedReturns[percentile95Idx] ?? 0;
  const tailReturns = sortedReturns.slice(0, percentile95Idx);
  const cvar95 = tailReturns.length > 0 ? mean(tailReturns) : var95;
  return { ulcerIndex, var95, cvar95 };
}

export function calcDrawdowns(curve: EquityPoint[]) {
  const drawdowns: { depth: number; peakDate: string; troughDate: string; recoveryDate: string | null; days: number }[] = [];
  if (curve.length === 0) return drawdowns;

  let peak = curve[0].value;
  let peakDate = curve[0].date;
  let trough = curve[0].value;
  let troughDate = curve[0].date;
  let inDrawdown = false;

  for (let i = 1; i < curve.length; i++) {
    const pt = curve[i];

    if (pt.value >= peak) {
      if (inDrawdown) {
        drawdowns.push({
          depth: (trough - peak) / peak,
          peakDate, troughDate, recoveryDate: pt.date,
          days: i - curve.findIndex((c) => c.date === peakDate)
        });
        inDrawdown = false;
      }
      peak = pt.value; peakDate = pt.date; trough = pt.value; troughDate = pt.date;
    } else {
      if (!inDrawdown) {
        inDrawdown = true; trough = pt.value; troughDate = pt.date;
      } else {
        if (pt.value < trough) { trough = pt.value; troughDate = pt.date; }
      }
    }
  }

  if (inDrawdown) {
    drawdowns.push({
      depth: (trough - peak) / peak,
      peakDate, troughDate, recoveryDate: null,
      days: curve.length - 1 - curve.findIndex((c) => c.date === peakDate)
    });
  }
  return drawdowns.sort((a, b) => a.depth - b.depth).slice(0, 5);
}

// ✅ 스크린샷 2번에 등장하는 상세 성과 지표(승률, 칼마, 최고/최저) 헬퍼 함수 추가
export function calcExtendedPerformanceMetrics(curve: EquityPoint[], dailyRets: number[], cagr: number, mdd: number, yearlyReturns: YearlyReturn[]) {
  // 1. 칼마 비율
  const calmarRatio = mdd < 0 ? cagr / Math.abs(mdd) : 0;

  // 2. 월별 수익률 = 이번달 마지막 거래일 / 전달 마지막 거래일 - 1
  // 각 월의 마지막 가치만 추출
  const lastValByMonth = new Map<string, number>();
  for (const pt of curve) {
    const monthKey = pt.date.slice(0, 7);
    lastValByMonth.set(monthKey, pt.value); // 같은 월이면 덮어써서 마지막 값 유지
  }

  const monthKeys = Array.from(lastValByMonth.keys()).sort();
  let positiveMonths = 0;
  let bestMonth = -Infinity;
  let monthCount = 0;

  for (let i = 1; i < monthKeys.length; i++) {
    const prev = lastValByMonth.get(monthKeys[i - 1])!;
    const curr = lastValByMonth.get(monthKeys[i])!;
    if (prev <= 0) continue;
    const ret = curr / prev - 1;
    if (ret > 0) positiveMonths++;
    if (ret > bestMonth) bestMonth = ret;
    monthCount++;
  }

  const winRate = monthCount > 0 ? positiveMonths / monthCount : 0;

  // 3. 최고/최저 연도
  let bestYear = -Infinity;
  let worstYear = Infinity;
  if (yearlyReturns.length > 0) {
    const portYears = yearlyReturns.map((y) => y.portfolio);
    bestYear = Math.max(...portYears);
    worstYear = Math.min(...portYears);
  }

  return {
    calmarRatio,
    winRate,
    bestMonth: bestMonth === -Infinity ? 0 : bestMonth,
    bestYear: bestYear === -Infinity ? 0 : bestYear,
    worstYear: worstYear === Infinity ? 0 : worstYear,
  };
}