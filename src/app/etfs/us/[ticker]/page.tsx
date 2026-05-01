import Link from "next/link";
import { notFound } from "next/navigation";
import { findByTicker, CATEGORY_LABELS } from "@/lib/finance/catalog";
import { loadMeta, loadPerformance } from "@/lib/finance/metaLoader";
import {
  fmtPct,
  fmtPctSigned,
  fmtUsdKorean,
  fmtUsdShort,
  fmtPriceUsd,
} from "@/lib/finance/format";

export default async function EtfDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  const catalog = findByTicker(ticker);
  if (!catalog) notFound();

  const meta = loadMeta(ticker);
  const perf = loadPerformance(ticker);

  // 1년 미만 데이터면 CAGR 0으로 고정 (왜곡 방지)
  if (perf.recentDate) {
    try {
      const { loadPrices } = await import("@/lib/finance/loader");
      const prices = loadPrices(ticker);
      if (prices.rows.length < 252) {
        perf.cagr = 0;
      }
    } catch {
      // 무시
    }
  }

  // 8칸 데이터
  const navPrice = meta?.navPrice ?? meta?.previousClose ?? perf.recentClose;
  const cells = [
    { label: "NAV", value: fmtPriceUsd(navPrice) },
    { label: "시가총액", value: fmtUsdKorean(meta?.totalAssets ?? null) },
    { label: "거래대금", value: fmtUsdKorean(perf.recentDollarVolume) },
    { label: "CAGR", value: fmtPctSigned(perf.cagr), accent: (perf.cagr ?? 0) >= 0 ? "text-blue-600" : "text-rose-600" },
    { label: "최대 낙폭", value: fmtPct(perf.mdd), accent: "text-rose-600" },
    { label: "운용보수", value: fmtPct(meta?.expenseRatio ?? null) },
    { label: "배당수익률", value: fmtPct(meta?.yieldPct ?? null) },
    {
      label: "1주당 배당금",
      value:
        meta?.yieldPct !== null && meta?.yieldPct !== undefined && navPrice
          ? `${(meta.yieldPct * navPrice).toFixed(2)} USD`
          : "—",
    },
  ];

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* 뒤로가기 */}
      <Link
        href="/etfs/us"
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
      >
        ← 해외 ETF 카탈로그
      </Link>

      {/* 헤더 */}
      <div className="flex items-baseline gap-3 mb-1 mt-2">
        <h1 className="text-4xl font-bold text-slate-900">{ticker}</h1>
        <div className="flex gap-1.5 flex-wrap">
          {catalog.tags.map((t) => (
            <span
              key={t}
              className="text-sm px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium"
            >
              {CATEGORY_LABELS[t]}
            </span>
          ))}
        </div>
      </div>
      <p className="text-slate-600">{meta?.longName ?? catalog.name}</p>

      {/* 8칸 — 3-3-2 */}
      <div className="mt-6 space-y-3">
        {/* 1행: NAV / 시가총액 / 거래대금 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cells.slice(0, 3).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
        {/* 2행: CAGR / MDD / 운용보수 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cells.slice(3, 6).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
        {/* 3행: 배당수익률 / 1주당 배당금 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cells.slice(6, 8).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* ETF 소개 */}
      {meta?.summary && (
        <section className="mt-8 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">ETF 소개</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {meta.summary}
          </p>
          {meta.fundFamily && (
            <div className="text-xs text-slate-400 mt-3">
              운용사: {meta.fundFamily}
            </div>
          )}
        </section>
      )}

      {/* 구성 종목 TOP 10 */}
      {meta?.topHoldings && meta.topHoldings.length > 0 && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            구성 종목 TOP {meta.topHoldings.length}
          </h2>
          <div className="space-y-1.5">
            {meta.topHoldings.map((h, i) => (
              <div
                key={`${h.symbol}-${i}`}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-slate-400 w-5">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">{h.symbol}</div>
                    {h.name && (
                      <div className="text-xs text-slate-500 truncate">
                        {h.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {(h.weight * 100).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 섹터 비중 */}
      {meta?.sectorWeightings && Object.keys(meta.sectorWeightings).length > 0 && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">섹터 비중</h2>
          <div className="space-y-2">
            {Object.entries(meta.sectorWeightings)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-32 capitalize">
                    {k.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${v * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-700 w-14 text-right">
                    {(v * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 백테스트로 이동 */}
      <div className="mt-6">
        <Link
          href="/backtest"
          className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          백테스트에서 이 종목 사용 →
        </Link>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent ?? "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}