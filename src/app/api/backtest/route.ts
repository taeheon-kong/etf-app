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
};

function findName(ticker: string): string {
  const us = ETF_CATALOG.find((e) => e.ticker === ticker);
  if (us) return us.name;
  const kr = KR_ETF_CATALOG.find((e) => e.ticker === ticker);
  if (kr) return kr.name;
  return ticker;
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
    const benchmark = body.benchmark || "SPY";

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

    const portCurve = simulatePortfolio(matrix, dates, weights, actualStart, body.rebalance);
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

    const metrics = calcAllMetrics(portCurve, portRets, body.riskFree ?? { type: "none" }, irxSeries);
    const benchmarkMetrics = calcAllMetrics(benchCurve, benchDaily.map((r) => r.ret), body.riskFree ?? { type: "none" }, irxSeries);
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
        // 포트폴리오 가중평균 배당수익률 (KR ETF에서 메타 활용 — 여기선 단순화로 2% 기본값)
        let yearlyDividend = 0;
        let totalKrWeight = 0;
        for (let i = 0; i < tickers.length; i++) {
          const kr = KR_ETF_CATALOG.find((e) => e.ticker === tickers[i]);
          if (kr) {
            totalKrWeight += weights[i];
          }
        }
        // 단순 기본값 2%
        yearlyDividend = 0.02;

        // 포트폴리오 연수익률 = 백테스트 CAGR
        const yearlyReturn = metrics.cagr;

        // 시뮬레이션 기간 (년)
        const totalDays = dates.length;
        const totalYears = Math.max(1, Math.round(totalDays / 252));

        const holdingNames: Record<string, string> = {};
        for (const t of tickers) holdingNames[t] = findName(t);

        taxResult = simulateTax({
          holdings: body.holdings,
          holdingNames,
          initialCapital: body.dca.initialCapital,
          monthlyDeposit: body.dca.monthlyDeposit,
          yearlyReturn,
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
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "Unknown error" },
      { status: 500 }
    );
  }
}