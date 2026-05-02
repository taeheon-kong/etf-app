/**
 * 적립식(DCA) + 절세 통합 시뮬레이션
 *
 * 핵심 설계:
 * - adjClose로 평가액 계산 (배당 자동 재투자 반영)
 * - dividends 필드는 "세금 계산 + 표시용"으로만 별도 추적
 * - 4계좌 우선순위 분배 + 풍차돌리기 + 시계열 생성
 */

import type {
  PriceSeries,
  AccountType,
  AccountResult,
  WindmillCycle,
  DcaOptions,
  TaxOptions,
  MergedSeriesPoint,
  MergedSimResult,
  DividendCashflow,
} from "./types";
import { loadCpi, loadFxUsdKrw, valueAtOrBefore } from "./macroLoader";
import {
  isEligible,
  isKoreanTicker,
  isLeveragedOrInverse,
  isDomesticEquity,
  isOverseasUnderlying,
  ANNUAL_LIMIT,
  ISA_TOTAL_LIMIT,
  isaTaxFreeLimit,
  taxCreditRate,
  ISA_OVER_LIMIT_TAX_RATE,
  DIVIDEND_TAX_RATE,
  windmillTaxCredit,
} from "./taxHelpers";

export type MergedSimInput = {
  prices: PriceSeries[];
  tickers: string[];
  weights: number[];
  dates: string[];
  holdingNames: Record<string, string>;
  dcaOptions: DcaOptions;
  taxOptions: TaxOptions;
};

type AcctState = {
  type: AccountType;
  shares: number[];
  deposit: number;
  taxCredit: number;
  isaCumulativeDeposit: number;
  annualDeposited: number;
  tax: number;
  dividend: number;
  warnings: string[];
};

export function simulateDcaWithTax(input: MergedSimInput): MergedSimResult {
  const { prices, tickers, weights, dates, holdingNames, dcaOptions, taxOptions } = input;

  // ──────────────────────────────────────────────────────────────
  // 가격/배당 맵 구성
  // ──────────────────────────────────────────────────────────────
  const priceMap = new Map<string, Map<string, number>>();
  const divMap = new Map<string, Map<string, number>>();
  for (const ps of prices) {
    const pm = new Map<string, number>();
    const dm = new Map<string, number>();
    for (const r of ps.rows) {
      pm.set(r.date, r.adjClose);
      if (r.dividends > 0) dm.set(r.date, r.dividends);
    }
    priceMap.set(ps.ticker, pm);
    divMap.set(ps.ticker, dm);
  }

  // ──────────────────────────────────────────────────────────────
  // 매크로 데이터
  // ──────────────────────────────────────────────────────────────
  const cpi = loadCpi();
  const fx = loadFxUsdKrw();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const cpiStart = valueAtOrBefore(cpi, startDate) ?? 100;
  const cpiNow = cpi.length > 0 ? cpi[cpi.length - 1].value : cpiStart;

  function nominalDeposit(date: string, amountInput: number): number {
    if (dcaOptions.basis === "start") return amountInput;
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return amountInput * (cpiAt / cpiNow);
  }

  function realKrwAt(date: string, krw: number): number {
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return krw * (cpiStart / cpiAt);
  }

  // ──────────────────────────────────────────────────────────────
  // 가격 조회 (forward fill)
  // ──────────────────────────────────────────────────────────────
  function getPrice(ticker: string, date: string): number {
    const m = priceMap.get(ticker);
    if (!m) return 0;
    let px = m.get(date);
    if (px !== undefined && px > 0) return px;
    const allDates = Array.from(m.keys()).sort();
    for (let j = allDates.length - 1; j >= 0; j--) {
      if (allDates[j] <= date) {
        const c = m.get(allDates[j]);
        if (c !== undefined && c > 0) return c;
      }
    }
    return 0;
  }

  function getDividend(ticker: string, date: string): number {
    return divMap.get(ticker)?.get(date) ?? 0;
  }

  // ──────────────────────────────────────────────────────────────
  // 상태 초기화
  // ──────────────────────────────────────────────────────────────
  const newState = (type: AccountType): AcctState => ({
    type,
    shares: tickers.map(() => 0),
    deposit: 0,
    taxCredit: 0,
    isaCumulativeDeposit: 0,
    annualDeposited: 0,
    tax: 0,
    dividend: 0,
    warnings: [],
  });

  const states: Record<AccountType, AcctState> = {
    isa: newState("isa"),
    pension: newState("pension"),
    irp: newState("irp"),
    general: newState("general"),
  };

  const activeAccounts = taxOptions.accounts
    .filter((a) => a.enabled)
    .sort((a, b) => a.priority - b.priority);

  const isKor = tickers.map(isKoreanTicker);

  const windmillCycles: WindmillCycle[] = [];
  const unallocated: { ticker: string; reason: string }[] = [];
  const series: MergedSeriesPoint[] = [];

  // 연도별 배당 추적
  const yearlyDivMap = new Map<number, { gross: number; tax: number }>();

  // 적격성 사전 체크
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const name = holdingNames[ticker] ?? ticker;
    if (!isKoreanTicker(ticker)) {
      unallocated.push({
        ticker,
        reason: `${name}: 미국 직상장 → 일반계좌만 가능`,
      });
    } else if (isLeveragedOrInverse(name)) {
      unallocated.push({
        ticker,
        reason: `${name}: 레버리지/인버스 → 연금/IRP 불가, ISA만 가능`,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // KRW 환산 가치 (계좌별)
  // ──────────────────────────────────────────────────────────────
  function evaluateAcct(acct: AccountType, date: string): number {
    const fxRate = valueAtOrBefore(fx, date);
    let bal = 0;
    const shares = states[acct].shares;
    for (let i = 0; i < tickers.length; i++) {
      if (shares[i] <= 0) continue;
      const px = getPrice(tickers[i], date);
      if (px <= 0) continue;
      if (isKor[i]) {
        bal += shares[i] * px;
      } else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        bal += shares[i] * px * rate;
      }
    }
    return bal;
  }

  // ──────────────────────────────────────────────────────────────
  // 매수 실행
  // ──────────────────────────────────────────────────────────────
  function executeTrade(
    acct: AccountType,
    assetIdx: number,
    date: string,
    krwAmount: number,
    fxRate: number | null,
  ) {
    const px = getPrice(tickers[assetIdx], date);
    if (px <= 0) return;
    if (isKor[assetIdx]) {
      states[acct].shares[assetIdx] += krwAmount / px;
    } else {
      const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
      states[acct].shares[assetIdx] += krwAmount / rate / px;
    }
  }

  /**
   * 일반 매수: 우선순위에 따라 4계좌 분배
   *
   * 분배 단위: "월 적립금 전체"를 한 번에 계좌별로 쪼개고,
   *           각 계좌 내에서 종목별 비중대로 매수.
   * 이전 버전은 종목별로 모든 계좌를 도는 방식이라
   * 한도 체크가 부정확했음.
   */
  function buyWithAllocation(date: string, cashKrw: number) {
    const netCash = cashKrw * (1 - dcaOptions.feeRate);
    const fxRate = valueAtOrBefore(fx, date);

    // 1. 종목별 적격 계좌 분류
    const taxEligibleIdx: number[] = [];
    const generalOnlyIdx: number[] = [];
    for (let i = 0; i < tickers.length; i++) {
      const name = holdingNames[tickers[i]] ?? tickers[i];
      if (isKor[i] && !isLeveragedOrInverse(name)) {
        taxEligibleIdx.push(i);
      } else {
        generalOnlyIdx.push(i);
      }
    }

    // 2. 절세계좌 가능한 종목들의 비중 합
    let taxEligibleWeight = 0;
    for (const i of taxEligibleIdx) taxEligibleWeight += weights[i];

    // 3. 절세계좌 우선 배분
    let remainingTaxEligible = netCash * taxEligibleWeight;

    for (const cfg of activeAccounts) {
      if (remainingTaxEligible <= 0) break;
      const acct = cfg.type;
      if (acct === "general") continue;

      const state = states[acct];
      let canDeposit = ANNUAL_LIMIT[acct] - state.annualDeposited;
      if (acct === "isa") {
        canDeposit = Math.min(canDeposit, ISA_TOTAL_LIMIT - state.isaCumulativeDeposit);
      }
      if (canDeposit <= 0) continue;

      const depositToAcct = Math.min(remainingTaxEligible, canDeposit);

      // 적격 종목 안에서 비중 비례 매수
      for (const i of taxEligibleIdx) {
        const name = holdingNames[tickers[i]] ?? tickers[i];
        if (!isEligible(tickers[i], name, acct)) continue;
        const subWeight = weights[i] / taxEligibleWeight;
        const buyAmt = depositToAcct * subWeight;
        if (buyAmt <= 0) continue;
        executeTrade(acct, i, date, buyAmt, fxRate);
      }

      state.deposit += depositToAcct;
      state.annualDeposited += depositToAcct;
      if (acct === "isa") state.isaCumulativeDeposit += depositToAcct;
      if (acct === "pension" || acct === "irp") {
        state.taxCredit += depositToAcct * taxCreditRate(taxOptions.highIncome);
      }
      remainingTaxEligible -= depositToAcct;
    }

    // 4. 절세계좌 못 들어간 적격 종목 → 일반계좌
    if (remainingTaxEligible > 0) {
      for (const i of taxEligibleIdx) {
        const subWeight = weights[i] / taxEligibleWeight;
        const buyAmt = remainingTaxEligible * subWeight;
        if (buyAmt <= 0) continue;
        executeTrade("general", i, date, buyAmt, fxRate);
      }
      states.general.deposit += remainingTaxEligible;
    }

    // 5. 비적격 종목 (미국직상장, 레버리지) → 일반계좌 직행
    for (const i of generalOnlyIdx) {
      const buyAmt = netCash * weights[i];
      if (buyAmt <= 0) continue;
      executeTrade("general", i, date, buyAmt, fxRate);
      states.general.deposit += buyAmt;
    }
  }

  /**
   * 풍차돌리기 후 연금 직접 매수 (계좌 분배 무시, 연금에 바로)
   */
  function buyDirectToPension(date: string, krwAmount: number) {
    const fxRate = valueAtOrBefore(fx, date);
    for (let i = 0; i < tickers.length; i++) {
      const alloc = krwAmount * weights[i];
      if (alloc <= 0) continue;
      const name = holdingNames[tickers[i]] ?? tickers[i];
      // 연금 자격 없는 종목은 일반으로
      if (!isEligible(tickers[i], name, "pension")) {
        executeTrade("general", i, date, alloc, fxRate);
        states.general.deposit += alloc;
        continue;
      }
      executeTrade("pension", i, date, alloc, fxRate);
    }
  }

  /**
   * ISA 재가입: 계좌 분배 없이 ISA에 바로 (한도 내)
   */
  function buyDirectToIsa(date: string, krwAmount: number) {
    const fxRate = valueAtOrBefore(fx, date);
    for (let i = 0; i < tickers.length; i++) {
      const alloc = krwAmount * weights[i];
      if (alloc <= 0) continue;
      const name = holdingNames[tickers[i]] ?? tickers[i];
      if (!isEligible(tickers[i], name, "isa")) {
        executeTrade("general", i, date, alloc, fxRate);
        states.general.deposit += alloc;
        continue;
      }
      executeTrade("isa", i, date, alloc, fxRate);
      states.isa.isaCumulativeDeposit += alloc;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 배당 처리 (매일)
  // - adjClose 사용으로 잔액엔 이미 반영. 여기선 세금 + 추적만.
  // ──────────────────────────────────────────────────────────────
  function processDividends(date: string) {
    const fxRate = valueAtOrBefore(fx, date);
    const year = parseInt(date.slice(0, 4), 10);
    if (!yearlyDivMap.has(year)) yearlyDivMap.set(year, { gross: 0, tax: 0 });

    for (let i = 0; i < tickers.length; i++) {
      const dPerShare = getDividend(tickers[i], date);
      if (dPerShare <= 0) continue;

      for (const acct of ["isa", "pension", "irp", "general"] as AccountType[]) {
        const shares = states[acct].shares[i];
        if (shares <= 0) continue;

        // 배당금 KRW 환산
        let grossKrw: number;
        if (isKor[i]) {
          grossKrw = shares * dPerShare;
        } else {
          const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
          grossKrw = shares * dPerShare * rate;
        }
        if (grossKrw <= 0) continue;

        // 세금 계산
        let taxKrw = 0;
        if (acct === "general") {
          // 일반계좌: 배당세 15.4%
          taxKrw = grossKrw * DIVIDEND_TAX_RATE;
        } else if (acct === "isa") {
          // ISA: 배당은 만기시점에 합산 정산 (여기선 추적만)
          taxKrw = 0;
        } else {
          // 연금/IRP: 인출 시점까지 과세이연
          taxKrw = 0;
        }

        states[acct].dividend += grossKrw;
        states[acct].tax += taxKrw;

        const ymap = yearlyDivMap.get(year)!;
        ymap.gross += grossKrw;
        ymap.tax += taxKrw;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 시뮬레이션 메인 루프
  // ──────────────────────────────────────────────────────────────

  // 첫날: 초기자본 + 첫 달 적립
  const initialNominal = nominalDeposit(startDate, dcaOptions.initialCapital);
  buyWithAllocation(startDate, initialNominal);
  const firstMonthly = nominalDeposit(startDate, dcaOptions.monthlyDeposit);
  buyWithAllocation(startDate, firstMonthly);

  let prevMonth = startDate.slice(0, 7);
  let prevYear = startDate.slice(0, 4);
  let isaStartYear = parseInt(prevYear, 10);
  let cycleNumber = 1;

  // 시계열 첫 점
  const recordSeries = (date: string) => {
    const byAcct: Record<AccountType, number> = {
      isa: evaluateAcct("isa", date),
      pension: evaluateAcct("pension", date),
      irp: evaluateAcct("irp", date),
      general: evaluateAcct("general", date),
    };
    const totalBalance = byAcct.isa + byAcct.pension + byAcct.irp + byAcct.general;
    const totalDeposit =
      states.isa.deposit + states.pension.deposit + states.irp.deposit + states.general.deposit;
    const totalDividend =
      states.isa.dividend + states.pension.dividend + states.irp.dividend + states.general.dividend;
    const totalTax =
      states.isa.tax + states.pension.tax + states.irp.tax + states.general.tax;
    series.push({ date, totalBalance, totalDeposit, totalDividend, totalTax, byAccount: byAcct });
  };

  recordSeries(startDate);

  for (let di = 1; di < dates.length; di++) {
    const date = dates[di];
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);

    // 배당 처리 (매일)
    processDividends(date);

    // 연도 변경
    if (year !== prevYear) {
      // 연 한도 리셋
      for (const k in states) states[k as AccountType].annualDeposited = 0;

      // 풍차돌리기 (3년 주기)
      if (taxOptions.windmillEnabled && parseInt(year, 10) - isaStartYear === 3) {
        const isaBal = evaluateAcct("isa", date);
        if (isaBal > 0) {
          const isaProfit = isaBal - states.isa.deposit + states.isa.dividend;
          const isaTax =
            isaProfit > 0
              ? Math.max(0, isaProfit - isaTaxFreeLimit(taxOptions.isaServingType)) *
                ISA_OVER_LIMIT_TAX_RATE
              : 0;
          states.isa.tax += isaTax;

          const ymap = yearlyDivMap.get(parseInt(year, 10)) ?? { gross: 0, tax: 0 };
          ymap.tax += isaTax;
          yearlyDivMap.set(parseInt(year, 10), ymap);

          const afterTax = isaBal - isaTax;
          const transferToPension = afterTax * taxOptions.windmillTransferRatio;
          const reopenIsa = afterTax - transferToPension;

          // ISA 청산 (shares + 누적상태 리셋)
          states.isa = newState("isa");
          isaStartYear = parseInt(year, 10);

          // 풍차 추가 세액공제
          const bonusCredit = windmillTaxCredit(transferToPension, taxOptions.highIncome);
          states.pension.taxCredit += bonusCredit;
          states.pension.deposit += transferToPension;

          // 매수 실행 — 분배 우회
          buyDirectToPension(date, transferToPension);
          buyDirectToIsa(date, reopenIsa);
          states.isa.deposit = reopenIsa;

          windmillCycles.push({
            cycleNumber: cycleNumber++,
            endYear: parseInt(year, 10),
            isaBalance: isaBal,
            transferToPension,
            reopenIsa,
            taxCreditFromTransfer: bonusCredit,
          });
        }
      }

      prevYear = year;
    }

    // 월 변경 → 적립
    if (month !== prevMonth) {
      const nominal = nominalDeposit(date, dcaOptions.monthlyDeposit);
      buyWithAllocation(date, nominal);
      prevMonth = month;
    }

    // 시계열 기록 (월말마다 — 데이터 줄이기)
    if (di === dates.length - 1 || month !== dates[di + 1]?.slice(0, 7)) {
      recordSeries(date);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 최종 정산: ISA 만기 (풍차 미사용 시)
  // ──────────────────────────────────────────────────────────────
  if (!taxOptions.windmillEnabled && states.isa.shares.some((s) => s > 0)) {
    const isaBal = evaluateAcct("isa", endDate);
    const isaProfit = isaBal - states.isa.deposit + states.isa.dividend;
    const isaTax =
      isaProfit > 0
        ? Math.max(0, isaProfit - isaTaxFreeLimit(taxOptions.isaServingType)) *
          ISA_OVER_LIMIT_TAX_RATE
        : 0;
    states.isa.tax += isaTax;
    const endYear = parseInt(endDate.slice(0, 4), 10);
    const ymap = yearlyDivMap.get(endYear) ?? { gross: 0, tax: 0 };
    ymap.tax += isaTax;
    yearlyDivMap.set(endYear, ymap);
  }

  // ──────────────────────────────────────────────────────────────
  // 결과 조립
  // ──────────────────────────────────────────────────────────────
  const accounts: AccountResult[] = activeAccounts.map((cfg) => {
    const s = states[cfg.type];
    const finalBal = evaluateAcct(cfg.type, endDate);
    return {
      type: cfg.type,
      finalBalance: Math.max(0, finalBal - s.tax),
      totalDeposit: s.deposit,
      totalDividend: s.dividend,
      totalTax: s.tax,
      totalTaxCredit: s.taxCredit,
      warnings: s.warnings,
    };
  });

  const totalFinalRaw = accounts.reduce((sum, a) => sum + a.finalBalance, 0);
  const totalTaxCredit = accounts.reduce((sum, a) => sum + a.totalTaxCredit, 0);
  const totalDividend = accounts.reduce((sum, a) => sum + a.totalDividend, 0);
  const totalDividendTax = accounts.reduce((sum, a) => sum + a.totalTax, 0);
  const totalFinalBalance = totalFinalRaw + totalTaxCredit;

  // 연도별 배당 (실질 환산)
  const yearlyDividends: DividendCashflow[] = Array.from(yearlyDivMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => {
      const yEnd = `${year}-12-31`;
      return {
        year,
        grossKrw: Math.round(v.gross),
        netKrw: Math.round(v.gross - v.tax),
        realNetKrw: Math.round(realKrwAt(yEnd, v.gross - v.tax)),
        taxKrw: Math.round(v.tax),
      };
    });

  return {
    accounts,
    totalFinalBalance,
    totalTaxCredit,
    totalDividend,
    totalDividendTax,
    windmillCycles,
    unallocated,
    series,
    yearlyDividends,
    generalCaseBalance: 0, // route.ts에서 채움
    totalSavings: 0,
    afterTaxCagr: 0,
    generalCaseCagr: 0,
  };
}

// ──────────────────────────────────────────────────────────────
// 일반계좌 전용 시뮬레이션 (절세 비교용 — 같은 평가 로직 보장)
// ──────────────────────────────────────────────────────────────
export function simulateGeneralOnly(input: MergedSimInput): {
  finalBalance: number;
  totalDeposit: number;
  totalDividend: number;
  totalTax: number;
} {
  const { prices, tickers, weights, dates, dcaOptions } = input;

  const priceMap = new Map<string, Map<string, number>>();
  const divMap = new Map<string, Map<string, number>>();
  for (const ps of prices) {
    const pm = new Map<string, number>();
    const dm = new Map<string, number>();
    for (const r of ps.rows) {
      pm.set(r.date, r.adjClose);
      if (r.dividends > 0) dm.set(r.date, r.dividends);
    }
    priceMap.set(ps.ticker, pm);
    divMap.set(ps.ticker, dm);
  }

  const cpi = loadCpi();
  const fx = loadFxUsdKrw();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const cpiStart = valueAtOrBefore(cpi, startDate) ?? 100;
  const cpiNow = cpi.length > 0 ? cpi[cpi.length - 1].value : cpiStart;
  const isKor = tickers.map(isKoreanTicker);

  function nominalDeposit(date: string, amt: number): number {
    if (dcaOptions.basis === "start") return amt;
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return amt * (cpiAt / cpiNow);
  }

  function getPrice(ticker: string, date: string): number {
    const m = priceMap.get(ticker);
    if (!m) return 0;
    let px = m.get(date);
    if (px !== undefined && px > 0) return px;
    const allDates = Array.from(m.keys()).sort();
    for (let j = allDates.length - 1; j >= 0; j--) {
      if (allDates[j] <= date) {
        const c = m.get(allDates[j]);
        if (c !== undefined && c > 0) return c;
      }
    }
    return 0;
  }

  const shares = tickers.map(() => 0);
  let totalDeposit = 0;
  let totalDividend = 0;
  let totalTax = 0;

  function buy(date: string, cashKrw: number) {
    const net = cashKrw * (1 - dcaOptions.feeRate);
    const fxRate = valueAtOrBefore(fx, date);
    for (let i = 0; i < tickers.length; i++) {
      const alloc = net * weights[i];
      if (alloc <= 0) continue;
      const px = getPrice(tickers[i], date);
      if (px <= 0) continue;
      if (isKor[i]) {
        shares[i] += alloc / px;
      } else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        shares[i] += alloc / rate / px;
      }
    }
    totalDeposit += net;
  }

  // 첫날: 초기자본 + 첫 달
  buy(startDate, nominalDeposit(startDate, dcaOptions.initialCapital));
  buy(startDate, nominalDeposit(startDate, dcaOptions.monthlyDeposit));

  let prevMonth = startDate.slice(0, 7);

  // 메인 루프 (배당세 처리)
  for (let di = 1; di < dates.length; di++) {
    const date = dates[di];
    const month = date.slice(0, 7);
    const fxRate = valueAtOrBefore(fx, date);

    // 배당세 (일반계좌 → 모두 15.4%)
    for (let i = 0; i < tickers.length; i++) {
      const dPerShare = divMap.get(tickers[i])?.get(date) ?? 0;
      if (dPerShare <= 0 || shares[i] <= 0) continue;
      let grossKrw: number;
      if (isKor[i]) {
        grossKrw = shares[i] * dPerShare;
      } else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        grossKrw = shares[i] * dPerShare * rate;
      }
      totalDividend += grossKrw;
      totalTax += grossKrw * DIVIDEND_TAX_RATE;
    }

    if (month !== prevMonth) {
      buy(date, nominalDeposit(date, dcaOptions.monthlyDeposit));
      prevMonth = month;
    }
  }

  // 최종 평가
  const fxRate = valueAtOrBefore(fx, endDate);
  let finalBalance = 0;
  for (let i = 0; i < tickers.length; i++) {
    if (shares[i] <= 0) continue;
    const px = getPrice(tickers[i], endDate);
    if (px <= 0) continue;
    if (isKor[i]) {
      finalBalance += shares[i] * px;
    } else {
      const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
      finalBalance += shares[i] * px * rate;
    }
  }

  return {
    finalBalance: Math.max(0, finalBalance - totalTax),
    totalDeposit,
    totalDividend,
    totalTax,
  };
}