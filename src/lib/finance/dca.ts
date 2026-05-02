/**
 * 적립식(DCA) 시뮬레이션 + 인플레이션 보정 + 환율 환산.
 *
 * 환율 처리 (개선):
 *  - 미국 ETF는 매수 시점 환율로 KRW 환산 → 이때 USD 수량 확정
 *  - 평가 시점에는 USD 가격 변동 + 평가 시점 환율로 평가
 *  - 즉, 실제 한국 투자자가 환전→매수→보유→재환전하는 흐름 반영
 */
import type { DcaOptions, DcaResult, PriceSeries } from "./types";
import { loadCpi, loadFxUsdKrw, valueAtOrBefore } from "./macroLoader";

function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

export function simulateDca(
  prices: PriceSeries[],
  tickers: string[],
  weights: number[],
  dates: string[],
  options: DcaOptions,
): DcaResult {
  // 가격 lookup
  const priceMap = new Map<string, Map<string, number>>();
  for (const ps of prices) {
    const m = new Map<string, number>();
    for (const r of ps.rows) m.set(r.date, r.adjClose);
    priceMap.set(ps.ticker, m);
  }

  const cpi = loadCpi();
  const fx = loadFxUsdKrw();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const cpiStart = valueAtOrBefore(cpi, startDate) ?? 100;

  // basis 처리:
  //  - "start": 입력값 그대로 (모든 적립이 명목 KRW)
  //  - "now": 입력값이 "현재 화폐가치"이므로 매 적립 시점 CPI로 명목 환산
  //           즉, 사용자가 "월 50만원 적립할게"라고 하면, 2010년에는 그 시점 50만원의 가치만큼만 명목으로 들어감.
  const initialCapital = options.initialCapital;  // 시작 시점 적립 (basis와 무관: 시작일 기준 = 시작 명목)
  const monthlyDepositInput = options.monthlyDeposit;
  const cpiNow = cpi.length > 0 ? cpi[cpi.length - 1].value : cpiStart;

  /** 적립 시점 명목 KRW 변환 (basis="now"일 때만). */
  function nominalDeposit(date: string, amountInput: number): number {
    if (options.basis === "start") return amountInput;
    // amountInput은 "현재 화폐가치 KRW"
    // 시점별 cpi(date) / cpiNow 로 명목 환산
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return amountInput * (cpiAt / cpiNow);
  }

  // 종목별 보유 단위 + 단위 통화
  // 한국 ETF: shares는 KRW가격 기준 주수
  // 미국 ETF: shares는 USD가격 기준 주수 → 평가 시 환율 곱
  const shares: number[] = tickers.map(() => 0);
  const isKor: boolean[] = tickers.map(isKoreanTicker);

  let totalDeposit = 0;
  let totalFee = 0;
  const series: { date: string; balance: number; deposit: number }[] = [];

  /** 매수: cash(KRW)를 weights 비율로 분배. 미국은 환전해서 USD주식 매수. */
  function buy(date: string, cashKrw: number) {
    const fee = cashKrw * options.feeRate;
    totalFee += fee;
    const net = cashKrw - fee;
    const fxRate = valueAtOrBefore(fx, date);

    for (let i = 0; i < tickers.length; i++) {
      const allocKrw = net * weights[i];
      const m = priceMap.get(tickers[i]);
      if (!m) continue;
      const px = m.get(date);
      if (px === undefined || px <= 0) continue;

      if (isKor[i]) {
        // 한국 ETF: KRW 그대로 매수
        shares[i] += allocKrw / px;
      } else {
        // 미국 ETF: KRW → USD 환전 후 매수
        if (fxRate === null || fxRate <= 0) continue;
        const allocUsd = allocKrw / fxRate;
        shares[i] += allocUsd / px;
      }
    }
  }

  /** 평가: 그날 시점에서 KRW 기준 평가액. */
  function evaluate(date: string): number {
    const fxRate = valueAtOrBefore(fx, date);
    let bal = 0;
    for (let i = 0; i < tickers.length; i++) {
      const m = priceMap.get(tickers[i]);
      if (!m) continue;
      const px = m.get(date);
      if (px === undefined) continue;
      if (isKor[i]) {
        bal += shares[i] * px;
      } else {
        if (fxRate === null) continue;
        bal += shares[i] * px * fxRate;
      }
    }
    return bal;
  }

  // 시작일 초기 자본 (basis 처리)
  const initialNominal = nominalDeposit(startDate, initialCapital);
  buy(startDate, initialNominal);
  totalDeposit += initialNominal;

  // 일별 루프
  let prevMonth = startDate.substring(0, 7);
  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const month = date.substring(0, 7);
    if (month !== prevMonth) {
      const nominal = nominalDeposit(date, monthlyDepositInput);
      buy(date, nominal);
      totalDeposit += nominal;
      prevMonth = month;
    }
    series.push({ date, balance: evaluate(date), deposit: totalDeposit });
  }

  const finalBalance = series.length > 0 ? series[series.length - 1].balance : 0;
  const cpiEnd = valueAtOrBefore(cpi, endDate) ?? cpiStart;
  const realFinalBalance = finalBalance * (cpiStart / cpiEnd);

  return {
    finalBalance,
    totalDeposit,
    netProfit: finalBalance - totalDeposit,
    realFinalBalance,
    totalFee,
    series,
  };
}