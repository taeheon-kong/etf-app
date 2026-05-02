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
  const [endDate, setEndDate] = useState("2024-12-31");
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
      enabled: dcaEnabled,
      initialCapital,
      monthlyDeposit,
      basis,
      feeRate: feeRate / 100,
    };

    const taxOptions: TaxOptions = {
      enabled: taxEnabled,
      accounts,
      highIncome,
      applyComprehensiveTax: applyComprehensive,
      taxBracket,
      isaServingType,
      windmillEnabled,
      windmillTransferRatio: windmillRatio,
      pensionWithdrawalMode,
      pensionAnnualWithdrawal,
    };

    const input: BacktestRequest & { dca: DcaOptions; tax: TaxOptions } = {
      holdings: holdings.map((h) => ({ ticker: h.ticker, weight: h.weight / 100 })),
      startDate,
      endDate,
      rebalance,
      benchmark: benchmarkChoice,
      riskFree,
      dca: dcaOptions,
      tax: taxOptions,
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
    <div className="px-6 lg:px-8 py-8 pb-32 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">백테스트</h1>
        <p className="text-sm text-slate-500 mt-1">포트폴리오 구성 → 옵션 선택 → 실행</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <IconSettings />
            <h2 className="font-bold text-slate-900">기본 설정</h2>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">종목 + 비중 (%)</label>
              <span className={`text-sm font-semibold ${weightOK ? "text-emerald-600" : "text-rose-600"}`}>
                합계 {totalWeight}%
              </span>
            </div>
            <div className="space-y-2">
              {holdings.map((h, i) => {
                const meta = findAnyTicker(h.ticker);
                return (
                  <div key={i} className="flex gap-2 items-stretch">
                    <button type="button" onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-slate-50 text-left flex items-center justify-between gap-2">
                      <span className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {h.ticker}
                          {meta?.market === "kr" && <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">KR</span>}
                          {meta?.market === "us" && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">US</span>}
                        </span>
                        <span className="text-xs text-slate-500 truncate">{meta?.name ?? "—"}</span>
                      </span>
                      <IconChevronDown />
                    </button>
                    <input type="number" className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={h.weight} onChange={(e) => updateHolding(i, "weight", e.target.value)} />
                    <button onClick={() => removeHolding(i)} disabled={holdings.length <= 1}
                      className="px-2.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 rounded-lg disabled:opacity-30 flex items-center justify-center">
                      <IconX />
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={addHolding} disabled={holdings.length >= 5}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 font-medium">
              + 종목 추가 ({holdings.length}/5)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">시작일</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">종료일</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">리밸런싱</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={rebalance} onChange={(e) => setRebalance(e.target.value as RebalanceFrequency)}>
                <option value="none">없음 (Buy & Hold)</option>
                <option value="annual">연 1회</option>
                <option value="semiannual">반기</option>
                <option value="quarterly">분기</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">벤치마크</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={benchmarkChoice} onChange={(e) => setBenchmarkChoice(e.target.value as "auto" | "069500" | "SPY")}>
                <option value="auto">자동</option>
                <option value="069500">KODEX 200</option>
                <option value="SPY">SPY</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">무위험 수익률 (Sharpe 계산용)</label>
              <div className="flex gap-2">
                <select className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rfMode} onChange={(e) => setRfMode(e.target.value as RiskFreeMode["type"])}>
                  <option value="none">사용 안 함 (0%)</option>
                  <option value="fixed">고정값</option>
                  <option value="dynamic">동적 (CD금리/IRX 자동 매칭)</option>
                </select>
                {rfMode === "fixed" && (
                  <input type="number" step="0.1" className="w-20 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={rfRate} onChange={(e) => setRfRate(Number(e.target.value))} placeholder="%" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className={`bg-white border rounded-xl shadow-sm transition-colors ${dcaEnabled ? "border-blue-300" : "border-slate-200"}`}>
            <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
              <span className={dcaEnabled ? "text-blue-600" : "text-slate-400"}>
                <IconPiggy />
              </span>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">적립식 시뮬레이션</h3>
                <p className="text-xs text-slate-500">초기자본 + 월 적립</p>
              </div>
              <ToggleSwitch checked={dcaEnabled} onChange={setDcaEnabled} />
            </div>
            {dcaEnabled && (
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">초기 자본 (원)</label>
                  <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} />
                  <div className="flex gap-1.5 mt-1.5">
                    <QuickAdd amount={1_000_000} label="+100만" onAdd={(v) => setInitialCapital(initialCapital + v)} />
                    <QuickAdd amount={10_000_000} label="+1000만" onAdd={(v) => setInitialCapital(initialCapital + v)} />
                    <QuickAdd amount={100_000_000} label="+1억" onAdd={(v) => setInitialCapital(initialCapital + v)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">월 적립액 (원)</label>
                  <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={monthlyDeposit} onChange={(e) => setMonthlyDeposit(Number(e.target.value))} />
                  <div className="flex gap-1.5 mt-1.5">
                    <QuickAdd amount={10_000} label="+1만" onAdd={(v) => setMonthlyDeposit(monthlyDeposit + v)} />
                    <QuickAdd amount={100_000} label="+10만" onAdd={(v) => setMonthlyDeposit(monthlyDeposit + v)} />
                    <QuickAdd amount={1_000_000} label="+100만" onAdd={(v) => setMonthlyDeposit(monthlyDeposit + v)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setBasis("start")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium ${basis === "start" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    시작 시점 금액
                  </button>
                  <button onClick={() => setBasis("now")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium ${basis === "now" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    현재 기준 금액
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">매매 수수료 (%)</label>
                  <input type="number" step="0.001" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          <div className={`bg-white border rounded-xl shadow-sm transition-colors ${taxEnabled ? "border-emerald-300" : "border-slate-200"}`}>
            <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
              <span className={taxEnabled ? "text-emerald-600" : "text-slate-400"}>
                <IconBank />
              </span>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">절세 시뮬레이션</h3>
                <p className="text-xs text-slate-500">{enabledCount}개 계좌 활성</p>
              </div>
              <ToggleSwitch checked={taxEnabled} onChange={(v) => { setTaxEnabled(v); if (v && !dcaEnabled) setDcaEnabled(true); }} />
            </div>

            {taxEnabled && (
              <div className="px-5 py-4 space-y-4">
                {!dcaEnabled && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-1.5">
                    <IconAlert /><span>적립식이 자동 활성화됩니다</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">계좌 납입 우선순위</label>
                  <div className="space-y-1.5">
                    {sortedAccounts.map((acct, idx) => (
                      <div key={acct.type}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${
                          acct.enabled ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-slate-50"
                        }`}>
                        <div className="w-5 text-center text-xs font-bold text-slate-600">
                          {acct.enabled ? idx + 1 : "—"}
                        </div>
                        <input type="checkbox" checked={acct.enabled} onChange={() => toggleAccount(acct.type)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-xs">{ACCOUNT_LABELS[acct.type]}</div>
                          <div className="text-[10px] text-slate-500">{ACCOUNT_DESC[acct.type]}</div>
                        </div>
                        <button onClick={() => moveAccount(idx, "up")} disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20"><IconArrowUp /></button>
                        <button onClick={() => moveAccount(idx, "down")} disabled={idx === sortedAccounts.length - 1}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20"><IconArrowDown /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">연봉</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => setHighIncome(false)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium ${!highIncome ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        5,500만 이하
                      </button>
                      <button onClick={() => setHighIncome(true)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium ${highIncome ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        초과
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ISA 유형</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => setIsaServingType("general")}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium ${isaServingType === "general" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        일반형 (200만)
                      </button>
                      <button onClick={() => setIsaServingType("preferred")}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium ${isaServingType === "preferred" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        서민형 (400만)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 px-2.5 py-2 rounded-lg">
                    <div className="text-xs">
                      <div className="font-semibold text-slate-700">금융소득종합과세</div>
                      <div className="text-[10px] text-slate-500">연 2천만 초과 시</div>
                    </div>
                    <ToggleSwitch checked={applyComprehensive} onChange={setApplyComprehensive} />
                  </div>

                  {applyComprehensive && (
                    <select className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={taxBracket} onChange={(e) => setTaxBracket(Number(e.target.value) as TaxBracket)}>
                      {TAX_BRACKETS.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs">
                      <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <IconWindmill />
                        <span>풍차돌리기</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">추천</span>
                      </div>
                      <div className="text-[10px] text-slate-500">3년마다 ISA → 연금이전</div>
                    </div>
                    <ToggleSwitch checked={windmillEnabled} onChange={setWindmillEnabled} />
                  </div>

                  {windmillEnabled && (
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-2.5 mt-2 space-y-1.5">
                      <label className="block text-[10px] font-semibold text-slate-700">
                        연금이전 비율: <span className="text-emerald-700">{Math.round(windmillRatio * 100)}%</span>
                      </label>
                      <input type="range" min="0" max="100" step="10" value={windmillRatio * 100}
                        onChange={(e) => setWindmillRatio(Number(e.target.value) / 100)}
                        className="w-full" />
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">연금/IRP 인출</label>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <button onClick={() => setPensionWithdrawalMode("annual")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium ${pensionWithdrawalMode === "annual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                      연 분할
                    </button>
                    <button onClick={() => setPensionWithdrawalMode("lump")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium ${pensionWithdrawalMode === "lump" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                      일시금
                    </button>
                  </div>
                  {pensionWithdrawalMode === "annual" && (
                    <input type="number" step="1000000"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={pensionAnnualWithdrawal} onChange={(e) => setPensionAnnualWithdrawal(Number(e.target.value))}
                      placeholder="연 인출액 (1500만 초과 시 종합과세)" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {leveragedHoldings.length > 0 && (
        <div className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <IconAlert />
            <span>레버리지/인버스 ETF 포함 — 결과 해석 주의</span>
          </div>
          <p>레버리지 ETF는 일별 변동성으로 인한 시간 감쇠(volatility decay)가 발생합니다. 장기 보유 시 단순 N배 수익이 아닌, 변동성에 따라 누적 수익이 왜곡될 수 있습니다.</p>
        </div>
      )}

      {pickerOpen !== null && (
        <TickerPicker selected={holdings[pickerOpen].ticker}
          onSelect={(t) => { updateHolding(pickerOpen, "ticker", t); setPickerOpen(null); }}
          onClose={() => setPickerOpen(null)} groupedUs={groupedUs} groupedKr={groupedKr} />
      )}

      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-4 z-40">
        <div className="max-w-[1400px] mx-auto">
          <button onClick={runBacktest} disabled={!weightOK}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base shadow-lg shadow-blue-600/20">
            백테스트 실행
          </button>
          {error && (
            <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAdd({ amount, label, onAdd }: { amount: number; label: string; onAdd: (v: number) => void }) {
  return (
    <button type="button" onClick={() => onAdd(amount)}
      className="px-2.5 py-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium whitespace-nowrap">
      {label}
    </button>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function TickerPicker({ selected, onSelect, onClose, groupedUs, groupedKr }: {
  selected: string; onSelect: (ticker: string) => void; onClose: () => void;
  groupedUs: ReturnType<typeof groupByCategory>; groupedKr: ReturnType<typeof krGroupByCategory>;
}) {
  const [market, setMarket] = useState<Market>("us");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFlat = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    if (market === "us") {
      return ETF_CATALOG.filter((e) => e.ticker.includes(q) || e.name.toUpperCase().includes(q) ||
        e.tags.some((t) => CATEGORY_LABELS[t].includes(query)))
        .map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `$${e.aum}B` }));
    } else {
      return KR_ETF_CATALOG.filter((e) => e.ticker.includes(q) || e.name.toUpperCase().includes(q) ||
        e.tags.some((t) => KR_CATEGORY_LABELS[t].includes(query)))
        .map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `${(e.marCap / 10000).toFixed(1)}조` }));
    }
  }, [query, market]);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex border-b border-slate-200">
          <button onClick={() => { setMarket("us"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${market === "us" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
            미국 ETF ({ETF_CATALOG.length})
          </button>
          <button onClick={() => { setMarket("kr"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${market === "kr" ? "text-rose-600 border-b-2 border-rose-600" : "text-slate-500 hover:text-slate-700"}`}>
            국내 ETF ({KR_ETF_CATALOG.length})
          </button>
        </div>
        <div className="p-4 border-b border-slate-200">
          <input autoFocus type="text" placeholder="ETF 검색"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              <CategoryChip label="전체" active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
              {(market === "us" ? CATEGORY_ORDER : KR_CATEGORY_ORDER).map((cat) => (
                <CategoryChip key={cat} label={market === "us" ? CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] : KR_CATEGORY_LABELS[cat as keyof typeof KR_CATEGORY_LABELS]}
                  active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {query ? (
            filteredFlat.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">일치하는 ETF가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {filteredFlat.map((e) => (
                  <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={e.sizeLabel}
                    selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                ))}
              </div>
            )
          ) : market === "us" ? (
            CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedUs.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    {CATEGORY_LABELS[cat]} <span className="text-slate-400 normal-case">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`$${e.aum}B`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            KR_CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedKr.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    {KR_CATEGORY_LABELS[cat]} <span className="text-slate-400 normal-case">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`${(e.marCap / 10000).toFixed(1)}조`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 text-right">
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">닫기</button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"}`}>
      {label}
    </button>
  );
}

function TickerRow({ ticker, name, sizeLabel, selected, onClick }: {
  ticker: string; name: string; sizeLabel: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${selected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-900 w-20 shrink-0 text-sm">{ticker}</span>
        <span className="text-sm text-slate-600 truncate">{name}</span>
      </div>
      <div className="text-xs text-slate-400 shrink-0">{sizeLabel}</div>
    </button>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconPiggy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17h3m-9-7c0-1.1.9-2 2-2h7c2.5 0 5 2 5 5c0 1.5-1 3-2.5 4l-.5 3h-3l-.5-2H10l-.5 2h-3l-.5-3c-1.5-1-2.5-2.5-2.5-4z" />
      <circle cx="9" cy="11" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconBank() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
      <path d="M3 20h18" />
    </svg>
  );
}

function IconWindmill() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10V4M14 12h6M12 14v6M10 12H4" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}