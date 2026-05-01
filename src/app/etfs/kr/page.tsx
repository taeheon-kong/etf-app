import {
  KR_ETF_CATALOG,
  KR_CATEGORY_LABELS,
  KR_CATEGORY_ORDER,
} from "@/lib/finance/catalogKr";
import { loadKrMeta } from "@/lib/finance/metaKrLoader";
import { loadKrPerformance } from "@/lib/finance/loaderKr";
import { fmtPctSigned } from "@/lib/finance/format";
import CatalogKrClient from "./CatalogKrClient";

export default function KrEtfsPage() {
  const enriched = KR_ETF_CATALOG.map((etf) => {
    const meta = loadKrMeta(etf.ticker);
    const perf = loadKrPerformance(etf.ticker);

    // 1년 미만 데이터면 CAGR 0
    let cagr = perf.cagr;
    if (perf.rowCount > 0 && perf.rowCount < 252) {
      cagr = 0;
    }

    return {
      ticker: etf.ticker,
      name: etf.name,
      category: etf.category,
      tags: etf.tags,
      tagLabels: etf.tags.map((t) => KR_CATEGORY_LABELS[t]),
      marCap: etf.marCap,
      marCapText: meta?.marketValue ?? `${etf.marCap.toLocaleString()} 억원`,
      cagr,
      cagrText: fmtPctSigned(cagr),
      issuerName: meta?.issuerName ?? null,
      totalFee: meta?.totalFee ?? null,
    };
  });

  return (
    <CatalogKrClient
      items={enriched}
      categoryOrder={KR_CATEGORY_ORDER as readonly string[]}
      categoryLabels={KR_CATEGORY_LABELS}
    />
  );
}