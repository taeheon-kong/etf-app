"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  ticker: string;
  name: string;
  category: string;
  categoryLabel: string;
  aum: number | null;
  cagr: number | null;
  cagrText: string;
  aumText: string;
};

export default function CatalogClient({
  items,
  categoryOrder,
  categoryLabels,
}: {
  items: Item[];
  categoryOrder: readonly string[];
  categoryLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    let arr = items;
    if (activeCategory !== "all") {
      arr = arr.filter((i) => i.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toUpperCase();
      arr = arr.filter(
        (i) =>
          i.ticker.includes(q) ||
          i.name.toUpperCase().includes(q) ||
          i.categoryLabel.includes(query)
      );
    }
    return arr;
  }, [items, activeCategory, query]);

  // 그룹핑 (현재 필터 결과 안에서)
  const groupedDisplay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const cat of categoryOrder) map.set(cat, []);
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered, categoryOrder]);

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">해외 ETF</h1>
        <p className="text-sm text-slate-500 mt-1">
          {items.length}개 종목 · 부문별 AUM 큰 순으로 정렬
        </p>
      </div>

      {/* 검색바 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <input
          type="text"
          placeholder="ETF 검색 (티커·이름·부문)"
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* 카테고리 칩 */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <CategoryChip
            label="전체"
            count={items.length}
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {categoryOrder.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            if (count === 0) return null;
            return (
              <CategoryChip
                key={cat}
                label={categoryLabels[cat]}
                count={count}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            );
          })}
        </div>
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-16 bg-white border border-slate-200 rounded-xl">
          일치하는 ETF가 없습니다.
        </div>
      ) : query.trim() ? (
        // 검색 시: 부문 헤더 없이 평탄하게
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <EtfCard key={item.ticker} item={item} />
          ))}
        </div>
      ) : (
        // 부문별 헤더 + 그리드
        <div className="space-y-6">
          {categoryOrder.map((cat) => {
            const items = groupedDisplay.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                  {categoryLabels[cat]}
                  <span className="text-xs text-slate-400 font-normal">
                    {items.length}개
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((item) => (
                    <EtfCard key={item.ticker} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
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
      {label} <span className={active ? "opacity-70" : "text-slate-400"}>{count}</span>
    </button>
  );
}

function EtfCard({ item }: { item: Item }) {
  const positive = (item.cagr ?? 0) >= 0;
  return (
    <Link
      href={`/etfs/us/${item.ticker}`}
      className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{item.ticker}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
              {item.categoryLabel}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {item.name}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-slate-400">AUM {item.aumText}</div>
        <div
          className={`text-sm font-bold ${
            item.cagr === null
              ? "text-slate-400"
              : positive
              ? "text-blue-600"
              : "text-rose-600"
          }`}
        >
          {item.cagrText}
          <span className="text-[10px] text-slate-400 font-normal ml-1">
            연평균
          </span>
        </div>
      </div>
    </Link>
  );
}