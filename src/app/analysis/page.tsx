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
    <div className="px-6 lg:px-8 py-8 pb-20 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">분석 도구</h1>
        <p className="text-sm text-slate-500 mt-1">포트폴리오를 다각도로 분석하고 비교해보세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 왼쪽: 포트폴리오 분석 (3/5) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <IconPortfolio />
            <h2 className="font-bold text-slate-900">포트폴리오 분석</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPortfolioModalOpen(true)}
              className="py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <IconStar />
              유명 포트폴리오
            </button>
            <button
              onClick={loadFromBacktest}
              className="py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <IconHistory />
              백테스트에서 불러오기
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">종목 + 비중 (%)</label>
              <span
                className={`text-sm font-semibold ${
                  weightOK ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                합계 {totalWeight}%
              </span>
            </div>
            <div className="space-y-2">
              {holdings.map((h, i) => {
                const meta = findAnyTicker(h.ticker);
                return (
                  <div key={i} className="flex gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-slate-50 text-left flex items-center justify-between gap-2"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {h.ticker}
                          {meta?.market === "kr" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">
                              KR
                            </span>
                          )}
                          {meta?.market === "us" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                              US
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {meta?.name ?? "—"}
                        </span>
                      </span>
                      <IconChevronDown />
                    </button>
                    <input
                      type="number"
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={h.weight}
                      onChange={(e) => updateHolding(i, "weight", e.target.value)}
                    />
                    <button
                      onClick={() => removeHolding(i)}
                      disabled={holdings.length <= 1}
                      className="px-2.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 rounded-lg disabled:opacity-30 flex items-center justify-center"
                    >
                      <IconX />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addHolding}
              disabled={holdings.length >= 10}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 font-medium"
            >
              + 종목 추가 ({holdings.length}/10)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => goAnalysis("/analysis/efficient-frontier")}
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors"
            >
              효율적 투자선
            </button>
            <button
              onClick={() => goAnalysis("/analysis/monte-carlo")}
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors"
            >
              몬테카를로
            </button>
            <button
              onClick={() => goAnalysis("/analysis/correlation")}
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors"
            >
              상관관계
            </button>
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* 오른쪽: 단독 도구 (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          <button
            onClick={() => router.push("/analysis/weight")}
            className="w-full bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all flex items-start gap-4 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <IconPieChart />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-900 flex justify-between items-center">
                비중 분석
                <IconChevronRight />
              </div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                종목 심볼로 어떤 ETF에 편입되어 있는지, 보유 비중이 얼마인지 확인해요
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push("/analysis/history")}
            className="w-full bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all flex items-start gap-4 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <IconCompare />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-900 flex justify-between items-center">
                기록 비교
                <IconChevronRight />
              </div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                이전에 돌렸던 포트폴리오들, 나란히 놓고 승부를 가려볼까요?
              </div>
            </div>
          </button>
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

// ──────────────────────────────────────────
// TickerPicker (백테스트 동일 스타일)
// ──────────────────────────────────────────
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
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => {
              setMarket("us");
              setQuery("");
              setActiveCategory("all");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              market === "us"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            미국 ETF ({ETF_CATALOG.length})
          </button>
          <button
            onClick={() => {
              setMarket("kr");
              setQuery("");
              setActiveCategory("all");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              market === "kr"
                ? "text-rose-600 border-b-2 border-rose-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            국내 ETF ({KR_ETF_CATALOG.length})
          </button>
        </div>
        <div className="p-4 border-b border-slate-200">
          <input
            autoFocus
            type="text"
            placeholder="ETF 검색"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              <CategoryChip
                label="전체"
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
              />
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
              <div className="text-center text-sm text-slate-500 py-8">
                일치하는 ETF가 없습니다.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFlat.map((e) => (
                  <TickerRow
                    key={e.ticker}
                    ticker={e.ticker}
                    name={e.name}
                    sizeLabel={e.sizeLabel}
                    selected={e.ticker === selected}
                    onClick={() => onSelect(e.ticker)}
                  />
                ))}
              </div>
            )
          ) : market === "us" ? (
            CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map(
              (cat) => {
                const items = groupedUs.get(cat) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                      {CATEGORY_LABELS[cat]}{" "}
                      <span className="text-slate-400 normal-case">({items.length})</span>
                    </div>
                    <div className="space-y-1">
                      {items.map((e: any) => (
                        <TickerRow
                          key={e.ticker}
                          ticker={e.ticker}
                          name={e.name}
                          sizeLabel={`$${e.aum}B`}
                          selected={e.ticker === selected}
                          onClick={() => onSelect(e.ticker)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
            )
          ) : (
            KR_CATEGORY_ORDER.filter(
              (c) => activeCategory === "all" || activeCategory === c
            ).map((cat) => {
              const items = groupedKr.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    {KR_CATEGORY_LABELS[cat]}{" "}
                    <span className="text-slate-400 normal-case">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e: any) => (
                      <TickerRow
                        key={e.ticker}
                        ticker={e.ticker}
                        name={e.name}
                        sizeLabel={`${(e.marCap / 10000).toFixed(1)}조`}
                        selected={e.ticker === selected}
                        onClick={() => onSelect(e.ticker)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="text-sm text-slate-600 hover:text-slate-900 font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function TickerRow({
  ticker,
  name,
  sizeLabel,
  selected,
  onClick,
}: {
  ticker: string;
  name: string;
  sizeLabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
        selected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-900 w-20 shrink-0 text-sm">{ticker}</span>
        <span className="text-sm text-slate-600 truncate">{name}</span>
      </div>
      <div className="text-xs text-slate-400 shrink-0">{sizeLabel}</div>
    </button>
  );
}

// ──────────────────────────────────────────
// 유명 포트폴리오 모달 (백테스트 모달과 통일)
// ──────────────────────────────────────────
function PortfolioModal({ onClose, onSelect }: any) {
  const [activeTab, setActiveTab] = useState<string>("전체");
  const tabs = ["전체", "주식 단일", "주식+채권", "글로벌", "방어·균형", "인컴·배당"];

  const filtered =
    activeTab === "전체"
      ? FAMOUS_PORTFOLIOS
      : FAMOUS_PORTFOLIOS.filter((p: any) => p.category === activeTab);

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconStar />
            <h2 className="font-bold text-slate-900">유명 포트폴리오</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-slate-200">
          {tabs.map((tab) => (
            <CategoryChip
              key={tab}
              label={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((p: any) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.holdings)}
              className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="font-bold text-slate-900">{p.name}</div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {p.category}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-3">{p.desc}</div>
              <div className="flex flex-wrap gap-1">
                {p.holdings.map((h: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                  >
                    {h.ticker} {h.weight}%
                  </span>
                ))}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-400 font-semibold text-sm">
              해당 카테고리에 포트폴리오가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 아이콘
// ──────────────────────────────────────────
function IconPortfolio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 6-6" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function IconPieChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
function IconCompare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h13l-3-3M21 17H8l3 3" />
    </svg>
  );
}