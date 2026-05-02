import { NextResponse } from "next/server";
import type {
  BacktestRequest,
  BacktestResult,
  PriceSeries,
  DcaOptions,
  DcaResult,
  TaxOptions,
  TaxResult,
} from "@/lib/finance/types";
import { loadPrices, sliceByDate } from "@/lib/finance/loader";
import {
  dailyReturns,
  alignReturns,
  weightedReturns,
  buildEquityCurve,
} from "@/lib/finance/returns";
import { simulatePortfolio, validateWeights } from "@/lib/finance/portfolio";
import { calcAllMetrics, calcYearlyReturns } from "@/lib/finance/metrics";
import { simulateDca } from "@/lib/finance/dca";
import { simulateTax } from "@/lib/finance/tax";
import { ETF_CATALOG } from "@/lib/finance/catalog";
import { KR_ETF_CATALOG } from "@/lib/finance/catalogKr";

type ExtendedRequest = BacktestRequest & {
  dca?: DcaOptions;
  tax?: TaxOptions;
};
type ExtendedResult = BacktestResult & {
  dca?: DcaResult;
  tax?: TaxResult;
  benchmarkInfo?: { ticker: string; name: string; reason: string };
  dateAdjustments?: { ticker: string; firstAvailable: string }[];
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

/**
 * 벤치마크 자동 선택.
 *  - 한국 비중 ≥ 50% → KODEX 200 (069500)
 *  - 미국 비중 ≥ 50% → SPY
 *  - 그 외(혼합) → 사용자 지정 또는 SPY 기본
 *
 * 사용자가 명시적으로 지정한 경우 그대로 사용.
 */
function pickBenchmark(
  holdings: { ticker: string; weight: number }[],
  userBenchmark?: string,
): { ticker: string; reason: string } {
  if (userBenchmark && userBenchmark !== "auto") {
    return { ticker: userBenchmark, reason: "사용자 지정" };
  }

  let krWeight = 0;
  for (const h of holdings) {
    if (isKoreanTicker(h.ticker)) krWeight += h.weight;
  }

  if (krWeight >= 0.5) {
    return { ticker: "069500", reason: `한국 비중 ${(krWeight * 100).toFixed(0)}% → KODEX 200` };
  }
  return { ticker: "SPY", reason: `미국 비중 ${((1 - krWeight) * 100).toFixed(0)}% → SPY` };
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

    // 벤치마크 자동 선택
    const benchmarkPick = pickBenchmark(body.holdings, body.benchmark);
    const benchmark = benchmarkPick.ticker;

    // 한국 비중 (무위험수익률 분기용)
    let krWeight = 0;
    for (const h of body.holdings) {
      if (isKoreanTicker(h.ticker)) krWeight += h.weight;
    }

    let priceSeries: PriceSeries[];
    let benchSeries: PriceSeries;
    try {
      priceSeries = tickers.map((t) =>
        sliceByDate(loadPrices(t), body.startDate, body.endDate)
      );
      benchSeries = sliceByDate(
        loadPrices(benchmark),
        body.startDate,
        body.endDate
      );
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }

    const allReturns = priceSeries.map((s) => ({
      ticker: s.ticker,
      rows: dailyReturns(s),
    }));
    const { dates, matrix } = alignReturns(allReturns);
    if (dates.length < 2) {
      return NextResponse.json(
        { error: "공통 거래일이 부족합니다. 기간 또는 종목을 조정하세요." },
        { status: 400 }
      );
    }
    const actualStart = dates[0];
    const actualEnd = dates[dates.length - 1];

    // 상장일 검증: 사용자 요청 시작일과 실제 사용 시작일 비교
    const dateAdjustments: { ticker: string; firstAvailable: string }[] = [];
    for (let i = 0; i < tickers.length; i++) {
      const series = priceSeries[i];
      if (series.rows.length === 0) continue;
      const firstAvailable = series.rows[0].date;
      // 사용자 요청 시작일보다 데이터 시작이 늦으면 안내
      if (firstAvailable > body.startDate) {
        dateAdjustments.push({ ticker: tickers[i], firstAvailable });
      }
    }

    // 리밸런싱 거래비용 (DCA 옵션의 feeRate 재사용, 없으면 0)
    const rebalanceFeeRate = body.dca?.feeRate ?? 0;
    const portCurve = simulatePortfolio(matrix, dates, weights, actualStart, body.rebalance, rebalanceFeeRate);
    const portRets = weightedReturns(matrix, weights);

    const benchDailyAll = dailyReturns(benchSeries);
    const benchDaily = benchDailyAll.filter(
      (r) => r.date >= actualStart && r.date <= actualEnd
    );
    const benchCurve = buildEquityCurve(
      benchDaily.map((r) => r.ret),
      benchDaily.map((r) => r.date),
      actualStart
    );

    let irxSeries: { date: string; rate: number }[] | undefined;
    if (body.riskFree?.type === "dynamic") {
      try {
        const irx = sliceByDate(loadPrices("^IRX"), actualStart, actualEnd);
        irxSeries = irx.rows.map((r) => ({ date: r.date, rate: r.adjClose }));
      } catch {
        irxSeries = undefined;
      }
    }

    // 벤치마크의 한국 비중 (벤치마크 자체 메트릭용)
    const benchKrWeight = isKoreanTicker(benchmark) ? 1 : 0;

    const metrics = calcAllMetrics(
      portCurve,
      portRets,
      body.riskFree ?? { type: "none" },
      irxSeries,
      krWeight,
    );
    const benchmarkMetrics = calcAllMetrics(
      benchCurve,
      benchDaily.map((r) => r.ret),
      body.riskFree ?? { type: "none" },
      irxSeries,
      benchKrWeight,
    );

    const yearlyReturns = calcYearlyReturns(portCurve, benchCurve);

    // ── 적립식 ──
    let dcaResult: DcaResult | undefined;
    if (body.dca && body.dca.enabled) {
      try {
        dcaResult = simulateDca(priceSeries, tickers, weights, dates, body.dca);
      } catch (e) {
        console.error("DCA error:", e);
      }
    }

    // ── 절세 ──
    let taxResult: TaxResult | undefined;
    if (body.tax && body.tax.enabled && body.dca && body.dca.enabled) {
      try {
        const totalDays = dates.length;
        const totalYears = Math.max(1, Math.round(totalDays / 252));

        const holdingNames: Record<string, string> = {};
        for (const t of tickers) holdingNames[t] = findName(t);

        // 가중평균 배당수익률 계산 (한국 ETF는 메타에서, 미국은 추정치 1.5%)
        let weightedDivYield = 0;
        let weightAccountedFor = 0;
        for (const h of body.holdings) {
          const krMeta = KR_ETF_CATALOG.find((e) => e.ticker === h.ticker);
          if (krMeta) {
            // 메타에 dividendYieldTtm이 없으므로 일단 카테고리 기반 추정
            // dividend/coveredCall/realEstate → 6%, bond → 3%, 그 외 → 1.5%
            let estDiv = 0.015;
            if (krMeta.category === "coveredCall") estDiv = 0.10;
            else if (krMeta.category === "dividend") estDiv = 0.04;
            else if (krMeta.category === "realEstate") estDiv = 0.05;
            else if (krMeta.category === "bond") estDiv = 0.03;
            weightedDivYield += h.weight * estDiv;
            weightAccountedFor += h.weight;
          } else {
            // 미국 ETF: 평균 1.5%
            weightedDivYield += h.weight * 0.015;
            weightAccountedFor += h.weight;
          }
        }
        const yearlyDividend = weightAccountedFor > 0 ? weightedDivYield / weightAccountedFor : 0.02;

        taxResult = simulateTax({
          holdings: body.holdings,
          holdingNames,
          initialCapital: body.dca.initialCapital,
          monthlyDeposit: body.dca.monthlyDeposit,
          yearlyReturn: metrics.cagr,
          yearlyDividend,
          totalYears,
          options: body.tax,
        });
      } catch (e) {
        console.error("Tax error:", e);
      }
    }

    const result: ExtendedResult = {
      portfolio: portCurve,
      benchmark: benchCurve,
      metrics,
      benchmarkMetrics,
      yearlyReturns,
      meta: { actualStart, actualEnd, tradingDays: dates.length },
      dca: dcaResult,
      tax: taxResult,
      benchmarkInfo: {
        ticker: benchmark,
        name: findName(benchmark),
        reason: benchmarkPick.reason,
      },
      dateAdjustments,
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "Unknown error" },
      { status: 500 }
    );
  }
}