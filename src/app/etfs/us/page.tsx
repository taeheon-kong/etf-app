import Link from "next/link";
import {
  ETF_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
} from "@/lib/finance/catalog";
import { loadMeta, loadPerformance } from "@/lib/finance/metaLoader";
import { fmtPctSigned, fmtUsdShort } from "@/lib/finance/format";
import CatalogClient from "./CatalogClient";

export default function UsEtfsPage() {
  // 서버 사이드: 모든 ETF의 메타 + CAGR 미리 로드해서 클라이언트로 전달
  const grouped = groupByCategory();

  const enriched = ETF_CATALOG.map((etf) => {
    const meta = loadMeta(etf.ticker);
    const perf = loadPerformance(etf.ticker);
    return {
      ticker: etf.ticker,
      name: etf.name,
      category: etf.category,
      categoryLabel: CATEGORY_LABELS[etf.category],
      aum: meta?.totalAssets ?? null,
      cagr: perf.cagr,
      cagrText: fmtPctSigned(perf.cagr),
      aumText: fmtUsdShort(meta?.totalAssets ?? null),
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