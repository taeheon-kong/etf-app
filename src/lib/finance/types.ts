/**
 * 백테스트 시스템에서 쓰는 데이터 타입 정의
 */

// ──────────────────────────────────────────────────────────────
// 가격 데이터
// ──────────────────────────────────────────────────────────────

export type PriceRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  dividends: number;
};

export type PriceSeries = {
  ticker: string;
  rows: PriceRow[];
};

// ──────────────────────────────────────────────────────────────
// 포트폴리오 입력
// ──────────────────────────────────────────────────────────────

export type Holding = {
  ticker: string;
  weight: number;
};

export type RebalanceFrequency = "none" | "annual" | "semiannual" | "quarterly";

export type RiskFreeMode =
  | { type: "none" }
  | { type: "fixed"; rate: number }
  | { type: "dynamic" };

export type BacktestRequest = {
  holdings: Holding[];
  startDate: string;
  endDate: string;
  rebalance: RebalanceFrequency;
  benchmark: string;
  riskFree: RiskFreeMode;
};

// ──────────────────────────────────────────────────────────────
// 백테스트 결과 (기본 6개 지표)
// ──────────────────────────────────────────────────────────────

export type EquityPoint = {
  date: string;
  value: number;
};

export type Metrics = {
  totalReturn: number;
  cagr: number;
  mdd: number;
  sharpe: number;
  sortino: number;
  volatility: number;
};

export type YearlyReturn = {
  year: number;
  portfolio: number;
  benchmark: number;
};

// ──────────────────────────────────────────────────────────────
// Phase 4 — 고급 지표
// ──────────────────────────────────────────────────────────────

export type RollingStats = {
  windowYears: number;
  min: number;
  max: number;
  mean: number;
  current: number;
  count: number;
};

export type TailRisk = {
  ulcerIndex: number;
  var95: number;
  cvar95: number;
};

export type DrawdownPeriod = {
  peakDate: string;
  troughDate: string;
  recoveryDate: string | null;
  depth: number;
  declineDays: number;
  recoveryDays: number | null;
  totalDays: number | null;
};

export type PeriodReturn = {
  label: string;
  return: number;
  available: boolean;
};

export type AssetContribution = {
  ticker: string;
  weight: number;
  totalReturn: number;
  contribution: number;
  contributionPct: number;
};

export type ContributionAnalysis = {
  byAsset: AssetContribution[];
  priceContributionPct: number;
  dividendContributionPct: number;
};

export type DividendCashflow = {
  year: number;
  grossKrw: number;
  netKrw: number;
  realNetKrw: number;
  taxKrw: number;
};

export type BacktestResult = {
  portfolio: EquityPoint[];
  benchmark: EquityPoint[];
  metrics: Metrics;
  benchmarkMetrics: Metrics;
  yearlyReturns: YearlyReturn[];
  meta: {
    actualStart: string;
    actualEnd: string;
    tradingDays: number;
  };
};

// ──────────────────────────────────────────────────────────────
// 적립식 시뮬레이션 (Phase 2)
// ──────────────────────────────────────────────────────────────

export type AmountBasis = "start" | "now";

export type DcaOptions = {
  enabled: boolean;
  initialCapital: number;
  monthlyDeposit: number;
  basis: AmountBasis;
  feeRate: number;
};

export type DcaResult = {
  finalBalance: number;
  totalDeposit: number;
  netProfit: number;
  realFinalBalance: number;
  totalFee: number;
  series: { date: string; balance: number; deposit: number }[];
};

// ──────────────────────────────────────────────────────────────
// 절세 시뮬레이션 (Phase 3)
// ──────────────────────────────────────────────────────────────

export type AccountType = "isa" | "pension" | "irp" | "general";

export type TaxBracket = 0.066 | 0.165 | 0.264 | 0.385 | 0.418 | 0.44 | 0.462 | 0.495;

export type AccountConfig = {
  type: AccountType;
  enabled: boolean;
  priority: number;
};

export type TaxOptions = {
  enabled: boolean;
  accounts: AccountConfig[];
  highIncome: boolean;
  applyComprehensiveTax: boolean;
  taxBracket: TaxBracket;
  isaServingType: "general" | "preferred";
  windmillEnabled: boolean;
  windmillTransferRatio: number;
  pensionWithdrawalMode: "annual" | "lump";
  pensionAnnualWithdrawal: number;
};

export type AccountResult = {
  type: AccountType;
  finalBalance: number;
  totalDeposit: number;
  totalDividend: number;
  totalTax: number;
  totalTaxCredit: number;
  warnings: string[];
};

export type WindmillCycle = {
  cycleNumber: number;
  endYear: number;
  isaBalance: number;
  transferToPension: number;
  reopenIsa: number;
  taxCreditFromTransfer: number;
};

export type MergedSeriesPoint = {
  date: string;
  totalBalance: number;
  totalDeposit: number;
  totalDividend: number;
  totalTax: number;
  byAccount: Record<AccountType, number>;
};

export type MergedSimResult = {
  accounts: AccountResult[];
  totalFinalBalance: number;
  totalTaxCredit: number;
  totalDividend: number;
  totalDividendTax: number;
  windmillCycles: WindmillCycle[];
  unallocated: { ticker: string; reason: string }[];
  series: MergedSeriesPoint[];
  yearlyDividends: DividendCashflow[];
  generalCaseBalance: number;
  totalSavings: number;
  afterTaxCagr: number;
  generalCaseCagr: number;
};

export type TaxResult = MergedSimResult;