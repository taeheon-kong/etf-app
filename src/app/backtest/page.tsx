"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  BacktestRequest,
  RebalanceFrequency,
  RiskFreeMode,
  DcaOptions,
  AmountBasis,
  TaxOptions,
  AccountConfig,
  AccountType,
  TaxBracket,
} from "@/lib/finance/types";
import { saveBacktestInput } from "@/lib/finance/useBacktestData";
import {
  ETF_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
  findByTicker,
} from "@/lib/finance/catalog";
import {
  KR_ETF_CATALOG,
  KR_CATEGORY_LABELS,
  KR_CATEGORY_ORDER,
  krGroupByCategory,
  krFindByTicker,
} from "@/lib/finance/catalogKr";

type Holding = { ticker: string; weight: number };
type Market = "us" | "kr";

function findAnyTicker(ticker: string):
  | { market: "us"; name: string }
  | { market: "kr"; name: string }
  | null {
  const us = findByTicker(ticker);
  if (us) return { market: "us", name: us.name };
  const kr = krFindByTicker(ticker);
  if (kr) return { market: "kr", name: kr.name };
  return null;
}

const ACCOUNT_LABELS: Record<AccountType, string> = {
  isa: "ISA",
  pension: "연금저축",
  irp: "IRP",
  general: "일반",
};

const ACCOUNT_DESC: Record<AccountType, string> = {
  isa: "연 2,000만 / 누적 1억",
  pension: "연 600만",
  irp: "연 300만",
  general: "한도 없음",
};

const TAX_BRACKETS: { value: TaxBracket; label: string }[] = [
  { value: 0.066, label: "6.6% (1,400만 이하)" },
  { value: 0.165, label: "16.5% (5,000만 이하)" },
  { value: 0.264, label: "26.4% (8,800만 이하)" },
  { value: 0.385, label: "38.5% (1.5억 이하)" },
  { value: 0.418, label: "41.8% (3억 이하)" },
  { value: 0.44, label: "44% (5억 이하)" },
];

export default function BacktestPage() {
  const router = useRouter();

  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: "SPY", weight: 60 },
    { ticker: "QQQ", weight: 30 },
    { ticker: "GLD", weight: 10 },
  ]);
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [rebalance, setRebalance] = useState<RebalanceFrequency>("annual");
  const [rfMode, setRfMode] = useState<RiskFreeMode["type"]>("none");
  const [rfRate, setRfRate] = useState(3);
  const [benchmarkChoice, setBenchmarkChoice] = useState<"auto" | "069500" | "SPY">("auto");

  const [dcaEnabled, setDcaEnabled] = useState(false);
  const [initialCapital, setInitialCapital] = useState(10000000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(500000);
  const [basis, setBasis] = useState<AmountBasis>("start");
  const [feeRate, setFeeRate] = useState(0.015);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [accounts, setAccounts] = useState<AccountConfig[]>([
    { type: "isa", enabled: true, priority: 1 },
    { type: "pension", enabled: true, priority: 2 },
    { type: "irp", enabled: true, priority: 3 },
    { type: "general", enabled: true, priority: 4 },
  ]);
  const [highIncome, setHighIncome] = useState(false);
  const [applyComprehensive, setApplyComprehensive] = useState(false);
  const [taxBracket, setTaxBracket] = useState<TaxBracket>(0.165);
  const [isaServingType, setIsaServingType] = useState<"general" | "preferred">("general");
  const [windmillEnabled, setWindmillEnabled] = useState(false);
  const [windmillRatio, setWindmillRatio] = useState(0.6);
  const [pensionWithdrawalMode, setPensionWithdrawalMode] = useState<"annual" | "lump">("annual");
  const [pensionAnnualWithdrawal, setPensionAnnualWithdrawal] = useState(15_000_000);

  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const weightOK = Math.abs(totalWeight - 100) < 0.1;

  const groupedUs = useMemo(() => groupByCategory(), []);
  const groupedKr = useMemo(() => krGroupByCategory(), []);

  const updateHolding = (i: number, key: keyof Holding, value: string | number) => {
    const next = [...holdings];
    if (key === "ticker") next[i].ticker = value as string;
    else next[i].weight = Number(value);
    setHoldings(next);
  };
  const addHolding = () => {
    if (holdings.length >= 5) return;
    setHoldings([...holdings, { ticker: "SCHD", weight: 0 }]);
  };
  const removeHolding = (i: number) => {
    if (holdings.length <= 1) return;
    setHoldings(holdings.filter((_, idx) => idx !== i));
  };

  const moveAccount = (idx: number, dir: "up" | "down") => {
    const sorted = [...accounts].sort((a, b) => a.priority - b.priority);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sorted.length - 1) return;
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    sorted.forEach((a, i) => (a.priority = i + 1));
    setAccounts(sorted);
  };

  const toggleAccount = (type: AccountType) => {
    setAccounts(accounts.map((a) => a.type === type ? { ...a, enabled: !a.enabled } : a));
  };

  const runBacktest = () => {
    setError(null);
    if (!weightOK) {
      setError(`비중 합이 100%가 아닙니다: ${totalWeight}%`);
      return;
    }
    const riskFree: RiskFreeMode =
      rfMode === "fixed" ? { type: "fixed", rate: rfRate / 100 } : { type: rfMode };
    const dcaOptions: DcaOptions = {
      enabled: dcaEnabled, initialCapital, monthlyDeposit, basis, feeRate: feeRate / 100,
    };
    const taxOptions: TaxOptions = {
      enabled: taxEnabled, accounts, highIncome,
      applyComprehensiveTax: applyComprehensive, taxBracket, isaServingType,
      windmillEnabled, windmillTransferRatio: windmillRatio,
      pensionWithdrawalMode, pensionAnnualWithdrawal,
    };
    const input: BacktestRequest & { dca: DcaOptions; tax: TaxOptions } = {
      holdings: holdings.map((h) => ({ ticker: h.ticker, weight: h.weight / 100 })),
      startDate, endDate, rebalance, benchmark: benchmarkChoice,
      riskFree, dca: dcaOptions, tax: taxOptions,
    };
    saveBacktestInput(input);
    router.push("/backtest/result");
  };

  const sortedAccounts = [...accounts].sort((a, b) => a.priority - b.priority);
  const enabledCount = accounts.filter((a) => a.enabled).length;

  const leveragedHoldings = holdings.filter((h) => {
    const meta = findAnyTicker(h.ticker);
    return meta && /레버리지|인버스|2X|3X|leveraged|inverse|ultra|bull|bear/i.test(meta.name);
  });

  return (
    <div className="px-10 py-10 pb-32 max-w-[1280px] mx-auto">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
        <div>
          <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">백테스트</div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">포트폴리오를 과거 데이터로 검증합니다</h1>
          <p className="text-[13.5px] text-ink-600 mt-2">종목·비중·기간을 정한 뒤 적립식·세금 시나리오까지 함께 시뮬레이션합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: main config */}
        <div className="space-y-6">
          {/* Holdings */}
          <div className="border hairline rounded-lg bg-paper">
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b hairline">
              <div>
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">01 포트폴리오</div>
                <h2 className="text-[15px] font-semibold text-ink-900">종목 + 비중</h2>
              </div>
              <div className={`flex items-center gap-1.5 text-[12px] num ${weightOK ? "text-pos" : "text-down"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${weightOK ? "bg-pos" : "bg-down"}`} />
                합계 {totalWeight}%
              </div>
            </div>
            <div className="px-6 py-5 space-y-2">
              {holdings.map((h, i) => {
                const meta = findAnyTicker(h.ticker);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 num text-[11px] text-ink-500 text-right">{String(i + 1).padStart(2, "0")}</div>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                      className="flex-1 flex items-center gap-3 px-3.5 py-2.5 border hairline rounded-md text-left bg-paper hover:bg-ink-50"
                    >
                      <span className="font-semibold text-ink-900 text-[13.5px] num">{h.ticker}</span>
                      {meta?.market === "kr" && <span className="text-[9px] num text-ink-500">KR</span>}
                      {meta?.market === "us" && <span className="text-[9px] num text-ink-500">US</span>}
                      <span className="text-[12px] text-ink-500 truncate flex-1">{meta?.name ?? "—"}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-400">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-2 border hairline rounded-md px-2.5 py-2 w-[110px]">
                      <input
                        type="number"
                        className="w-full bg-transparent text-right num text-[14px] focus:outline-none font-semibold"
                        value={h.weight}
                        onChange={(e) => updateHolding(i, "weight", e.target.value)}
                      />
                      <span className="text-ink-500 text-[12px]">%</span>
                    </div>
                    <button
                      onClick={() => removeHolding(i)}
                      disabled={holdings.length <= 1}
                      className="p-2 text-ink-400 hover:text-down hover:bg-ink-50 rounded-md disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addHolding}
                disabled={holdings.length >= 5}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 border border-dashed hairline rounded-md text-[12.5px] text-ink-600 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                종목 추가 ({holdings.length}/5)
              </button>
            </div>
          </div>

          {/* Period & options */}
          <div className="border hairline rounded-lg bg-paper">
            <div className="px-6 pt-5 pb-4 border-b hairline">
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">02 기간 · 옵션</div>
              <h2 className="text-[15px] font-semibold text-ink-900">백테스트 설정</h2>
            </div>
            <div className="grid grid-cols-2 divide-x hairline">
              <BtField label="시작일">
                <input
                  type="date"
                  className="w-full bg-transparent num text-[13.5px] focus:outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </BtField>
              <BtField label="종료일">
                <input
                  type="date"
                  className="w-full bg-transparent num text-[13.5px] focus:outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </BtField>
            </div>
            <div className="grid grid-cols-2 divide-x hairline border-t hairline">
              <BtField label="리밸런싱">
                <select
                  className="w-full bg-transparent text-[13.5px] focus:outline-none appearance-none cursor-pointer"
                  value={rebalance}
                  onChange={(e) => setRebalance(e.target.value as RebalanceFrequency)}
                >
                  <option value="none">없음 (Buy & Hold)</option>
                  <option value="annual">연 1회</option>
                  <option value="semiannual">반기</option>
                  <option value="quarterly">분기</option>
                </select>
              </BtField>
              <BtField label="벤치마크">
                <select
                  className="w-full bg-transparent text-[13.5px] focus:outline-none appearance-none cursor-pointer"
                  value={benchmarkChoice}
                  onChange={(e) => setBenchmarkChoice(e.target.value as "auto" | "069500" | "SPY")}
                >
                  <option value="auto">자동</option>
                  <option value="069500">KODEX 200</option>
                  <option value="SPY">SPY</option>
                </select>
              </BtField>
            </div>
            <div className="border-t hairline">
              <BtField label="무위험 수익률 (Sharpe 계산용)">
                <div className="flex gap-2 items-center">
                  <select
                    className="flex-1 bg-transparent text-[13.5px] focus:outline-none appearance-none cursor-pointer"
                    value={rfMode}
                    onChange={(e) => setRfMode(e.target.value as RiskFreeMode["type"])}
                  >
                    <option value="none">사용 안 함 (0%)</option>
                    <option value="fixed">고정값</option>
                    <option value="dynamic">동적 (CD금리 / IRX 자동)</option>
                  </select>
                  {rfMode === "fixed" && (
                    <input
                      type="number"
                      step="0.1"
                      className="w-16 border hairline rounded-md px-2 py-1 text-right num text-[13.5px] focus:outline-none"
                      value={rfRate}
                      onChange={(e) => setRfRate(Number(e.target.value))}
                    />
                  )}
                </div>
              </BtField>
            </div>
          </div>
        </div>

        {/* Right: DCA + Tax */}
        <div className="space-y-6">
          <BtToggleCard
            label="03"
            title="적립식 시뮬레이션"
            desc="초기자본 + 월 적립"
            enabled={dcaEnabled}
            onToggle={setDcaEnabled}
          >
            <div className="space-y-3">
              <BtNumField
                label="초기 자본"
                value={initialCapital}
                onChange={setInitialCapital}
                suffix="원"
                quick={[
                  [1_000_000, "+100만"],
                  [10_000_000, "+1000만"],
                  [100_000_000, "+1억"],
                ]}
              />
              <BtNumField
                label="월 적립액"
                value={monthlyDeposit}
                onChange={setMonthlyDeposit}
                suffix="원"
                quick={[
                  [10_000, "+1만"],
                  [100_000, "+10만"],
                  [1_000_000, "+100만"],
                ]}
              />
              <BtSegmented
                label="금액 기준"
                options={[
                  ["start", "시작 시점"],
                  ["now", "현재 기준"],
                ]}
                value={basis}
                onChange={(v) => setBasis(v as AmountBasis)}
              />
              <BtNumField
                label="매매 수수료"
                value={feeRate}
                onChange={setFeeRate}
                suffix="%"
                step={0.001}
                decimals
              />
            </div>
          </BtToggleCard>

          <BtToggleCard
            label="04"
            title="절세 시뮬레이션"
            desc={`${enabledCount}개 계좌 활성`}
            enabled={taxEnabled}
            onToggle={(v) => {
              setTaxEnabled(v);
              if (v && !dcaEnabled) setDcaEnabled(true);
            }}
          >
            <div className="space-y-4">
              {!dcaEnabled && (
                <div className="text-[11px] text-accent-ink bg-accent-soft border hairline px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                  적립식이 자동 활성화됩니다
                </div>
              )}

              <div>
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">계좌 납입 우선순위</div>
                <div className="space-y-1.5">
                  {sortedAccounts.map((acct, idx) => (
                    <div
                      key={acct.type}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${
                        acct.enabled ? "border-ink-300 bg-ink-50" : "hairline bg-paper opacity-60"
                      }`}
                    >
                      <div className="w-5 text-center num text-[11px] font-medium text-ink-700">
                        {acct.enabled ? String(idx + 1).padStart(2, "0") : "—"}
                      </div>
                      <input
                        type="checkbox"
                        checked={acct.enabled}
                        onChange={() => toggleAccount(acct.type)}
                        className="w-3.5 h-3.5 rounded border-ink-300 accent-ink-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-900 text-[12px]">{ACCOUNT_LABELS[acct.type]}</div>
                        <div className="text-[10px] text-ink-500">{ACCOUNT_DESC[acct.type]}</div>
                      </div>
                      <button
                        onClick={() => moveAccount(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 text-ink-400 hover:text-ink-900 disabled:opacity-20"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveAccount(idx, "down")}
                        disabled={idx === sortedAccounts.length - 1}
                        className="p-1 text-ink-400 hover:text-ink-900 disabled:opacity-20"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <BtSegmented
                label="연봉"
                options={[
                  ["low", "5,500만 이하"],
                  ["high", "초과"],
                ]}
                value={highIncome ? "high" : "low"}
                onChange={(v) => setHighIncome(v === "high")}
              />

              <BtSegmented
                label="ISA 유형"
                options={[
                  ["general", "일반형 (200만)"],
                  ["preferred", "서민형 (400만)"],
                ]}
                value={isaServingType}
                onChange={(v) => setIsaServingType(v as "general" | "preferred")}
              />

              <div className="flex items-center justify-between border hairline px-3 py-2 rounded-md">
                <div>
                  <div className="text-[12px] font-medium text-ink-900">금융소득종합과세</div>
                  <div className="text-[10px] text-ink-500">연 2천만 초과 시</div>
                </div>
                <BtToggle checked={applyComprehensive} onChange={setApplyComprehensive} />
              </div>

              {applyComprehensive && (
                <select
                  className="w-full border hairline rounded-md px-2.5 py-1.5 text-[12px] bg-paper focus:outline-none"
                  value={taxBracket}
                  onChange={(e) => setTaxBracket(Number(e.target.value) as TaxBracket)}
                >
                  {TAX_BRACKETS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              )}

              <div className="border hairline rounded-md overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <div className="text-[12px] font-medium text-ink-900 flex items-center gap-1.5">
                      풍차돌리기
                      <span className="text-[9px] font-medium text-paper bg-accent px-1.5 py-0.5 rounded uppercase tracking-[0.06em]">추천</span>
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5">3년마다 ISA → 연금 이전</div>
                  </div>
                  <BtToggle checked={windmillEnabled} onChange={setWindmillEnabled} />
                </div>
                {windmillEnabled && (
                  <div className="px-3 pb-3 pt-1 border-t hairline">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-ink-500">연금이전 비율</span>
                      <span className="num font-semibold text-accent-ink">{Math.round(windmillRatio * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={windmillRatio * 100}
                      onChange={(e) => setWindmillRatio(Number(e.target.value) / 100)}
                      className="w-full accent-ink-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">연금 / IRP 인출</div>
                <BtSegmented
                  label=""
                  options={[
                    ["annual", "연 분할"],
                    ["lump", "일시금"],
                  ]}
                  value={pensionWithdrawalMode}
                  onChange={(v) => setPensionWithdrawalMode(v as "annual" | "lump")}
                />
                {pensionWithdrawalMode === "annual" && (
                  <input
                    type="number"
                    step="1000000"
                    className="w-full mt-2 border hairline rounded-md px-2.5 py-1.5 text-[12px] num focus:outline-none"
                    value={pensionAnnualWithdrawal}
                    onChange={(e) => setPensionAnnualWithdrawal(Number(e.target.value))}
                    placeholder="연 인출액 (1500만 초과 시 종합과세)"
                  />
                )}
              </div>
            </div>
          </BtToggleCard>
        </div>
      </div>

      {leveragedHoldings.length > 0 && (
        <div className="mt-6 text-[12px] text-accent-ink bg-accent-soft/60 border hairline px-4 py-3 rounded-md">
          <div className="font-medium mb-1 flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            레버리지/인버스 ETF 포함 — 결과 해석 주의
          </div>
          <p className="text-[11.5px] leading-relaxed">
            레버리지 ETF는 일별 변동성으로 인한 시간 감쇠(volatility decay)가 발생합니다. 장기 보유 시 단순 N배 수익이 아닌, 변동성에 따라 누적 수익이 왜곡될 수 있습니다.
          </p>
        </div>
      )}

      {pickerOpen !== null && (
        <TickerPicker
          selected={holdings[pickerOpen].ticker}
          onSelect={(t) => {
            updateHolding(pickerOpen, "ticker", t);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
          groupedUs={groupedUs}
          groupedKr={groupedKr}
        />
      )}

      <div className="fixed bottom-0 left-0 lg:left-[232px] right-0 bg-paper/85 backdrop-blur-md border-t hairline px-10 py-4 z-40">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4">
          <div className="text-[12px] text-ink-600">
            {holdings.length}종목 · 합계{" "}
            <span className={`num font-semibold ${weightOK ? "text-pos" : "text-down"}`}>{totalWeight}%</span>
            <span className="text-ink-300 mx-2">·</span>
            <span className="num">{startDate}</span> ~ <span className="num">{endDate}</span>
          </div>
          <button
            onClick={runBacktest}
            disabled={!weightOK}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-ink-900 text-paper rounded-md text-[14px] font-medium hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            백테스트 실행
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="max-w-[1280px] mx-auto mt-2 text-[12px] text-down bg-down-soft px-3 py-2 rounded-md">{error}</div>
        )}
      </div>
    </div>
  );
}

// ── 헬퍼 ──
function BtField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block px-6 py-4 hover:bg-ink-50 cursor-text">
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function BtToggleCard({
  label, title, desc, enabled, onToggle, children,
}: {
  label: string; title: string; desc: string;
  enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg overflow-hidden bg-paper ${enabled ? "border-ink-900" : "hairline"}`}>
      <div className={`px-5 py-4 flex items-center gap-3 ${enabled ? "bg-ink-50 border-b hairline" : ""}`}>
        <div className="flex-1">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">{label}</div>
          <div className="text-[14px] font-semibold text-ink-900 mt-0.5">{title}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">{desc}</div>
        </div>
        <BtToggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

function BtToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-ink-900" : "bg-ink-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-paper rounded-full transition-transform ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

function BtNumField({
  label, value, onChange, suffix, quick, step, decimals,
}: {
  label: string; value: number; onChange: (v: number) => void; suffix: string;
  quick?: [number, string][]; step?: number; decimals?: boolean;
}) {
  const fmt = (v: number) => (decimals ? v.toString() : v.toLocaleString());
  return (
    <div>
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">{label}</div>
      <div className="flex items-center border hairline rounded-md px-3 py-2 mb-1.5">
        <input
          type={decimals ? "number" : "text"}
          step={step}
          value={decimals ? value : fmt(value)}
          onChange={(e) =>
            onChange(
              decimals
                ? Number(e.target.value) || 0
                : Number(e.target.value.replace(/,/g, "")) || 0
            )
          }
          className="flex-1 bg-transparent num text-[14px] font-semibold focus:outline-none"
        />
        <span className="text-ink-500 text-[12px]">{suffix}</span>
      </div>
      {quick && (
        <div className="flex gap-1">
          {quick.map(([n, l]) => (
            <button
              key={l}
              onClick={() => onChange(value + n)}
              className="num text-[10.5px] px-2 py-1 bg-ink-100 hover:bg-ink-200 rounded text-ink-700 font-medium"
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BtSegmented({
  label, options, value, onChange,
}: {
  label: string; options: [string, string][]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      {label && (
        <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">{label}</div>
      )}
      <div className="flex border hairline rounded-md p-0.5 bg-ink-50">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 text-[11.5px] py-1.5 rounded font-medium transition-colors ${
              value === v ? "bg-paper text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TickerPicker (모달) ──
function TickerPicker({
  selected, onSelect, onClose, groupedUs, groupedKr,
}: {
  selected: string;
  onSelect: (ticker: string) => void;
  onClose: () => void;
  groupedUs: ReturnType<typeof groupByCategory>;
  groupedKr: ReturnType<typeof krGroupByCategory>;
}) {
  const [market, setMarket] = useState<Market>("us");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFlat = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    if (market === "us") {
      return ETF_CATALOG.filter(
        (e) =>
          e.ticker.includes(q) ||
          e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `$${e.aum}B` }));
    } else {
      return KR_ETF_CATALOG.filter(
        (e) =>
          e.ticker.includes(q) ||
          e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => KR_CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({
        ticker: e.ticker,
        name: e.name,
        sizeLabel: `${(e.marCap / 10000).toFixed(1)}조`,
      }));
    }
  }, [query, market]);

  return (
    <div
      className="fixed inset-0 bg-ink-900/40 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-paper border hairline rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b hairline">
          <button
            onClick={() => {
              setMarket("us");
              setQuery("");
              setActiveCategory("all");
            }}
            className={`flex-1 py-3 text-[13px] font-medium transition-colors ${
              market === "us"
                ? "text-ink-900 border-b-2 border-ink-900"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            미국 ETF · <span className="num">{ETF_CATALOG.length}</span>
          </button>
          <button
            onClick={() => {
              setMarket("kr");
              setQuery("");
              setActiveCategory("all");
            }}
            className={`flex-1 py-3 text-[13px] font-medium transition-colors ${
              market === "kr"
                ? "text-ink-900 border-b-2 border-ink-900"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            국내 ETF · <span className="num">{KR_ETF_CATALOG.length}</span>
          </button>
        </div>

        <div className="p-4 border-b hairline">
          <input
            autoFocus
            type="text"
            placeholder="ETF 검색"
            className="w-full border hairline rounded-md px-3.5 py-2 text-[13px] focus:outline-none focus:border-ink-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              <CategoryChip
                label="전체"
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
              />
              {(market === "us" ? CATEGORY_ORDER : KR_CATEGORY_ORDER).map((cat) => (
                <CategoryChip
                  key={cat}
                  label={
                    market === "us"
                      ? CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]
                      : KR_CATEGORY_LABELS[cat as keyof typeof KR_CATEGORY_LABELS]
                  }
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {query ? (
            filteredFlat.length === 0 ? (
              <div className="text-center text-[13px] text-ink-500 py-8">
                일치하는 ETF가 없습니다.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFlat.map((e) => (
                  <TickerRow
                    key={e.ticker}
                    ticker={e.ticker}
                    name={e.name}
                    sizeLabel={e.sizeLabel}
                    selected={e.ticker === selected}
                    onClick={() => onSelect(e.ticker)}
                  />
                ))}
              </div>
            )
          ) : market === "us" ? (
            CATEGORY_ORDER.filter(
              (c) => activeCategory === "all" || activeCategory === c
            ).map((cat) => {
              const items = groupedUs.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] px-2 py-1">
                    {CATEGORY_LABELS[cat]}{" "}
                    <span className="text-ink-400 normal-case num">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow
                        key={e.ticker}
                        ticker={e.ticker}
                        name={e.name}
                        sizeLabel={`$${e.aum}B`}
                        selected={e.ticker === selected}
                        onClick={() => onSelect(e.ticker)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            KR_CATEGORY_ORDER.filter(
              (c) => activeCategory === "all" || activeCategory === c
            ).map((cat) => {
              const items = groupedKr.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] px-2 py-1">
                    {KR_CATEGORY_LABELS[cat]}{" "}
                    <span className="text-ink-400 normal-case num">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow
                        key={e.ticker}
                        ticker={e.ticker}
                        name={e.name}
                        sizeLabel={`${(e.marCap / 10000).toFixed(1)}조`}
                        selected={e.ticker === selected}
                        onClick={() => onSelect(e.ticker)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t hairline text-right">
          <button
            onClick={onClose}
            className="text-[12px] text-ink-600 hover:text-ink-900 px-3 py-1 rounded-md hover:bg-ink-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[11.5px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-ink-900 text-paper border-ink-900"
          : "bg-paper text-ink-700 hairline hover:bg-ink-50"
      }`}
    >
      {label}
    </button>
  );
}

function TickerRow({
  ticker, name, sizeLabel, selected, onClick,
}: {
  ticker: string; name: string; sizeLabel: string;
  selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-3 transition-colors ${
        selected ? "bg-ink-100 border hairline" : "hover:bg-ink-50"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold text-ink-900 w-20 shrink-0 text-[13px] num">{ticker}</span>
        <span className="text-[13px] text-ink-700 truncate">{name}</span>
      </div>
      <div className="text-[11px] text-ink-400 shrink-0 num">{sizeLabel}</div>
    </button>
  );
}