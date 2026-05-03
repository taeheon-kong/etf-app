/**
 * 적립식(DCA) + 절세 통합 시뮬레이션 — 한국 세제 정확 반영
 *
 * 핵심 세제 (2024 기준):
 *
 * [일반계좌]
 *  - 국내 주식형 ETF: 매매차익 비과세, 배당 15.4%
 *  - 국내상장 해외 ETF: 매매차익 + 배당 모두 15.4% (배당소득세)
 *  - 국내상장 채권/원자재 ETF: 매매차익 + 배당 모두 15.4%
 *  - 미국 직상장: 양도세 22% (250만 공제), 배당 15% 원천
 *
 * [ISA] 3년 의무 + 손익통산 + 분리과세
 *  - 국내 주식형 매매차익: 무조건 비과세 (손익통산 X)
 *  - 그 외 매매차익 + 모든 배당: 손익통산 → 비과세 한도(200/400만) → 초과분 9.9%
 *
 * [연금/IRP]
 *  - 매년 세액공제 (16.5% / 13.2%)
 *  - 인출 시 5.5% 연금소득세 (1500만 초과 시 종합과세)
 *
 * 종목별 비용기반(cost basis) 추적이 필수.
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
  ANNUAL_LIMIT,
  ISA_TOTAL_LIMIT,
  isaTaxFreeLimit,
  taxCreditRate,
  ISA_OVER_LIMIT_TAX_RATE,
  DIVIDEND_TAX_RATE,
  OVERSEAS_CAPITAL_GAIN_TAX_RATE,
  OVERSEAS_CAPITAL_GAIN_DEDUCTION,
  windmillTaxCredit,
} from "./taxHelpers";
import { KR_ETF_CATALOG } from "./catalogKr";

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
  shares: number[];        // 종목별 보유 수량
  costBasis: number[];     // 종목별 누적 매수액 (KRW)
  divReceived: number[];   // 종목별 누적 배당 (KRW, 세전)
  deposit: number;
  taxCredit: number;
  isaCumulativeDeposit: number;
  annualDeposited: number;
  dividendTax: number;     // 매년 떼는 배당세 (일반계좌만)
  settlementTax: number;   // ISA/일반 만기 정산세
  warnings: string[];
};

// ──────────────────────────────────────────────────────────────
// 종목 분류 헬퍼
// ──────────────────────────────────────────────────────────────
function getKrCategory(ticker: string): string | undefined {
  const e = KR_ETF_CATALOG.find((x) => x.ticker === ticker);
  return e?.tags?.[0];
}

/** 한국 ETF가 "국내 주식형"인지 (매매차익 비과세 대상) */
function isDomesticEquityEtf(ticker: string, name: string): boolean {
  if (!isKoreanTicker(ticker)) return false;
  return isDomesticEquity(ticker, getKrCategory(ticker) as any, name);
}

// ──────────────────────────────────────────────────────────────
export function simulateDcaWithTax(input: MergedSimInput): MergedSimResult {
  const { prices, tickers, weights, dates, holdingNames, dcaOptions, taxOptions } = input;

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

  function nominalDeposit(date: string, amt: number): number {
    if (dcaOptions.basis === "start") return amt;
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return amt * (cpiAt / cpiNow);
  }

  function realKrwAt(date: string, krw: number): number {
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return krw * (cpiStart / cpiAt);
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

  // 종목 분류 사전 계산
  const isKor = tickers.map(isKoreanTicker);
  const isDomestic = tickers.map((t, i) => isDomesticEquityEtf(t, holdingNames[t] ?? t));
  const isLevInv = tickers.map((t, i) => isLeveragedOrInverse(holdingNames[t] ?? t));

  const newState = (type: AccountType): AcctState => ({
    type,
    shares: tickers.map(() => 0),
    costBasis: tickers.map(() => 0),
    divReceived: tickers.map(() => 0),
    deposit: 0,
    taxCredit: 0,
    isaCumulativeDeposit: 0,
    annualDeposited: 0,
    dividendTax: 0,
    settlementTax: 0,
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

  const windmillCycles: WindmillCycle[] = [];
  const unallocated: { ticker: string; reason: string }[] = [];
  const series: MergedSeriesPoint[] = [];
  const yearlyDivMap = new Map<number, { gross: number; tax: number }>();

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const name = holdingNames[ticker] ?? ticker;
    if (!isKor[i]) {
      unallocated.push({ ticker, reason: `${name}: 미국 직상장 → 일반계좌만 가능` });
    } else if (isLevInv[i]) {
      unallocated.push({ ticker, reason: `${name}: 레버리지/인버스 → 연금/IRP 불가` });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 평가/매수
  // ──────────────────────────────────────────────────────────────
  function evaluateAcctByAsset(acct: AccountType, date: string): number[] {
    const fxRate = valueAtOrBefore(fx, date);
    const out: number[] = tickers.map(() => 0);
    const shares = states[acct].shares;
    for (let i = 0; i < tickers.length; i++) {
      if (shares[i] <= 0) continue;
      const px = getPrice(tickers[i], date);
      if (px <= 0) continue;
      if (isKor[i]) out[i] = shares[i] * px;
      else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        out[i] = shares[i] * px * rate;
      }
    }
    return out;
  }

  function evaluateAcct(acct: AccountType, date: string): number {
    return evaluateAcctByAsset(acct, date).reduce((s, v) => s + v, 0);
  }

  function executeTrade(
    acct: AccountType, assetIdx: number, date: string, krwAmount: number, fxRate: number | null
  ) {
    const px = getPrice(tickers[assetIdx], date);
    if (px <= 0) return;
    if (isKor[assetIdx]) {
      states[acct].shares[assetIdx] += krwAmount / px;
    } else {
      const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
      states[acct].shares[assetIdx] += krwAmount / rate / px;
    }
    states[acct].costBasis[assetIdx] += krwAmount;
  }

  function buyWithAllocation(date: string, cashKrw: number) {
    const netCash = cashKrw * (1 - dcaOptions.feeRate);
    const fxRate = valueAtOrBefore(fx, date);

    const taxEligibleIdx: number[] = [];
    const generalOnlyIdx: number[] = [];
    for (let i = 0; i < tickers.length; i++) {
      if (isKor[i] && !isLevInv[i]) taxEligibleIdx.push(i);
      else generalOnlyIdx.push(i);
    }

    let taxEligibleWeight = 0;
    for (const i of taxEligibleIdx) taxEligibleWeight += weights[i];

    let remainingTaxEligible = netCash * taxEligibleWeight;

    for (const cfg of activeAccounts) {
      if (remainingTaxEligible <= 0) break;
      const acct = cfg.type;
      if (acct === "general") continue;
      const state = states[acct];

      let canDeposit = ANNUAL_LIMIT[acct] - state.annualDeposited;
      if (acct === "isa") canDeposit = Math.min(canDeposit, ISA_TOTAL_LIMIT - state.isaCumulativeDeposit);
      if (canDeposit <= 0) continue;

      const depositToAcct = Math.min(remainingTaxEligible, canDeposit);

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

    if (remainingTaxEligible > 0) {
      for (const i of taxEligibleIdx) {
        const subWeight = weights[i] / taxEligibleWeight;
        const buyAmt = remainingTaxEligible * subWeight;
        if (buyAmt <= 0) continue;
        executeTrade("general", i, date, buyAmt, fxRate);
      }
      states.general.deposit += remainingTaxEligible;
    }

    for (const i of generalOnlyIdx) {
      const buyAmt = netCash * weights[i];
      if (buyAmt <= 0) continue;
      executeTrade("general", i, date, buyAmt, fxRate);
      states.general.deposit += buyAmt;
    }
  }

  function buyDirectToPension(date: string, krwAmount: number) {
    const fxRate = valueAtOrBefore(fx, date);
    for (let i = 0; i < tickers.length; i++) {
      const alloc = krwAmount * weights[i];
      if (alloc <= 0) continue;
      const name = holdingNames[tickers[i]] ?? tickers[i];
      if (!isEligible(tickers[i], name, "pension")) {
        executeTrade("general", i, date, alloc, fxRate);
        states.general.deposit += alloc;
        continue;
      }
      executeTrade("pension", i, date, alloc, fxRate);
    }
  }

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
  // ──────────────────────────────────────────────────────────────
  function processDividends(date: string) {
    const fxRate = valueAtOrBefore(fx, date);
    const year = parseInt(date.slice(0, 4), 10);
    if (!yearlyDivMap.has(year)) yearlyDivMap.set(year, { gross: 0, tax: 0 });

    for (let i = 0; i < tickers.length; i++) {
      const dPerShare = divMap.get(tickers[i])?.get(date) ?? 0;
      if (dPerShare <= 0) continue;

      for (const acct of ["isa", "pension", "irp", "general"] as AccountType[]) {
        const s = states[acct];
        const shares = s.shares[i];
        if (shares <= 0) continue;

        let grossKrw: number;
        if (isKor[i]) grossKrw = shares * dPerShare;
        else {
          const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
          grossKrw = shares * dPerShare * rate;
        }
        if (grossKrw <= 0) continue;

        s.divReceived[i] += grossKrw;

        // 매년 부과되는 배당세는 일반계좌만
        // ISA 배당세는 만기에 손익통산
        // 연금/IRP는 인출시까지 과세이연
        let taxKrw = 0;
        if (acct === "general") {
          taxKrw = grossKrw * DIVIDEND_TAX_RATE;
          s.dividendTax += taxKrw;
        }

        const ymap = yearlyDivMap.get(year)!;
        ymap.gross += grossKrw;
        ymap.tax += taxKrw;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // ISA 만기 정산 (정확한 한국 세제)
  // ──────────────────────────────────────────────────────────────
  function settleIsa(date: string): number {
    // 종목별 평가액 + 배당 누적
    const valueByAsset = evaluateAcctByAsset("isa", date);
    let domesticCapitalGain = 0;     // 국내 주식형 매매차익 (비과세, 손익통산 제외)
    let taxableCapitalGain = 0;      // 그 외 매매차익 (손익통산 대상)
    let totalDividends = 0;          // 모든 배당 (손익통산 대상)

    for (let i = 0; i < tickers.length; i++) {
      if (states.isa.shares[i] <= 0) continue;
      const cap = valueByAsset[i] - states.isa.costBasis[i];
      if (isDomestic[i]) {
        domesticCapitalGain += cap; // 비과세 (손익통산에 안 들어감)
      } else {
        taxableCapitalGain += cap;
      }
      totalDividends += states.isa.divReceived[i];
    }

    // 손익통산 대상 = 비국내주식형 매매차익 + 모든 배당
    const taxableIncome = taxableCapitalGain + totalDividends;
    const taxFreeLimit = isaTaxFreeLimit(taxOptions.isaServingType);
    const taxBase = Math.max(0, taxableIncome - taxFreeLimit);
    const tax = taxBase * ISA_OVER_LIMIT_TAX_RATE;

    states.isa.settlementTax += tax;
    return tax;
  }

  // ──────────────────────────────────────────────────────────────
  // 일반계좌 만기 정산 (보유 ETF 매도 가정)
  // - 국내 주식형: 매매차익 비과세
  // - 국내상장 해외/채권/원자재: 15.4% (배당세는 매년 이미 떼었음, 매매차익에만)
  // - 미국 직상장: 22% 양도세 (250만 공제)
  // ──────────────────────────────────────────────────────────────
  function settleGeneral(date: string) {
    const valueByAsset = evaluateAcctByAsset("general", date);
    let usGain = 0; // 미국 직상장 합산 (250만 공제는 합산 후)

    for (let i = 0; i < tickers.length; i++) {
      if (states.general.shares[i] <= 0) continue;
      const cap = valueByAsset[i] - states.general.costBasis[i];
      if (cap <= 0) continue;

      if (isDomestic[i]) {
        // 국내 주식형 매매차익 비과세
        continue;
      } else if (!isKor[i]) {
        // 미국 직상장 → 합산
        usGain += cap;
      } else {
        // 국내상장 해외/채권/원자재: 매매차익에 15.4% 배당소득세
        states.general.dividendTax += cap * DIVIDEND_TAX_RATE;
      }
    }

    if (usGain > 0) {
      const taxable = Math.max(0, usGain - OVERSEAS_CAPITAL_GAIN_DEDUCTION);
      states.general.settlementTax += taxable * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 시뮬레이션 메인 루프
  // ──────────────────────────────────────────────────────────────
  buyWithAllocation(startDate, nominalDeposit(startDate, dcaOptions.initialCapital));
  buyWithAllocation(startDate, nominalDeposit(startDate, dcaOptions.monthlyDeposit));

  let prevMonth = startDate.slice(0, 7);
  let prevYear = startDate.slice(0, 4);
  let isaStartYear = parseInt(prevYear, 10);
  let cycleNumber = 1;

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
    let totalDiv = 0, totalTax = 0;
    for (const acct of ["isa", "pension", "irp", "general"] as AccountType[]) {
      const s = states[acct];
      for (let i = 0; i < tickers.length; i++) totalDiv += s.divReceived[i];
      totalTax += s.dividendTax;
    }
    series.push({ date, totalBalance, totalDeposit, totalDividend: totalDiv, totalTax, byAccount: byAcct });
  };

  recordSeries(startDate);

  for (let di = 1; di < dates.length; di++) {
    const date = dates[di];
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);

    processDividends(date);

    if (year !== prevYear) {
      for (const k in states) states[k as AccountType].annualDeposited = 0;

      // 풍차돌리기 (3년 주기)
      if (taxOptions.windmillEnabled && parseInt(year, 10) - isaStartYear === 3) {
        const isaBal = evaluateAcct("isa", date);
        if (isaBal > 0) {
          const tax = settleIsa(date);
          const afterTax = isaBal - tax;
          const transferToPension = afterTax * taxOptions.windmillTransferRatio;
          const reopenIsa = afterTax - transferToPension;

          // ISA 청산 (만기세는 누적되어 있음, shares만 리셋)
          const carriedSettlementTax = states.isa.settlementTax;
          states.isa = newState("isa");
          states.isa.settlementTax = carriedSettlementTax;
          isaStartYear = parseInt(year, 10);

          const bonusCredit = windmillTaxCredit(transferToPension, taxOptions.highIncome);
          states.pension.taxCredit += bonusCredit;
          states.pension.deposit += transferToPension;

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

    if (month !== prevMonth) {
      buyWithAllocation(date, nominalDeposit(date, dcaOptions.monthlyDeposit));
      prevMonth = month;
    }

    if (di === dates.length - 1 || month !== dates[di + 1]?.slice(0, 7)) {
      recordSeries(date);
    }
  }

  // 최종 정산
  if (!taxOptions.windmillEnabled && states.isa.shares.some((s) => s > 0)) {
    settleIsa(endDate);
  }
  // 일반계좌 만기 정산 (양도세 등)
  if (states.general.shares.some((s) => s > 0)) {
    settleGeneral(endDate);
  }

  // 결과 조립
  const accounts: AccountResult[] = activeAccounts.map((cfg) => {
    const s = states[cfg.type];
    const finalBal = evaluateAcct(cfg.type, endDate);
    const totalTaxForAcct = s.dividendTax + s.settlementTax;
    const totalDivForAcct = s.divReceived.reduce((sum, v) => sum + v, 0);
    return {
      type: cfg.type,
      finalBalance: Math.max(0, finalBal - totalTaxForAcct),
      totalDeposit: s.deposit,
      totalDividend: totalDivForAcct,
      totalTax: totalTaxForAcct,
      totalTaxCredit: s.taxCredit,
      warnings: s.warnings,
    };
  });

  const totalFinalRaw = accounts.reduce((sum, a) => sum + a.finalBalance, 0);
  const totalTaxCredit = accounts.reduce((sum, a) => sum + a.totalTaxCredit, 0);
  const totalDividend = accounts.reduce((sum, a) => sum + a.totalDividend, 0);
  // 화면 표시용 "총 세금"은 배당세만 (만기세 별도 누적되어 잔액에서 이미 차감됨)
  const totalDividendTax =
    states.isa.dividendTax + states.pension.dividendTax + states.irp.dividendTax + states.general.dividendTax;
  const totalFinalBalance = totalFinalRaw + totalTaxCredit;

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
    generalCaseBalance: 0,
    totalSavings: 0,
    afterTaxCagr: 0,
    generalCaseCagr: 0,
  };
}

// ──────────────────────────────────────────────────────────────
// 일반계좌 전용 시뮬레이션 (절세 비교용)
// 메인 시뮬과 동일한 세제 적용 — 만 같은 평가 기준
// ──────────────────────────────────────────────────────────────
export function simulateGeneralOnly(input: MergedSimInput): {
  finalBalance: number;
  totalDeposit: number;
  totalDividend: number;
  totalTax: number;
} {
  const { prices, tickers, weights, dates, holdingNames, dcaOptions } = input;

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
  const isDomestic = tickers.map((t) => isDomesticEquityEtf(t, holdingNames[t] ?? t));

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
  const costBasis = tickers.map(() => 0);
  let totalDeposit = 0;
  let totalDividend = 0;
  let dividendTax = 0;
  let settlementTax = 0;

  function buy(date: string, cashKrw: number) {
    const net = cashKrw * (1 - dcaOptions.feeRate);
    const fxRate = valueAtOrBefore(fx, date);
    for (let i = 0; i < tickers.length; i++) {
      const alloc = net * weights[i];
      if (alloc <= 0) continue;
      const px = getPrice(tickers[i], date);
      if (px <= 0) continue;
      if (isKor[i]) shares[i] += alloc / px;
      else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        shares[i] += alloc / rate / px;
      }
      costBasis[i] += alloc;
    }
    totalDeposit += net;
  }

  buy(startDate, nominalDeposit(startDate, dcaOptions.initialCapital));
  buy(startDate, nominalDeposit(startDate, dcaOptions.monthlyDeposit));

  let prevMonth = startDate.slice(0, 7);

  for (let di = 1; di < dates.length; di++) {
    const date = dates[di];
    const month = date.slice(0, 7);
    const fxRate = valueAtOrBefore(fx, date);

    // 일반계좌 배당세: 모든 종목 15.4% (한국 ETF의 배당, 미국 ETF 배당)
    for (let i = 0; i < tickers.length; i++) {
      const dPerShare = divMap.get(tickers[i])?.get(date) ?? 0;
      if (dPerShare <= 0 || shares[i] <= 0) continue;
      let grossKrw: number;
      if (isKor[i]) grossKrw = shares[i] * dPerShare;
      else {
        const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
        grossKrw = shares[i] * dPerShare * rate;
      }
      totalDividend += grossKrw;
      dividendTax += grossKrw * DIVIDEND_TAX_RATE;
    }

    if (month !== prevMonth) {
      buy(date, nominalDeposit(date, dcaOptions.monthlyDeposit));
      prevMonth = month;
    }
  }

  // 최종 평가
  const fxRate = valueAtOrBefore(fx, endDate);
  const valueByAsset = tickers.map(() => 0);
  let finalBalance = 0;
  for (let i = 0; i < tickers.length; i++) {
    if (shares[i] <= 0) continue;
    const px = getPrice(tickers[i], endDate);
    if (px <= 0) continue;
    if (isKor[i]) valueByAsset[i] = shares[i] * px;
    else {
      const rate = fxRate !== null && fxRate > 0 ? fxRate : 1300;
      valueByAsset[i] = shares[i] * px * rate;
    }
    finalBalance += valueByAsset[i];
  }

  // 매도 가정 정산
  let usGain = 0;
  for (let i = 0; i < tickers.length; i++) {
    if (shares[i] <= 0) continue;
    const cap = valueByAsset[i] - costBasis[i];
    if (cap <= 0) continue;
    if (isDomestic[i]) {
      // 국내 주식형: 비과세
    } else if (!isKor[i]) {
      // 미국 직상장: 합산
      usGain += cap;
    } else {
      // 국내상장 해외/채권/원자재: 매매차익 15.4%
      settlementTax += cap * DIVIDEND_TAX_RATE;
    }
  }
  if (usGain > 0) {
    const taxable = Math.max(0, usGain - OVERSEAS_CAPITAL_GAIN_DEDUCTION);
    settlementTax += taxable * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
  }

  const totalTax = dividendTax + settlementTax;

  return {
    finalBalance: Math.max(0, finalBalance - totalTax),
    totalDeposit,
    totalDividend,
    totalTax,
  };
}