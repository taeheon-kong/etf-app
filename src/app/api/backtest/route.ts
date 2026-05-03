import { NextResponse } from "next/server";
import type {
  BacktestRequest,
  BacktestResult,
  PriceSeries,
  DcaOptions,
  DcaResult,
  TaxOptions,
  MergedSimResult,
} from "@/lib/finance/types";
import { loadPrices, sliceByDate } from "@/lib/finance/loader";
import { dailyReturns, alignReturns, weightedReturns, buildEquityCurve } from "@/lib/finance/returns";
import {
  calcAllMetrics, calcYearlyReturns, dailyRiskFreeSeries, calcRollingReturns,
  calcRegressionMetrics, calcCaptureRatios, calcTailRisk, calcDrawdowns,
  calcExtendedPerformanceMetrics, calcPeriodReturns, calcAssetContributions, calcTopDrawdowns,
} from "@/lib/finance/metrics";
import { simulatePortfolio, validateWeights } from "@/lib/finance/portfolio";
import { simulateDca } from "@/lib/finance/dca";
import { simulateDcaWithTax, simulateGeneralOnly } from "@/lib/finance/dca_tax_merged";
import { ETF_CATALOG } from "@/lib/finance/catalog";
import { KR_ETF_CATALOG } from "@/lib/finance/catalogKr";

type ExtendedRequest = BacktestRequest & {
  dca?: DcaOptions;
  tax?: TaxOptions;
};

function findName(ticker: string): string {
  const us = ETF_CATALOG.find((e) => e.ticker === ticker);
  if (us) return us.name;
  const kr = KR_ETF_CATALOG.find((e) => e.ticker === ticker);
  if (kr) return kr.name;
  return ticker;
}

function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

function pickBenchmark(holdings: { ticker: string; weight: number }[], userBenchmark?: string): { ticker: string; reason: string } {
  if (userBenchmark && userBenchmark !== "auto") {
    return { ticker: userBenchmark, reason: "사용자 지정" };
  }
  let krWeight = 0;
  for (const h of holdings) {
    if (isKoreanTicker(h.ticker)) krWeight += h.weight;
  }
  if (krWeight >= 0.5) return { ticker: "069500", reason: `한국 비중 ${(krWeight * 100).toFixed(0)}% → KODEX 200` };
  return { ticker: "SPY", reason: `미국 비중 ${((1 - krWeight) * 100).toFixed(0)}% → SPY` };
}

function calcAssetDrift(matrix: number[][], dates: string[], initialWeights: number[], rebalance: string, tickers: string[]) {
  const numAssets = initialWeights.length;
  const currentShares = [...initialWeights];
  const driftSeries: any[] = [];
  let rebalanceCount = 0;

  if (dates.length === 0) return { driftSeries, rebalanceCount };

  let prevYear = dates[0].slice(0, 4);
  let prevMonth = dates[0].slice(0, 7);

  const initial: any = { date: dates[0] };
  for (let j = 0; j < numAssets; j++) initial[tickers[j]] = Number((initialWeights[j] * 100).toFixed(2));
  driftSeries.push(initial);

  for (let i = 1; i < dates.length; i++) {
    const date = dates[i];
    const year = date.slice(0, 4);
    const month = date.slice(0, 7);

    let doRebalance = false;
    if (rebalance === "annual" && year !== prevYear) doRebalance = true;
    if (rebalance === "semiannual" && month !== prevMonth && (month.endsWith("01") || month.endsWith("07"))) doRebalance = true;
    if (rebalance === "quarterly" && month !== prevMonth && ["01", "04", "07", "10"].some((m) => month.endsWith(m))) doRebalance = true;
    if (rebalance === "monthly" && month !== prevMonth) doRebalance = true;

    let portValue = 0;
    for (let j = 0; j < numAssets; j++) {
      currentShares[j] *= 1 + (matrix[i]?.[j] ?? 0);
      portValue += currentShares[j];
    }

    if (doRebalance) {
      rebalanceCount++;
      const pre: any = { date };
      for (let j = 0; j < numAssets; j++) pre[tickers[j]] = portValue > 0 ? Number(((currentShares[j] / portValue) * 100).toFixed(2)) : 0;
      driftSeries.push(pre);

      for (let j = 0; j < numAssets; j++) currentShares[j] = portValue * initialWeights[j];

      const post: any = { date };
      for (let j = 0; j < numAssets; j++) post[tickers[j]] = Number((initialWeights[j] * 100).toFixed(2));
      driftSeries.push(post);
    } else if (i === dates.length - 1 || month !== dates[i + 1]?.slice(0, 7)) {
      const pt: any = { date };
      for (let j = 0; j < numAssets; j++) pt[tickers[j]] = portValue > 0 ? Number(((currentShares[j] / portValue) * 100).toFixed(2)) : 0;
      driftSeries.push(pt);
    }
    prevYear = year;
    prevMonth = month;
  }

  return { driftSeries, rebalanceCount };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExtendedRequest;

    if (!body.holdings || body.holdings.length === 0) {
      return NextResponse.json({ error: "종목이 비어있습니다." }, { status: 400 });
    }

    const weights = body.holdings.map((h) => h.weight);
    validateWeights(weights);
    const tickers = body.holdings.map((h) => h.ticker);

    const computedStart = body.startDate;
    const benchmarkPick = pickBenchmark(body.holdings, body.benchmark);
    const benchmark = benchmarkPick.ticker;

    let priceSeries: PriceSeries[];
    let benchSeries: PriceSeries;
    try {
      priceSeries = tickers.map((t) => sliceByDate(loadPrices(t), computedStart, body.endDate));
      benchSeries = sliceByDate(loadPrices(benchmark), computedStart, body.endDate);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const allReturns = priceSeries.map((s) => ({ ticker: s.ticker, rows: dailyReturns(s) }));
    const { dates, matrix } = alignReturns(allReturns);
    
    if (dates.length < 2) {
      return NextResponse.json({ error: "공통 거래일이 부족합니다." }, { status: 400 });
    }

    const actualStart = dates[0];
    const actualEnd = dates[dates.length - 1];

    const dateAdjustments: { ticker: string; firstAvailable: string }[] = [];
    for (let i = 0; i < tickers.length; i++) {
      const series = priceSeries[i];
      if (series.rows.length === 0) continue;
      if (series.rows[0].date > computedStart) {
        dateAdjustments.push({ ticker: tickers[i], firstAvailable: series.rows[0].date });
      }
    }

    const rebalanceFeeRate = body.dca?.feeRate ?? 0;
    
    const portCurve = simulatePortfolio(matrix, dates, weights, actualStart, body.rebalance, rebalanceFeeRate);
    
    const portRets = weightedReturns(matrix, weights);
    const benchDailyAll = dailyReturns(benchSeries);
    const benchDaily = benchDailyAll.filter((r) => r.date >= actualStart && r.date <= actualEnd);
    const benchCurve = buildEquityCurve(benchDaily.map((r) => r.ret), benchDaily.map((r) => r.date), actualStart);

    let irxSeries: { date: string; rate: number }[] | undefined;
    let krWeight = body.holdings.reduce((s, h) => s + (isKoreanTicker(h.ticker) ? h.weight : 0), 0);

    if (body.riskFree?.type === "dynamic") {
      try {
        const irx = sliceByDate(loadPrices("^IRX"), actualStart, actualEnd);
        irxSeries = irx.rows.map((r) => ({ date: r.date, rate: r.adjClose }));
      } catch { irxSeries = undefined; }
    }

    const benchKrWeight = isKoreanTicker(benchmark) ? 1 : 0;
    const metrics = calcAllMetrics(portCurve, portRets, body.riskFree ?? { type: "none" }, irxSeries, krWeight);
    const benchmarkMetrics = calcAllMetrics(benchCurve, benchDaily.map((r) => r.ret), body.riskFree ?? { type: "none" }, irxSeries, benchKrWeight);
    const yearlyReturns = calcYearlyReturns(portCurve, benchCurve);

    const retDates = portCurve.slice(1).map((p) => p.date);
    const rfSeriesArray = dailyRiskFreeSeries(retDates, body.riskFree ?? { type: "none" }, irxSeries, krWeight);
    const alignedBenchRets = retDates.map((d) => {
      const m = benchDaily.find((b) => b.date === d);
      return m ? m.ret : 0;
    });

    const driftData = calcAssetDrift(matrix, dates, weights, body.rebalance, tickers);
    const extendedMetrics = calcExtendedPerformanceMetrics(portCurve, portRets, metrics.cagr, metrics.mdd, yearlyReturns);

    // portRets와 alignedBenchRets 길이 맞추기
    const minLen = Math.min(portRets.length, alignedBenchRets.length, rfSeriesArray.length);
    const portRetsAligned = portRets.slice(-minLen);
    const benchRetsAligned = alignedBenchRets.slice(-minLen);
    const rfAligned = rfSeriesArray.slice(-minLen);

    const advancedMetrics = {
      rollingReturns: calcRollingReturns(portCurve),
      regression: calcRegressionMetrics(portRetsAligned, benchRetsAligned, rfAligned),
      captureRatios: calcCaptureRatios(portRetsAligned, benchRetsAligned),
      tailRisk: calcTailRisk(portCurve, portRets),
      drawdowns: calcDrawdowns(portCurve),
      topDrawdowns: calcTopDrawdowns(portCurve, 5),
      periodReturns: calcPeriodReturns(portCurve),
      contributions: calcAssetContributions(
        priceSeries.map((p) => ({ ticker: p.ticker, rows: p.rows.map((r) => ({ date: r.date, adjClose: r.adjClose, dividends: r.dividends })) })),
        weights, actualStart, actualEnd
      ),
      drift: driftData.driftSeries,
      extended: { ...extendedMetrics, rebalanceCount: driftData.rebalanceCount },
    };

    let dcaResult: DcaResult | undefined;
    if (body.dca?.enabled) {
      try { dcaResult = simulateDca(priceSeries, tickers, weights, dates, body.dca); } catch (e) { console.error(e); }
    }

    let mergedResult: MergedSimResult | undefined;
    if (body.tax?.enabled && body.dca?.enabled) {
      try {
        const holdingNames: Record<string, string> = {};
        for (const t of tickers) holdingNames[t] = findName(t);
        mergedResult = simulateDcaWithTax({ prices: priceSeries, tickers, weights, dates, holdingNames, dcaOptions: body.dca, taxOptions: body.tax });
        const generalSim = simulateGeneralOnly({ prices: priceSeries, tickers, weights, dates, holdingNames, dcaOptions: body.dca, taxOptions: body.tax });
        const totalYears = Math.max(1, dates.length / 252);
        mergedResult.generalCaseBalance = generalSim.finalBalance;
        mergedResult.totalSavings = mergedResult.totalFinalBalance - generalSim.finalBalance;
        mergedResult.afterTaxCagr = generalSim.totalDeposit > 0 ? Math.pow(mergedResult.totalFinalBalance / generalSim.totalDeposit, 1 / totalYears) - 1 : 0;
        mergedResult.generalCaseCagr = generalSim.totalDeposit > 0 ? Math.pow(generalSim.finalBalance / generalSim.totalDeposit, 1 / totalYears) - 1 : 0;
      } catch (e) { console.error(e); }
    }

    return NextResponse.json({
      portfolio: portCurve, benchmark: benchCurve, metrics, benchmarkMetrics, yearlyReturns, advancedMetrics,
      meta: { actualStart, actualEnd, tradingDays: dates.length }, dca: dcaResult, merged: mergedResult,
      benchmarkInfo: { ticker: benchmark, name: findName(benchmark), reason: benchmarkPick.reason },
      dateAdjustments,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}