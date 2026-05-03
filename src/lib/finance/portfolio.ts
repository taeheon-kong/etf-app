import type { EquityPoint } from "./types";

/**
 * 비중 합계 검증 (100% 여부)
 */
export function validateWeights(weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (Math.abs(sum - 1) > 0.001) {
    throw new Error(`비중의 합이 100%가 아닙니다. (현재 ${(sum * 100).toFixed(1)}%)`);
  }
}

/**
 * 포트폴리오 수익률 시뮬레이션 (리밸런싱 포함)
 */
export function simulatePortfolio(
  matrix: number[][],
  dates: string[],
  initialWeights: number[],
  startDate: string,
  rebalance: string,
  feeRate: number = 0
): EquityPoint[] {
  const numAssets = initialWeights.length;
  const curve: EquityPoint[] = [];

  if (dates.length === 0) return curve;

  // 초기 자본금 100 기준
  let currentShares = initialWeights.map(w => w * 100);
  let prevYear = dates[0].slice(0, 4);
  let prevMonth = dates[0].slice(0, 7);

  curve.push({ date: dates[0], value: 100 });

  for (let i = 1; i < dates.length; i++) {
    const date = dates[i];
    const year = date.slice(0, 4);
    const month = date.slice(0, 7);

    // 1. 자산 가격 업데이트 및 전체 가치 계산
    let portValue = 0;
    for (let j = 0; j < numAssets; j++) {
      currentShares[j] *= (1 + (matrix[i]?.[j] ?? 0));
      portValue += currentShares[j];
    }

    // 2. 리밸런싱 체크
    let doRebalance = false;
    if (rebalance === "annual" && year !== prevYear) doRebalance = true;
    if (rebalance === "semiannual" && month !== prevMonth && (month.endsWith("01") || month.endsWith("07"))) doRebalance = true;
    if (rebalance === "quarterly" && month !== prevMonth && ["01", "04", "07", "10"].some(m => month.endsWith(m))) doRebalance = true;
    if (rebalance === "monthly" && month !== prevMonth) doRebalance = true;

    // 3. 리밸런싱 실행
    if (doRebalance) {
      // 수수료 차감 (전체 자산 대비 설정된 비율)
      portValue -= (portValue * feeRate);
      // 정해진 비중대로 재분배
      for (let j = 0; j < numAssets; j++) {
        currentShares[j] = portValue * initialWeights[j];
      }
    }

    curve.push({ date, value: portValue });
    prevYear = year;
    prevMonth = month;
  }

  return curve;
}