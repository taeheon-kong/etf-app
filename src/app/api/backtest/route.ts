import { NextResponse } from "next/server";
import type {
  BacktestRequest,
  BacktestResult,
  PriceSeries,
  DcaOptions,
  DcaResult,
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

type ExtendedRequest = BacktestRequest & { dca?: DcaOptions };
type ExtendedResult = BacktestResult & { dca?: DcaResult };

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

    const portCurve = simulatePortfolio(
      matrix,
      dates,
      weights,
      actualStart,
      body.rebalance
    );
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

    const metrics = calcAllMetrics(
      portCurve,
      portRets,
      body.riskFree ?? { type: "none" },
      irxSeries
    );
    const benchmarkMetrics = calcAllMetrics(
      benchCurve,
      benchDaily.map((r) => r.ret),
      body.riskFree ?? { type: "none" },
      irxSeries
    );

    const yearlyReturns = calcYearlyReturns(portCurve, benchCurve);

    // 적립식 시뮬레이션
    let dcaResult: DcaResult | undefined;
    if (body.dca && body.dca.enabled) {
      try {
        dcaResult = simulateDca(
          priceSeries,
          tickers,
          weights,
          dates,
          body.dca
        );
      } catch (e) {
        console.error("DCA error:", e);
      }
    }

    const result: ExtendedResult = {
      portfolio: portCurve,
      benchmark: benchCurve,
      metrics,
      benchmarkMetrics,
      yearlyReturns,
      meta: {
        actualStart,
        actualEnd,
        tradingDays: dates.length,
      },
      dca: dcaResult,
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "Unknown error" },
      { status: 500 }
    );
  }
}