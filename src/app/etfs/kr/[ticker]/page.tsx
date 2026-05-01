import Link from "next/link";
import { notFound } from "next/navigation";
import { krFindByTicker, KR_CATEGORY_LABELS } from "@/lib/finance/catalogKr";
import { loadKrMeta, calcDividendPerShare } from "@/lib/finance/metaKrLoader";
import { loadKrPerformance } from "@/lib/finance/loaderKr";
import { fmtPct, fmtPctSigned, fmtNumber } from "@/lib/finance/format";

export default async function KrEtfDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  const catalog = krFindByTicker(ticker);
  if (!catalog) notFound();

  const meta = loadKrMeta(ticker);
  const perf = loadKrPerformance(ticker);

  // 1년 미만 데이터면 CAGR 0으로 (왜곡 방지)
  let cagr = perf.cagr;
  if (perf.rowCount > 0 && perf.rowCount < 252) {
    cagr = 0;
  }

  const navValue = meta?.nav ?? catalog.nav ?? null;
  const dividendPerShare = calcDividendPerShare(meta);

  // 8칸 데이터 (3-3-2 배치)
  const cells = [
    { label: "NAV", value: navValue ? `${navValue.toLocaleString()} 원` : "—" },
    { label: "시가총액", value: meta?.marketValue ?? `${catalog.marCap.toLocaleString()} 억원` },
    { label: "거래대금", value: catalog.amount ? `${catalog.amount.toLocaleString()} 백만원` : "—" },
    {
      label: "CAGR",
      value: fmtPctSigned(cagr),
      accent: (cagr ?? 0) >= 0 ? "text-rose-600" : "text-blue-600",
    },
    { label: "최대 낙폭", value: fmtPct(perf.mdd), accent: "text-blue-600" },
    {
      label: "운용보수",
      value:
        meta?.totalFee !== null && meta?.totalFee !== undefined
          ? `${meta.totalFee.toFixed(2)}%`
          : "—",
    },
    {
      label: "배당수익률",
      value:
        meta?.dividendYieldTtm !== null && meta?.dividendYieldTtm !== undefined
          ? `${meta.dividendYieldTtm.toFixed(2)}%`
          : "—",
    },
    {
      label: "1주당 배당금",
      value:
        dividendPerShare !== null
          ? `${dividendPerShare.toFixed(0).toLocaleString()} 원`
          : "—",
    },
  ];

  return (
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/etfs/kr"
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
      >
        ← 국내 ETF 카탈로그
      </Link>

      {/* 헤더 */}
      <div className="flex items-baseline gap-3 mb-1 mt-2 flex-wrap">
        <h1 className="text-3xl font-bold text-slate-900">{catalog.name}</h1>
        <div className="flex gap-1.5 flex-wrap">
          {catalog.tags.map((t) => (
            <span
              key={t}
              className="text-sm px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-medium"
            >
              {KR_CATEGORY_LABELS[t]}
            </span>
          ))}
        </div>
      </div>
      <p className="text-slate-600 flex items-center gap-2 text-sm">
        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
          {ticker}
        </span>
        {meta?.issuerName && (
          <>
            <span className="text-slate-300">·</span>
            <span>{meta.issuerName}</span>
          </>
        )}
      </p>

      {/* 8칸 — 3-3-2 */}
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cells.slice(0, 3).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cells.slice(3, 6).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cells.slice(6, 8).map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* 최근 수익률 */}
      {meta && (meta.returnRate1m !== null || meta.returnRate3m !== null || meta.returnRate1y !== null) && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">최근 수익률</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "1개월", v: meta.returnRate1m },
              { label: "3개월", v: meta.returnRate3m },
              { label: "1년", v: meta.returnRate1y },
            ].map((r) => (
              <div key={r.label} className="text-center">
                <div className="text-xs text-slate-500">{r.label}</div>
                <div
                  className={`text-xl font-bold mt-1 ${
                    r.v === null
                      ? "text-slate-400"
                      : r.v >= 0
                      ? "text-rose-600"
                      : "text-blue-600"
                  }`}
                >
                  {r.v === null ? "—" : `${r.v >= 0 ? "+" : ""}${r.v.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 괴리율 (있을 때만) */}
      {meta?.deviationRate !== null && meta?.deviationRate !== undefined && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-2">괴리율</h2>
          <p className="text-sm text-slate-600">
            NAV와 시장가 차이:{" "}
            <span className="font-bold">
              {meta.deviationSign === "-" ? "-" : "+"}
              {meta.deviationRate.toFixed(2)}%
            </span>
          </p>
        </section>
      )}

      {/* ETF 소개 */}
      {meta?.description && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">ETF 소개</h2>
          <p
            className="text-sm text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: meta.description }}
          />
        </section>
      )}

      {/* 비슷한 ETF (industryCompareInfo) */}
      {meta?.industryCompareInfo && meta.industryCompareInfo.length > 0 && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">비슷한 ETF</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {meta.industryCompareInfo.slice(0, 6).map((c) => {
              const inCatalog = krFindByTicker(c.itemCode);
              const ratio = parseFloat(c.fluctuationsRatio);
              const positive = ratio >= 0;
              const card = (
                <div className="border border-slate-200 rounded-lg p-3 hover:border-rose-300 hover:shadow-sm transition-all">
                  <div className="font-mono text-xs text-slate-500">{c.itemCode}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                    {c.stockName}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-slate-700">
                      {c.closePrice}원
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        positive ? "text-rose-600" : "text-blue-600"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {c.fluctuationsRatio}%
                    </span>
                  </div>
                </div>
              );
              return inCatalog ? (
                <Link key={c.itemCode} href={`/etfs/kr/${c.itemCode}`}>
                  {card}
                </Link>
              ) : (
                <div key={c.itemCode} className="opacity-60 cursor-default">
                  {card}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 백테스트로 이동 */}
      <div className="mt-6">
        <Link
          href="/backtest"
          className="inline-block px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium"
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