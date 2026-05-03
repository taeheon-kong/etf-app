// 백테스트 기록 저장/불러오기 유틸 (localStorage 기반)

export type HistoryRecord = {
  id: string;
  name: string;
  date: string;
  holdings: { ticker: string; weight: number }[]; // weight: 0~100 (%)
  metrics: {
    cagr: number;       // 0.085 형태 (8.5%)
    mdd: number;        // -0.124 형태
    sharpe: number;
    bestYear: number;   // 0.221 형태
    worstYear: number;  // -0.105 형태
  };
};

const KEY = "etf_history_v1";
const MAX = 20;

export function loadHistory(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistory(rec: Omit<HistoryRecord, "id" | "date">) {
  if (typeof window === "undefined") return;

  const list = loadHistory();
  const now = new Date();
  const dateStr = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, "0")}. ${String(now.getDate()).padStart(2, "0")}`;

  // 동일 holdings 검사 (같은 티커+같은 비중)
  const sig = signature(rec.holdings);
  const existIdx = list.findIndex((h) => signature(h.holdings) === sig);

  if (existIdx >= 0) {
    // 업데이트
    list[existIdx] = {
      ...list[existIdx],
      name: rec.name,
      date: dateStr,
      metrics: rec.metrics,
      holdings: rec.holdings,
    };
  } else {
    // 신규 추가 (앞에)
    list.unshift({
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      name: rec.name,
      holdings: rec.holdings,
      metrics: rec.metrics,
    });
    if (list.length > MAX) list.length = MAX;
  }

  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeHistory(id: string) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter((h) => h.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

function signature(holdings: { ticker: string; weight: number }[]) {
  return [...holdings]
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((h) => `${h.ticker}:${h.weight}`)
    .join("|");
}

// 자동 이름 생성: "SPY 60% + TLT 40%" 형태
export function autoName(holdings: { ticker: string; weight: number }[]): string {
  if (holdings.length === 0) return "포트폴리오";
  if (holdings.length === 1) return `${holdings[0].ticker} 100%`;
  if (holdings.length <= 3) {
    return holdings.map((h) => `${h.ticker} ${h.weight}%`).join(" + ");
  }
  return `${holdings[0].ticker} 외 ${holdings.length - 1}종`;
}
