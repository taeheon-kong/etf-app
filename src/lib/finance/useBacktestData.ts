/**
 * 백테스트 입력값 + 결과를 sessionStorage에 보관.
 *
 * 흐름:
 *  /backtest 페이지에서 "실행" 클릭 → 입력값 저장 → /backtest/result로 이동
 *  /backtest/result 페이지에서 입력값 읽고 → API 호출 → 결과 표시
 *  새로고침하면 입력값은 유지, API 다시 호출 (안정성 ↑)
 */

import type {
  BacktestRequest,
  DcaOptions,
  TaxOptions,
} from "./types";

export type BacktestInput = BacktestRequest & {
  dca: DcaOptions;
  tax: TaxOptions;
};

const STORAGE_KEY = "etf-app:backtest-input";

export function saveBacktestInput(input: BacktestInput) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch (e) {
    console.error("Failed to save input:", e);
  }
}

export function loadBacktestInput(): BacktestInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BacktestInput;
  } catch {
    return null;
  }
}

export function clearBacktestInput() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}