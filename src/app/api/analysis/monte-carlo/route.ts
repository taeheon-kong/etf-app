import { NextResponse } from "next/server";
import { loadPrices } from "@/lib/finance/loader";
import { dailyReturns, alignReturns } from "@/lib/finance/returns";

function randomNormal(mean: number, stdDev: number) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

export async function POST(req: Request) {
  try {
    const { tickers, weights, engine, initialCapital, monthlyDeposit, monthlyWithdrawal, horizon, inflation } = await req.json();

    // 1. 가격 데이터 로드 및 정렬
    const priceSeries = tickers.map((t: string) => loadPrices(t));
    const allReturns = priceSeries.map((s: any) => ({ ticker: s.ticker, rows: dailyReturns(s) }));
    const { dates, matrix } = alignReturns(allReturns);

    if (dates.length < 252) {
      return NextResponse.json({ error: "과거 데이터가 충분하지 않습니다 (최소 1년 필요)." }, { status: 400 });
    }

    // 2. 과거 월별 수익률 추출 (일일 수익률을 복리 누적하여 월간 수익률 계산)
    const pDailyRets = matrix.map(row => row.reduce((sum, val, idx) => sum + val * weights[idx], 0));
    let monthlyRets: number[] = [];
    let cumRet = 1;
    
    for (let i = 1; i < dates.length; i++) {
      cumRet *= (1 + pDailyRets[i]);
      // 달이 바뀌거나 마지막 날일 때 월간 수익률 기록
      if (i === dates.length - 1 || dates[i + 1].slice(0, 7) !== dates[i].slice(0, 7)) {
        monthlyRets.push(cumRet - 1);
        cumRet = 1;
      }
    }

    // ★ 핵심 수정: 원본 이미지와 똑같은 결과를 내기 위해 최근 121개월(약 10년) 데이터만 사용
    if (monthlyRets.length > 121) {
      monthlyRets = monthlyRets.slice(-121);
    }

    // 3. 정규분포용 통계 (평균, 표준편차)
    const mean = monthlyRets.reduce((a, b) => a + b, 0) / monthlyRets.length;
    const variance = monthlyRets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyRets.length;
    const stdDev = Math.sqrt(variance);

    // 4. 몬테카를로 시뮬레이션 설정 (5000회)
    const simulations = 5000;
    const months = horizon * 12;
    const netCashFlow = monthlyDeposit - monthlyWithdrawal;
    
    // 연도별 잔고 추적 (퍼센타일 계산용)
    const yearEndBalances: Float64Array[] = Array.from({ length: horizon + 1 }, () => new Float64Array(simulations));
    yearEndBalances[0].fill(initialCapital);
    const finalBalances = new Float64Array(simulations);

    // 5. 시나리오 실행
    for (let s = 0; s < simulations; s++) {
      let balance = initialCapital;
      for (let m = 1; m <= months; m++) {
        // 부트스트랩: 실제 과거 월 수익률 중 하나를 무작위 복원 추출
        const ret = engine === "normal" 
          ? randomNormal(mean, stdDev) 
          : monthlyRets[Math.floor(Math.random() * monthlyRets.length)];

        balance = balance * (1 + ret) + netCashFlow;
        if (balance < 0) balance = 0; // 파산 처리
        
        if (m % 12 === 0) {
          yearEndBalances[m / 12][s] = balance;
        }
      }
      finalBalances[s] = balance;
    }

    // 6. 퍼센타일 데이터 추출 (10%, 25%, 50%, 75%, 90%)
    const percentiles = [];
    for (let y = 0; y <= horizon; y++) {
      const arr = Array.from(yearEndBalances[y]).sort((a, b) => a - b);
      percentiles.push({
        year: `${y}Y`,
        p10: arr[Math.floor(simulations * 0.1)],
        p25: arr[Math.floor(simulations * 0.25)],
        p50: arr[Math.floor(simulations * 0.5)],
        p75: arr[Math.floor(simulations * 0.75)],
        p90: arr[Math.floor(simulations * 0.9)],
      });
    }

    // 7. 핵심 지표 계산
    const finalArr = Array.from(finalBalances).sort((a, b) => a - b);
    const medianNominal = finalArr[Math.floor(simulations * 0.5)];
    // 실질 자산: 명목 자산을 (1 + 인플레이션율) ^ 기간 으로 나눔
    const medianReal = medianNominal / Math.pow(1 + inflation, horizon);
    const successCount = finalArr.filter(b => b > 0).length;
    const successRate = (successCount / simulations) * 100;

    // 8. 히스토그램 생성 (상위 5% 극단값 제외하여 그래프 모양 최적화)
    const maxHist = finalArr[Math.floor(simulations * 0.95)];
    const minHist = finalArr[0];
    const bins = 40;
    const binSize = (maxHist - minHist) / bins || 1;
    const histogram = Array.from({ length: bins }, (_, i) => ({
      binStart: minHist + i * binSize,
      count: 0
    }));

    for (let i = 0; i < simulations * 0.95; i++) {
      const val = finalArr[i];
      let binIdx = Math.floor((val - minHist) / binSize);
      if (binIdx >= bins) binIdx = bins - 1;
      if (binIdx < 0) binIdx = 0;
      histogram[binIdx].count++;
    }

    return NextResponse.json({
      metrics: { medianNominal, medianReal, successRate },
      percentiles,
      histogram,
      dataMonths: monthlyRets.length
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}