import { NextResponse } from "next/server";
import { loadPrices } from "@/lib/finance/loader";
import { dailyReturns, alignReturns } from "@/lib/finance/returns";
import type { PriceSeries } from "@/lib/finance/types";

// 피어슨 상관계수 계산
function calculateCorrelation(arrX: number[], arrY: number[]): number {
  if (arrX.length !== arrY.length || arrX.length < 2) return 0;
  const mean = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const mx = mean(arrX);
  const my = mean(arrY);
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < arrX.length; i++) {
    const diffX = arrX[i] - mx;
    const diffY = arrY[i] - my;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }
  
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

// 수익률 배열로 CAGR 계산
function calcCAGR(returns: number[]): number {
  if (returns.length === 0) return 0;
  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1);
  const years = returns.length / 252;
  return Math.pow(cumulative, 1 / years) - 1;
}

// 수익률 배열로 변동성(연환산 표준편차) 계산
function calcVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export async function POST(req: Request) {
  try {
    const { tickers, period } = await req.json(); // period: 요청한 연수 (예: 5)

    if (!tickers || !Array.isArray(tickers) || tickers.length < 2) {
      return NextResponse.json({ error: "최소 2개 이상의 종목이 필요합니다." }, { status: 400 });
    }

    // 1. 데이터 로드
    let priceSeries: PriceSeries[];
    try {
      priceSeries = tickers.map((t) => loadPrices(t));
    } catch (e) {
      return NextResponse.json({ error: `데이터 로드 실패: ${(e as Error).message}` }, { status: 400 });
    }

    // 2. 공통 날짜 정렬
    const allReturns = priceSeries.map((s) => ({ ticker: s.ticker, rows: dailyReturns(s) }));
    const { dates, matrix } = alignReturns(allReturns);
    
    if (dates.length < 2) {
      return NextResponse.json({ error: "공통 거래일이 부족하여 분석할 수 없습니다." }, { status: 400 });
    }

    const maxYears = Math.max(1, Math.floor(dates.length / 252));

    // 3. 기간 슬라이싱 (period 파라미터가 있으면 해당 연수만큼 최신 데이터만 자름)
    let sliceStart = 0;
    if (typeof period === "number" && period < maxYears) {
      sliceStart = Math.max(0, dates.length - Math.floor(period * 252));
    }
    const slicedDates = dates.slice(sliceStart);
    const slicedMatrix = matrix.slice(sliceStart);

    // 4. 종목별 수익률 분리
    const returnsByTicker: number[][] = Array(tickers.length).fill([]).map(() => []);
    for (let i = 0; i < slicedDates.length; i++) {
      for (let j = 0; j < tickers.length; j++) {
        returnsByTicker[j].push(slicedMatrix[i][j]);
      }
    }

    // 5. 상관행렬 계산
    const n = tickers.length;
    const correlationMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) correlationMatrix[i][j] = 1;
        else if (i < j) {
          const corr = calculateCorrelation(returnsByTicker[i], returnsByTicker[j]);
          correlationMatrix[i][j] = corr;
          correlationMatrix[j][i] = corr;
        }
      }
    }

    // 6. 자산별 통계 계산 (CAGR, 변동성)
    const stats = tickers.map((ticker, i) => ({
      ticker,
      cagr: calcCAGR(returnsByTicker[i]),
      volatility: calcVolatility(returnsByTicker[i]),
    }));

    return NextResponse.json({
      tickers,
      matrix: correlationMatrix,
      startDate: slicedDates[0],
      endDate: slicedDates[slicedDates.length - 1],
      tradingDays: slicedDates.length,
      maxYears,
      stats,
    });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}