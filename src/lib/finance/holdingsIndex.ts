import fs from "fs";
import path from "path";

// 역방향 인덱스: 종목 심볼 → 그 종목을 보유한 ETF 리스트
type HoldingEntry = {
  etf: string;          // ETF 티커 (예: SPY)
  etfName: string;      // ETF 풀네임
  weight: number;       // ETF 안에서의 비중 (0~1)
  rank: number;         // ETF 안 보유 순위 (1=최대)
};

type HoldingInfo = {
  symbol: string;       // 종목 심볼 (예: NVDA)
  name: string;         // 회사명
  etfs: HoldingEntry[]; // 이 종목을 보유한 ETF 리스트 (비중 내림차순)
};

let cache: Map<string, HoldingInfo> | null = null;
let cacheBuiltAt: number = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1시간 캐싱

/**
 * data/meta/*.json 파일 전체를 스캔해서
 * 종목별 역방향 인덱스를 빌드한다.
 */
export function buildHoldingsIndex(): Map<string, HoldingInfo> {
  if (cache && Date.now() - cacheBuiltAt < CACHE_TTL) {
    return cache;
  }

  const metaDir = path.join(process.cwd(), "data", "meta");
  const index = new Map<string, HoldingInfo>();

  if (!fs.existsSync(metaDir)) {
    cache = index;
    cacheBuiltAt = Date.now();
    return index;
  }

  const files = fs.readdirSync(metaDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const filePath = path.join(metaDir, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);

      const etfTicker = data.ticker as string;
      const etfName = (data.longName || data.name || etfTicker) as string;
      const holdings = data.topHoldings;

      if (!Array.isArray(holdings)) continue;

      holdings.forEach((h: any, idx: number) => {
        const symbol = (h.symbol || "").toUpperCase().trim();
        if (!symbol) return;

        const entry: HoldingEntry = {
          etf: etfTicker,
          etfName,
          weight: Number(h.weight) || 0,
          rank: idx + 1,
        };

        if (!index.has(symbol)) {
          index.set(symbol, {
            symbol,
            name: h.name || symbol,
            etfs: [],
          });
        }

        index.get(symbol)!.etfs.push(entry);
      });
    } catch (e) {
      // 파일 하나 실패해도 계속 진행
      continue;
    }
  }

  // 비중 내림차순 정렬
  for (const info of index.values()) {
    info.etfs.sort((a, b) => b.weight - a.weight);
  }

  cache = index;
  cacheBuiltAt = Date.now();
  return index;
}

/**
 * 특정 종목 심볼로 검색
 */
export function findHoldingsByTicker(ticker: string): HoldingInfo | null {
  const index = buildHoldingsIndex();
  return index.get(ticker.toUpperCase().trim()) ?? null;
}

/**
 * 부분 일치 검색 (자동완성용)
 */
export function searchHoldings(query: string, limit = 10): HoldingInfo[] {
  const index = buildHoldingsIndex();
  const q = query.toUpperCase().trim();
  if (!q) return [];

  const results: HoldingInfo[] = [];
  for (const info of index.values()) {
    if (info.symbol.includes(q) || info.name.toUpperCase().includes(q)) {
      results.push(info);
      if (results.length >= limit) break;
    }
  }
  return results;
}