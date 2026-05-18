"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ETF_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
  findByTicker,
} from "@/lib/finance/catalog";
import {
  KR_ETF_CATALOG,
  KR_CATEGORY_LABELS,
  KR_CATEGORY_ORDER,
  krGroupByCategory,
  krFindByTicker,
} from "@/lib/finance/catalogKr";
import { FAMOUS_PORTFOLIOS } from "@/lib/finance/portfolios";
import { loadBacktestInput } from "@/lib/finance/useBacktestData";

type Holding = { ticker: string; weight: number };
type Market = "us" | "kr";

function findAnyTicker(ticker: string):
  | { market: "us"; name: string }
  | { market: "kr"; name: string }
  | null {
  const us = findByTicker(ticker);
  if (us) return { market: "us", name: us.name };
  const kr = krFindByTicker(ticker);
  if (kr) return { market: "kr", name: kr.name };
  return null;
}

export default function AnalysisMainPage() {
  const router = useRouter();

  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: "SPY", weight: 50 },
    { ticker: "QQQ", weight: 30 },
    { ticker: "GLD", weight: 20 },
  ]);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedUs = useMemo(() => groupByCategory(), []);
  const groupedKr = useMemo(() => krGroupByCategory(), []);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const weightOK = Math.abs(totalWeight - 100) < 0.1;

  const goAnalysis = (path: string) => {
    setError(null);
    if (!weightOK) {
      setError(`비중 합이 100%가 아닙니다: ${totalWeight}%`);
      return;
    }
    sessionStorage.setItem("etf_analysis_holdings", JSON.stringify(holdings));
    router.push(path);
  };

  const updateHolding = (i: number, key: keyof Holding, value: string | number) => {
    const next = [...holdings];
    if (key === "ticker") next[i].ticker = value as string;
    else next[i].weight = Number(value);
    setHoldings(next);
  };
  const addHolding = () => {
    if (holdings.length >= 10) return;
    setHoldings([...holdings, { ticker: "SCHD", weight: 0 }]);
  };
  const removeHolding = (i: number) => {
    if (holdings.length <= 1) return;
    setHoldings(holdings.filter((_, idx) => idx !== i));
  };

  const loadFromBacktest = () => {
    const saved = loadBacktestInput();
    if (saved && saved.holdings && saved.holdings.length > 0) {
      setHoldings(
        saved.holdings.map((h: any) => ({
          ticker: h.ticker,
          weight: Math.round(h.weight * 100),
        }))
      );
    } else {
      alert("최근에 실행한 백테스트 기록이 없습니다.");
    }
  };

  return (
    <div className="px-10 py-10 pb-20 max-w-[1280px] mx-auto">
      <div className="mb-10">
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">분석 도구</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">포트폴리오를 다각도로 분석하고 비교해보세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* 왼쪽 — 포트폴리오 분석 */}
        <div className="border hairline rounded-lg bg-paper">
          <div className="px-6 pt-5 pb-4 border-b hairline">
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">01 포트폴리오 분석</div>
            <h2 className="text-[15px] font-semibold text-ink-900">종목 + 비중 입력</h2>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPortfolioModalOpen(true)}
                className="py-2.5 border hairline rounded-md text-[12.5px] font-medium text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                유명 포트폴리오
              </button>
              <button
                onClick={loadFromBacktest}
                className="py-2.5 border hairline rounded-md text-[12.5px] font-medium text-ink-700 hover:bg-ink-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l3 2" />
                </svg>
                백테스트에서 불러오기
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">종목 + 비중</div>
                <div className={`flex items-center gap-1.5 text-[12px] num ${weightOK ? "text-pos" : "text-down"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${weightOK ? "bg-pos" : "bg-down"}`} />
                  합계 {totalWeight}%
                </div>
              </div>
              <div className="space-y-2">
                {holdings.map((h, i) => {
                  const meta = findAnyTicker(h.ticker);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 num text-[11px] text-ink-500 text-right">{String(i + 1).padStart(2, "0")}</div>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                        className="flex-1 flex items-center gap-3 px-3.5 py-2.5 border hairline rounded-md text-left bg-paper hover:bg-ink-50"
                      >
                        <span className="font-semibold text-ink-900 text-[13.5px] num">{h.ticker}</span>
                        {meta?.market === "kr" && <span className="text-[9px] num text-ink-500">KR</span>}
                        {meta?.market === "us" && <span className="text-[9px] num text-ink-500">US</span>}
                        <span className="text-[12px] text-ink-500 truncate flex-1">{meta?.name ?? "—"}</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-400">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-2 border hairline rounded-md px-2.5 py-2 w-[100px]">
                        <input
                          type="number"
                          className="w-full bg-transparent text-right num text-[14px] focus:outline-none font-semibold"
                          value={h.weight}
                          onChange={(e) => updateHolding(i, "weight", e.target.value)}
                        />
                        <span className="text-ink-500 text-[12px]">%</span>
                      </div>
                      <button
                        onClick={() => removeHolding(i)}
                        disabled={holdings.length <= 1}
                        className="p-2 text-ink-400 hover:text-down hover:bg-ink-50 rounded-md disabled:opacity-30"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={addHolding}
                disabled={holdings.length >= 10}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 border border-dashed hairline rounded-md text-[12.5px] text-ink-600 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                종목 추가 ({holdings.length}/10)
              </button>
            </div>

            <div className="pt-4 border-t hairline">
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2.5">분석 실행</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => goAnalysis("/analysis/efficient-frontier")}
                  className="py-3 bg-ink-900 hover:bg-ink-800 text-paper rounded-md text-[12.5px] font-medium transition-colors"
                >
                  효율적 투자선
                </button>
                <button
                  onClick={() => goAnalysis("/analysis/monte-carlo")}
                  className="py-3 bg-ink-900 hover:bg-ink-800 text-paper rounded-md text-[12.5px] font-medium transition-colors"
                >
                  몬테카를로
                </button>
                <button
                  onClick={() => goAnalysis("/analysis/correlation")}
                  className="py-3 bg-ink-900 hover:bg-ink-800 text-paper rounded-md text-[12.5px] font-medium transition-colors"
                >
                  상관관계
                </button>
              </div>

              {error && (
                <div className="mt-3 text-[12px] text-down bg-down-soft border hairline px-3 py-2 rounded-md">{error}</div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 — 단독 도구 */}
        <div className="space-y-4">
          <ToolLinkCard
            onClick={() => router.push("/analysis/weight")}
            label="02"
            title="비중 분석"
            desc="종목 심볼로 어떤 ETF에 편입되어 있는지, 보유 비중이 얼마인지 확인합니다"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            }
          />
          <ToolLinkCard
            onClick={() => router.push("/analysis/history")}
            label="03"
            title="기록 비교"
            desc="이전에 돌렸던 포트폴리오들을 나란히 놓고 성과를 비교합니다"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h13l-3-3M21 17H8l3 3" />
              </svg>
            }
          />
        </div>
      </div>

      {/* 모달 */}
      {pickerOpen !== null && (
        <TickerPicker
          selected={holdings[pickerOpen].ticker}
          onSelect={(t: string) => {
            updateHolding(pickerOpen, "ticker", t);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
          groupedUs={groupedUs}
          groupedKr={groupedKr}
        />
      )}

      {portfolioModalOpen && (
        <PortfolioModal
          onClose={() => setPortfolioModalOpen(false)}
          onSelect={(h: any) => {
            setHoldings(h);
            setPortfolioModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── 헬퍼 ──
function ToolLinkCard({
  onClick, label, title, desc, icon,
}: {
  onClick: () => void; label: string; title: string; desc: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-paper border hairline rounded-lg p-5 text-left hover:border-ink-400 hover:bg-ink-50 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-md border hairline flex items-center justify-center text-ink-700 shrink-0 bg-ink-50">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">{label}</div>
          <div className="font-semibold text-ink-900 text-[14px] flex items-center justify-between gap-2 mt-0.5">
            <span>{title}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <div className="text-[12px] text-ink-600 mt-1.5 leading-relaxed">{desc}</div>
        </div>
      </div>
    </button>
  );
}

// ── TickerPicker (Linear 스타일) ──
function TickerPicker({ selected, onSelect, onClose, groupedUs, groupedKr }: any) {
  const [market, setMarket] = useState<Market>("us");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFlat = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    if (market === "us") {
      return ETF_CATALOG.filter(
        (e) =>
          e.ticker.includes(q) ||
          e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `$${e.aum}B` }));
    } else {
      return KR_ETF_CATALOG.filter(
        (e) =>
          e.ticker.includes(q) ||
          e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => KR_CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({
        ticker: e.ticker,
        name: e.name,
        sizeLabel: `${(e.marCap / 10000).toFixed(1)}조`,
      }));
    }
  }, [query, market]);

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div
        className="bg-paper border hairline rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b hairline">
          <button
            onClick={() => { setMarket("us"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-[13px] font-medium transition-colors ${
              market === "us" ? "text-ink-900 border-b-2 border-ink-900" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            미국 ETF · <span className="num">{ETF_CATALOG.length}</span>
          </button>
          <button
            onClick={() => { setMarket("kr"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-[13px] font-medium transition-colors ${
              market === "kr" ? "text-ink-900 border-b-2 border-ink-900" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            국내 ETF · <span className="num">{KR_ETF_CATALOG.length}</span>
          </button>
        </div>
        <div className="p-4 border-b hairline">
          <input
            autoFocus
            type="text"
            placeholder="ETF 검색"
            className="w-full border hairline rounded-md px-3.5 py-2 text-[13px] focus:outline-none focus:border-ink-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              <CategoryChip label="전체" active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
              {(market === "us" ? CATEGORY_ORDER : KR_CATEGORY_ORDER).map((cat) => (
                <CategoryChip
                  key={cat}
                  label={
                    market === "us"
                      ? CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]
                      : KR_CATEGORY_LABELS[cat as keyof typeof KR_CATEGORY_LABELS]
                  }
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {query ? (
            filteredFlat.length === 0 ? (
              <div className="text-center text-[13px] text-ink-500 py-8">일치하는 ETF가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {filteredFlat.map((e) => (
                  <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={e.sizeLabel}
                    selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                ))}
              </div>
            )
          ) : market === "us" ? (
            CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedUs.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] px-2 py-1">
                    {CATEGORY_LABELS[cat]} <span className="text-ink-400 normal-case num">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e: any) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`$${e.aum}B`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            KR_CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedKr.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] px-2 py-1">
                    {KR_CATEGORY_LABELS[cat]} <span className="text-ink-400 normal-case num">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e: any) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`${(e.marCap / 10000).toFixed(1)}조`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t hairline text-right">
          <button onClick={onClose} className="text-[12px] text-ink-600 hover:text-ink-900 px-3 py-1 rounded-md hover:bg-ink-50">닫기</button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[11.5px] px-3 py-1.5 rounded-full border transition-colors ${
        active ? "bg-ink-900 text-paper border-ink-900" : "bg-paper text-ink-700 hairline hover:bg-ink-50"
      }`}
    >
      {label}
    </button>
  );
}

function TickerRow({ ticker, name, sizeLabel, selected, onClick }: {
  ticker: string; name: string; sizeLabel: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-3 transition-colors ${
        selected ? "bg-ink-100 border hairline" : "hover:bg-ink-50"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold text-ink-900 w-20 shrink-0 text-[13px] num">{ticker}</span>
        <span className="text-[13px] text-ink-700 truncate">{name}</span>
      </div>
      <div className="text-[11px] text-ink-400 shrink-0 num">{sizeLabel}</div>
    </button>
  );
}

// ── 유명 포트폴리오 모달 ──
function PortfolioModal({ onClose, onSelect }: any) {
  const [activeTab, setActiveTab] = useState<string>("전체");
  const tabs = ["전체", "주식 단일", "주식+채권", "글로벌", "방어·균형", "인컴·배당"];

  const filtered =
    activeTab === "전체"
      ? FAMOUS_PORTFOLIOS
      : FAMOUS_PORTFOLIOS.filter((p: any) => p.category === activeTab);

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div
        className="bg-paper border hairline rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b hairline flex items-center justify-between">
          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">템플릿</div>
            <h2 className="text-[14px] font-semibold text-ink-900 mt-0.5">유명 포트폴리오</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1.5 rounded-md hover:bg-ink-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b hairline">
          {tabs.map((tab) => (
            <CategoryChip key={tab} label={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((p: any) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.holdings)}
              className="w-full text-left p-4 border hairline rounded-md hover:border-ink-400 hover:bg-ink-50 transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="font-semibold text-ink-900 text-[13.5px]">{p.name}</div>
                <span className="text-[10px] font-medium text-ink-600 bg-ink-100 px-2 py-0.5 rounded num uppercase tracking-[0.06em]">
                  {p.category}
                </span>
              </div>
              <div className="text-[12px] text-ink-500 mb-3">{p.desc}</div>
              <div className="flex flex-wrap gap-1">
                {p.holdings.map((h: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-[11px] font-medium text-ink-900 bg-paper border hairline px-2 py-0.5 rounded num"
                  >
                    {h.ticker} {h.weight}%
                  </span>
                ))}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-ink-400 text-[13px]">해당 카테고리에 포트폴리오가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}