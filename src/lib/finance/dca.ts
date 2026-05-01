/**
 * 적립식(DCA) 시뮬레이션 + 인플레이션 보정 + 환율 환산.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DcaOptions, DcaResult, PriceSeries } from "./types";

const MACRO_DIR = join(process.cwd(), "data", "macro");

// ──────────────────────────────────────────────────────────────
// CPI / 환율 로더
// ──────────────────────────────────────────────────────────────

type DateValue = { date: string; value: number };

function loadCpi(): DateValue[] {
  const fp = join(MACRO_DIR, "kr_cpi.csv");
  if (!existsSync(fp)) return [];
  const text = readFileSync(fp, "utf-8").trim();
  const lines = text.split("\n").slice(1);
  return lines
    .map((l) => l.split(","))
    .filter((c) => c.length >= 2)
    .map((c) => ({ date: c[0], value: Number(c[1]) }))
    .filter((r) => Number.isFinite(r.value));
}

function loadFxUsdKrw(): DateValue[] {
  const fp = join(MACRO_DIR, "usdkrw.csv");
  if (!existsSync(fp)) return [];
  const text = readFileSync(fp, "utf-8").trim();
  const lines = text.split("\n").slice(1);
  return lines
    .map((l) => l.split(","))
    .filter((c) => c.length >= 2)
    .map((c) => ({ date: c[0], value: Number(c[1]) }))
    .filter((r) => Number.isFinite(r.value));
}

/** 특정 날짜 이하의 가장 최근 값 찾기 (이진 탐색 안 쓰고 단순). */
function valueAtOrBefore(series: DateValue[], date: string): number | null {
  let last: number | null = null;
  for (const r of series) {
    if (r.date <= date) last = r.value;
    else break;
  }
  return last;
}

/** 한국 티커 판별 (loader.ts와 동일 규칙). */
function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

// ──────────────────────────────────────────────────────────────
// 적립식 시뮬레이션
// ──────────────────────────────────────────────────────────────

/**
 * 적립식 시뮬레이션.
 *
 * 가정:
 * - 모든 가격 시계열은 동일한 거래일 정렬됨 (alignReturns 후 매트릭스로 들어옴).
 * - 미국 ETF는 USD 종가, 한국 ETF는 KRW 종가. 환율로 KRW 통일.
 * - 매월 첫 거래일에 monthlyDeposit 만큼 매수 (비중 비율대로).
 * - 매수 시 feeRate 만큼 수수료 차감.
 * - 리밸런싱은 별도 처리 안 함 (백테스트의 비중 곡선과 평균적으로 매치되도록).
 */
export function simulateDca(
  prices: PriceSeries[],     // 종목별 가격 (정렬 안 됐어도 OK, 내부에서 dates 기준 lookup)
  tickers: string[],
  weights: number[],          // 0~1 합 = 1
  dates: string[],            // 공통 거래일 (오름차순)
  options: DcaOptions,
): DcaResult {
  // 가격 lookup: ticker -> Map<date, adjClose>
  const priceMap = new Map<string, Map<string, number>>();
  for (const ps of prices) {
    const m = new Map<string, number>();
    for (const r of ps.rows) m.set(r.date, r.adjClose);
    priceMap.set(ps.ticker, m);
  }

  const cpi = loadCpi();
  const fx = loadFxUsdKrw();
  const startDate = dates[0];
  const cpiStart = valueAtOrBefore(cpi, startDate) ?? 100;

  // basis 처리: "now"면 입력값을 시작 시점 명목으로 역산
  let initialCapital = options.initialCapital;
  let monthlyDeposit = options.monthlyDeposit;
  if (options.basis === "now") {
    const cpiNow = cpi.length > 0 ? cpi[cpi.length - 1].value : cpiStart;
    const factor = cpiStart / cpiNow;
    initialCapital *= factor;
    monthlyDeposit *= factor;
  }

  // 종목별 보유 수량 (KRW 환산 가격으로 매수)
  const shares: number[] = tickers.map(() => 0);
  let totalDeposit = 0;
  let totalFee = 0;
  const series: { date: string; balance: number; deposit: number }[] = [];

  /** 특정 날짜의 KRW 단위 가격 (한국=그대로, 미국=환율 곱). */
  function priceKrw(ticker: string, date: string): number | null {
    const m = priceMap.get(ticker);
    if (!m) return null;
    const p = m.get(date);
    if (p === undefined) return null;
    if (isKoreanTicker(ticker)) return p;
    // 미국 ETF: USD → KRW
    const rate = valueAtOrBefore(fx, date);
    if (rate === null) return null;
    return p * rate;
  }

  /** cash를 weights 비율로 매수. */
  function buy(date: string, cash: number) {
    const fee = cash * options.feeRate;
    totalFee += fee;
    const net = cash - fee;
    for (let i = 0; i < tickers.length; i++) {
      const alloc = net * weights[i];
      const px = priceKrw(tickers[i], date);
      if (px === null || px <= 0) continue;
      shares[i] += alloc / px;
    }
  }

  // 1) 시작일에 초기 자본 매수
  buy(startDate, initialCapital);
  totalDeposit += initialCapital;

  // 2) 일별 루프, 매월 첫 거래일에 적립금 매수
  let prevMonth = startDate.substring(0, 7);
  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const month = date.substring(0, 7);

    // 새 달의 첫 거래일이면 적립
    if (month !== prevMonth) {
      buy(date, monthlyDeposit);
      totalDeposit += monthlyDeposit;
      prevMonth = month;
    }

    // 그날의 평가액
    let bal = 0;
    for (let i = 0; i < tickers.length; i++) {
      const px = priceKrw(tickers[i], date);
      if (px === null) continue;
      bal += shares[i] * px;
    }
    series.push({ date, balance: bal, deposit: totalDeposit });
  }

  const finalBalance = series.length > 0 ? series[series.length - 1].balance : 0;

  // 실질 구매력 = 최종잔액 / (CPI_end / CPI_start)
  const endDate = dates[dates.length - 1];
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