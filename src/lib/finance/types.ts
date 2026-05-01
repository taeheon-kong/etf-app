/**
 * 백테스트 시스템에서 쓰는 데이터 타입 정의
 *
 * - PriceRow: CSV 한 줄 (하루치 가격 데이터)
 * - PriceSeries: 한 종목의 전체 가격 히스토리
 * - Holding: 포트폴리오 한 종목 + 비중
 * - BacktestRequest: 사용자 입력
 * - BacktestResult: 계산 결과
 */

// ──────────────────────────────────────────────────────────────
// 가격 데이터
// ──────────────────────────────────────────────────────────────

/** CSV 한 줄에 해당하는 하루치 가격 데이터. */
export type PriceRow = {
  date: string;       // "2005-01-03" 형식
  open: number;
  high: number;
  low: number;
  close: number;      // 원본 종가
  adjClose: number;   // 배당/분할 조정 후 종가 (백테스트의 핵심)
  volume: number;
  dividends: number;  // 그 날 지급된 배당금 (없으면 0)
};

/** 한 종목의 전체 가격 시계열. */
export type PriceSeries = {
  ticker: string;       // "SPY", "QQQ" 등
  rows: PriceRow[];     // 날짜 오름차순 정렬됨
};

// ──────────────────────────────────────────────────────────────
// 포트폴리오 입력
// ──────────────────────────────────────────────────────────────

/** 포트폴리오의 한 종목 비중. */
export type Holding = {
  ticker: string;   // "SPY"
  weight: number;   // 0.0 ~ 1.0 (예: 0.6 = 60%)
};

/** 리밸런싱 주기. */
export type RebalanceFrequency = "none" | "annual" | "semiannual" | "quarterly";

/** 무위험 수익률 모드 (Sharpe/Sortino 계산용). */
export type RiskFreeMode =
  | { type: "none" }                  // 0% 고정
  | { type: "fixed"; rate: number }   // 사용자 입력 (예: 0.03 = 3%)
  | { type: "dynamic" };              // ^IRX 13주 미국채 동적

/** 백테스트 실행 요청 (사용자 입력 전체). */
export type BacktestRequest = {
  holdings: Holding[];                // 종목 + 비중 (weight 합 = 1.0)
  startDate: string;                  // "2020-01-01"
  endDate: string;                    // "2026-04-29"
  rebalance: RebalanceFrequency;
  benchmark: string;                  // 보통 "SPY"
  riskFree: RiskFreeMode;
};

// ──────────────────────────────────────────────────────────────
// 백테스트 결과
// ──────────────────────────────────────────────────────────────

/** 시간에 따른 포트폴리오 가치 한 점. */
export type EquityPoint = {
  date: string;
  value: number;   // 시작 시점을 100으로 정규화 (예: 132.5 = +32.5%)
};

/** 핵심 지표 6종. */
export type Metrics = {
  totalReturn: number;   // 총수익률 (예: 0.325 = 32.5%)
  cagr: number;          // 연환산 수익률
  mdd: number;           // 최대 낙폭 (예: -0.34 = -34%)
  sharpe: number;        // Sharpe ratio (연환산)
  sortino: number;       // Sortino ratio (연환산)
  volatility: number;    // 변동성 (연환산 표준편차)
};

/** 연도별 수익률 한 점. */
export type YearlyReturn = {
  year: number;
  portfolio: number;     // 그 해 포트폴리오 수익률
  benchmark: number;     // 그 해 벤치마크 수익률
};

/** 백테스트 최종 결과. */
export type BacktestResult = {
  portfolio: EquityPoint[];     // 일별 포트폴리오 가치 곡선
  benchmark: EquityPoint[];     // 일별 벤치마크 가치 곡선
  metrics: Metrics;             // 포트폴리오 지표
  benchmarkMetrics: Metrics;    // 벤치마크 지표 (비교용)
  yearlyReturns: YearlyReturn[];
  meta: {
    actualStart: string;        // 실제 사용된 시작일 (SCHD처럼 데이터 늦게 시작하는 경우 조정됨)
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

/** 계좌 종류. */
export type AccountType = "isa" | "pension" | "irp" | "general";

/** 종합소득세율 구간 (지방세 포함). */
export type TaxBracket = 0.066 | 0.165 | 0.264 | 0.385 | 0.418 | 0.44 | 0.462 | 0.495;

/** 계좌 설정 (활성/우선순위). */
export type AccountConfig = {
  type: AccountType;
  enabled: boolean;
  priority: number;        // 작을수록 우선 (1, 2, 3, 4)
};

/** 절세 시뮬레이션 옵션. */
export type TaxOptions = {
  enabled: boolean;
  accounts: AccountConfig[];

  // 사용자 정보
  highIncome: boolean;          // 연봉 5500만 초과 → 세액공제 13.2%, 아니면 16.5%
  applyComprehensiveTax: boolean; // 금융소득종합과세 적용 (연 2천만 초과 시)
  taxBracket: TaxBracket;        // 종합과세 시 사용

  // ISA 옵션
  isaServingType: "general" | "preferred"; // 일반(200만 비과세) / 서민형(400만)

  // 풍차돌리기
  windmillEnabled: boolean;
  windmillTransferRatio: number; // 0~1, ISA 만기 시 연금이전 비율 (기본 0.6)
};

/** 계좌별 세금 + 잔액 결과. */
export type AccountResult = {
  type: AccountType;
  finalBalance: number;        // 명목 KRW
  totalDeposit: number;
  totalDividend: number;       // 누적 배당금 (세전)
  totalTax: number;            // 누적 세금
  totalTaxCredit: number;      // 세액공제 환급액 누적
  warnings: string[];
};

/** 풍차돌리기 사이클 한 회. */
export type WindmillCycle = {
  cycleNumber: number;         // 1, 2, 3...
  endYear: number;             // 만기 연도
  isaBalance: number;          // 만기 시점 ISA 잔액
  transferToPension: number;   // 연금저축 이전액
  reopenIsa: number;           // 새 ISA 재가입 금액
  taxCreditFromTransfer: number; // 추가 세액공제 (10%, 최대 300만)
};

/** 절세 시뮬레이션 결과. */
export type TaxResult = {
  accounts: AccountResult[];
  totalFinalBalance: number;       // 절세 후 합계
  generalCaseBalance: number;      // 비교용: 일반계좌만 사용 시
  totalSavings: number;            // 절감액 (절세 - 일반)
  totalTaxCredit: number;          // 누적 환급액
  windmillCycles: WindmillCycle[]; // 풍차돌리기 켜졌으면
  unallocated: { ticker: string; reason: string }[]; // 어느 계좌에도 못 들어간 종목
};