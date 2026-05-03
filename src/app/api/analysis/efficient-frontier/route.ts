import { NextResponse } from "next/server";
import { loadPrices, sliceByDate } from "@/lib/finance/loader";
import { dailyReturns, alignReturns } from "@/lib/finance/returns";

export async function POST(req: Request) {
  try {
    const { tickers, period, riskFreeRate = 0.02 } = await req.json();

    // 1. 기간 설정 (예: 5년 = 약 1260영업일)
    const endDate = new Date().toISOString().slice(0, 10);
    const startDateObj = new Date();
    startDateObj.setFullYear(startDateObj.getFullYear() - period);
    const startDate = startDateObj.toISOString().slice(0, 10);

    // 2. 가격 데이터 로드 및 정렬
    const priceSeries = tickers.map((t: string) => sliceByDate(loadPrices(t), startDate, endDate));
    const allReturns = priceSeries.map((s: any) => ({ ticker: s.ticker, rows: dailyReturns(s) }));
    const { matrix } = alignReturns(allReturns);

    if (matrix.length < 10) {
      return NextResponse.json({ error: "데이터가 충분하지 않습니다." }, { status: 400 });
    }

    const n = tickers.length;
    const days = matrix.length;

    // 3. 자산별 평균 일일 수익률 및 공분산(Covariance) 계산
    const meanReturns = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      meanReturns[j] = matrix.reduce((sum, row) => sum + (row[j] || 0), 0) / days;
    }

    const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let cov = 0;
        for (let k = 0; k < days; k++) {
          cov += ((matrix[k][i] || 0) - meanReturns[i]) * ((matrix[k][j] || 0) - meanReturns[j]);
        }
        covMatrix[i][j] = cov / days;
      }
    }

    // 4. 8,000개 랜덤 포트폴리오 (몬테카를로 시뮬레이션)
    const samples = 8000;
    const results = [];
    let maxSharpe = { sharpe: -Infinity, return: 0, vol: 0, weights: [] as number[] };
    let minVol = { vol: Infinity, return: 0, sharpe: 0, weights: [] as number[] };

    for (let s = 0; s < samples; s++) {
      let w = Array.from({ length: n }, () => Math.random());
      const sum = w.reduce((a, b) => a + b, 0);
      w = w.map(v => v / sum);

      // 연환산 기대 수익률
      let pRet = 0;
      for (let j = 0; j < n; j++) pRet += w[j] * meanReturns[j];
      const pRetAnn = pRet * 252;

      // 연환산 기대 변동성
      let pVar = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          pVar += w[i] * w[j] * covMatrix[i][j];
        }
      }
      const pVolAnn = Math.sqrt(pVar * 252);
      
      const sharpe = (pRetAnn - riskFreeRate) / pVolAnn;
      const point = { vol: +(pVolAnn * 100).toFixed(2), return: +(pRetAnn * 100).toFixed(2), sharpe: +sharpe.toFixed(2), weights: w };
      
      results.push(point);

      if (sharpe > maxSharpe.sharpe) maxSharpe = point;
      if (pVolAnn * 100 < minVol.vol) minVol = point;
    }

    // 5. 경계선(Frontier) 추출 (수정된 로직)
    const minVolPoint = minVol;
    const maxRetPoint = results.reduce((max, r) => r.return > max.return ? r : max);

    // 효율적 투자선은 최소분산 ~ 최고수익률 구간에서만 존재합니다.
    const minX = minVolPoint.vol;
    const maxX = maxRetPoint.vol; 
    const bins = 40;
    const frontier = [];
    let currentMaxRet = -Infinity;

    for (let i = 0; i <= bins; i++) {
      const x = minX + (maxX - minX) * (i / bins);
      // 현재 x(변동성) 근처의 점들 탐색
      const inBin = results.filter(r => r.vol >= x - 0.5 && r.vol <= x + 0.5);
      
      if (inBin.length > 0) {
        const best = inBin.reduce((a, b) => a.return > b.return ? a : b);
        // 우상향 원칙: 이전 점보다 수익률이 높거나 같을 때만 선을 이어나감 (밑으로 파임 방지)
        if (best.return >= currentMaxRet) {
          frontier.push({ vol: Number(x.toFixed(2)), return: best.return });
          currentMaxRet = best.return;
        }
      }
    }
    
    // 곡선이 끝까지 예쁘게 이어지도록 최고 수익률 점 확정 추가
    if (frontier.length === 0 || frontier[frontier.length - 1].vol < maxX) {
      frontier.push({ vol: maxX, return: maxRetPoint.return });
    }

    // 프론트로 보낼 때 점이 너무 많으면 버벅이므로 샘플링
    const samplePoints = results.filter((_, i) => i % 4 === 0);

    return NextResponse.json({ results: samplePoints, frontier, maxSharpe, minVol });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}