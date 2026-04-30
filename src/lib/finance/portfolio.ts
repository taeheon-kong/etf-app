/**
 * 포트폴리오 시뮬레이션 모듈
 *
 * 핵심: 시간이 지나면 가격 변동으로 비중이 표류(drift)함.
 * 리밸런싱 = 정해진 주기로 목표 비중으로 다시 맞추는 것.
 *
 * 시뮬레이션 방식:
 * - 각 자산의 보유 가치를 추적 (단위: 가상 통화)
 * - 매일: 각 자산 가치 × (1 + 일별 수익률)
 * - 리밸런싱 날: 총자산 × 목표 비중으로 각 자산 가치 재배분
 */

import type { RebalanceFrequency, EquityPoint } from "./types";

// ──────────────────────────────────────────────────────────────
// 리밸런싱 시점 판별
// ──────────────────────────────────────────────────────────────

/**
 * date1과 date2가 "리밸런싱 경계"를 사이에 두고 있는지 판단.
 *
 * 예: annual에서 date1='2024-12-30', date2='2025-01-02'면 true
 *     (연도가 바뀌었으니 새 해 첫날에 리밸런싱 트리거)
 *
 * 분기는 1·4·7·10월 기준, 반기는 1·7월 기준.
 */
function isRebalanceBoundary(
  prevDate: string,
  currDate: string,
  freq: RebalanceFrequency
): boolean {
  if (freq === "none") return false;

  const prevYear = prevDate.slice(0, 4);
  const currYear = currDate.slice(0, 4);
  const prevMonth = parseInt(prevDate.slice(5, 7), 10);
  const currMonth = parseInt(currDate.slice(5, 7), 10);

  if (freq === "annual") {
    // 연도가 바뀌는 첫 거래일
    return prevYear !== currYear;
  }

  if (freq === "semiannual") {
    // 1월 또는 7월의 첫 거래일
    if (prevYear !== currYear) return true;  // 새해 첫날
    if (prevMonth < 7 && currMonth >= 7) return true;  // 7월 진입
    return false;
  }

  if (freq === "quarterly") {
    // 분기 시작월(1, 4, 7, 10)의 첫 거래일
    if (prevYear !== currYear) return true;  // 1월
    const prevQ = Math.floor((prevMonth - 1) / 3);
    const currQ = Math.floor((currMonth - 1) / 3);
    return prevQ !== currQ;
  }

  return false;
}

// ──────────────────────────────────────────────────────────────
// 메인 시뮬레이션
// ──────────────────────────────────────────────────────────────

/**
 * 포트폴리오 시뮬레이션 (리밸런싱 포함).
 *
 * @param matrix matrix[t][i] = t시점 i종목의 일별 수익률
 * @param dates  matrix와 길이 같은 날짜 배열
 * @param weights 목표 비중 (합 1.0)
 * @param startDate 시작점 날짜 (가치 100 시점)
 * @param freq 리밸런싱 주기
 *
 * @returns 가치 곡선 (시작점 포함, 길이 = matrix.length + 1)
 */
export function simulatePortfolio(
  matrix: number[][],
  dates: string[],
  weights: number[],
  startDate: string,
  freq: RebalanceFrequency
): EquityPoint[] {
  const n = matrix.length;
  const k = weights.length;

  // 각 자산의 현재 보유 가치 (시작 시점, 100을 비중대로 분배)
  let holdings = weights.map((w) => 100 * w);

  const curve: EquityPoint[] = [{ date: startDate, value: 100 }];

  for (let t = 0; t < n; t++) {
    // 1. 각 자산 가치를 일별 수익률만큼 변화
    for (let i = 0; i < k; i++) {
      holdings[i] = holdings[i] * (1 + matrix[t][i]);
    }

    // 2. 총 가치 합산
    const total = holdings.reduce((s, h) => s + h, 0);

    // 3. 리밸런싱 경계인지 확인 (이번 날짜 = 새 분기/연도 시작?)
    //    t=0일 때는 전날이 startDate라고 가정하고 비교
    const prevDate = t === 0 ? startDate : dates[t - 1];
    const currDate = dates[t];

    if (isRebalanceBoundary(prevDate, currDate, freq)) {
      // 총가치를 목표 비중으로 다시 분배
      holdings = weights.map((w) => total * w);
    }

    curve.push({ date: currDate, value: total });
  }

  return curve;
}

// ──────────────────────────────────────────────────────────────
// 비중 검증
// ──────────────────────────────────────────────────────────────

/**
 * 비중 합이 1.0(±0.001)인지 검증.
 *
 * UI나 API에서 입력받을 때 호출. 실패 시 에러 throw.
 */
export function validateWeights(weights: number[]): void {
  if (weights.length === 0) {
    throw new Error("비중이 비어있습니다.");
  }

  const sum = weights.reduce((s, w) => s + w, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(
      `비중 합이 100%가 아닙니다: ${(sum * 100).toFixed(2)}%`
    );
  }

  for (const w of weights) {
    if (w < 0) {
      throw new Error(`음수 비중이 포함되어 있습니다: ${w}`);
    }
  }
}