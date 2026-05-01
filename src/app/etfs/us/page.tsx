import {
  ETF_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/finance/catalog";
import { loadMeta, loadPerformance } from "@/lib/finance/metaLoader";
import { fmtPctSigned, fmtUsdShort } from "@/lib/finance/format";
import { loadPrices } from "@/lib/finance/loader";
import CatalogClient from "./CatalogClient";

export default function UsEtfsPage() {
  const enriched = ETF_CATALOG.map((etf) => {
    const meta = loadMeta(etf.ticker);
    const perf = loadPerformance(etf.ticker);

// 1년 미만 데이터면 CAGR을 0으로 고정 (왜곡 방지)
    let displayPct: number | null = perf.cagr;
    try {
      const prices = loadPrices(etf.ticker);
      if (prices.rows.length < 252) {
        displayPct = 0;
      }
    } catch {
      // 무시
    }

    // AUM 폴백: 메타 없으면 카탈로그 값(B 단위) × 1e9
    const aumValue =
      meta?.totalAssets ?? (etf.aum > 0 ? etf.aum * 1e9 : null);

    return {
      ticker: etf.ticker,
      name: etf.name,
      category: etf.category,
      tags: etf.tags,
      tagLabels: etf.tags.map((t) => CATEGORY_LABELS[t]),
      aum: aumValue,
      cagr: displayPct,
      cagrText: fmtPctSigned(displayPct),
      aumText: fmtUsdShort(aumValue),
    };
  });

  return (
    <CatalogClient
      items={enriched}
      categoryOrder={CATEGORY_ORDER as readonly string[]}
      categoryLabels={CATEGORY_LABELS}
    />
  );
}