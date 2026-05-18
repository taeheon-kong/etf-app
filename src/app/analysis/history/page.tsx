"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  loadHistory,
  removeHistory,
  clearHistory,
  HistoryRecord,
} from "@/lib/finance/historyStore";

const SERIES_COLORS = ["#3b6cd8", "#10a37f", "#e8814a", "#a855e0", "#737373"];

const fmtPct = (v: number, sign = false) => {
  const s = sign && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(2)}%`;
};

export default function HistoryComparisonPage() {
  const router = useRouter();
  const [histories, setHistories] = useState<HistoryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const list = loadHistory();
    setHistories(list);
    setSelectedIds(new Set(list.slice(0, 3).map((h) => h.id)));
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else {
      if (next.size >= 5) {
        alert("최대 5개까지 비교 가능합니다.");
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleRemove = (id: string) => {
    if (!confirm("이 기록을 삭제할까요?")) return;
    removeHistory(id);
    const next = histories.filter((h) => h.id !== id);
    setHistories(next);
    const nextIds = new Set(selectedIds);
    nextIds.delete(id);
    setSelectedIds(nextIds);
  };

  const handleClearAll = () => {
    if (!confirm("모든 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    clearHistory();
    setHistories([]);
    setSelectedIds(new Set());
  };

  const selected = histories.filter((h) => selectedIds.has(h.id));

  const chartData =
    selected.length > 0
      ? [
          {
            metric: "CAGR",
            ...selected.reduce(
              (acc, h) => ({ ...acc, [h.name]: +(h.metrics.cagr * 100).toFixed(2) }),
              {}
            ),
          },
          {
            metric: "Sharpe (×10)",
            ...selected.reduce(
              (acc, h) => ({ ...acc, [h.name]: +(h.metrics.sharpe * 10).toFixed(2) }),
              {}
            ),
          },
          {
            metric: "MDD",
            ...selected.reduce(
              (acc, h) => ({ ...acc, [h.name]: +(h.metrics.mdd * 100).toFixed(2) }),
              {}
            ),
          },
        ]
      : [];

  return (
    <div className="px-10 py-10 pb-20 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <button
          onClick={() => router.push("/analysis")}
          className="flex items-center gap-1.5 text-[12px] text-ink-600 hover:text-ink-900 hover:bg-ink-50 px-2.5 py-1.5 rounded-md transition-colors"
        >
          ← 분석 도구로
        </button>
        {histories.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[12px] text-ink-500 hover:text-down hover:bg-down-soft px-2.5 py-1.5 rounded-md transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      <div className="mb-10">
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 · 기록 비교</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">기록 비교</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">
          이전에 돌렸던 백테스트를 나란히 놓고 비교합니다. 카드를 눌러 비교 대상에 추가/제외하세요.
        </p>
      </div>

      {histories.length === 0 ? (
        <div className="bg-paper border hairline rounded-lg p-12 text-center">
          <div className="flex flex-col items-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-md bg-ink-50 border hairline flex items-center justify-center text-ink-400 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 6-6" />
              </svg>
            </div>
            <h3 className="text-[16px] font-semibold text-ink-900 mb-2">저장된 기록이 없습니다</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed mb-5">
              백테스트를 실행하면 결과가 자동으로 여기에 저장됩니다.
            </p>
            <button
              onClick={() => router.push("/backtest")}
              className="px-4 py-2 bg-action hover:bg-action-ink text-white rounded-md text-[13px] font-medium transition-colors"
            >
              백테스트 하러 가기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 기록 카드 그리드 */}
          <div className="bg-paper border hairline rounded-lg p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">전체 기록</div>
                <h2 className="text-[14px] font-semibold text-ink-900">
                  <span className="num">{histories.length}</span>개의 기록
                </h2>
              </div>
              <div className="text-[11px] text-ink-500">
                선택 <span className="num font-semibold text-action">{selectedIds.size}</span> / 5
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {histories.map((h) => {
                const isSelected = selectedIds.has(h.id);
                const colorIdx = selected.findIndex((s) => s.id === h.id);
                const dotColor = isSelected
                  ? SERIES_COLORS[colorIdx % SERIES_COLORS.length]
                  : "#d4d4d4";

                return (
                  <div
                    key={h.id}
                    onClick={() => toggleSelect(h.id)}
                    className={`relative p-4 rounded-md cursor-pointer transition-all group border ${
                      isSelected
                        ? "bg-action-soft/40 border-action"
                        : "bg-paper hairline hover:border-ink-400"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(h.id);
                      }}
                      className="absolute top-3 right-3 text-ink-300 hover:text-down transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ink-50"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <h3 className="font-semibold text-ink-900 truncate pr-6 text-[13px]">
                        {h.name}
                      </h3>
                    </div>
                    <div className="text-[10px] text-ink-400 num mb-3">{h.date}</div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {h.holdings.slice(0, 4).map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium text-ink-700 bg-ink-100 px-1.5 py-0.5 rounded num"
                        >
                          {item.ticker} {item.weight}%
                        </span>
                      ))}
                      {h.holdings.length > 4 && (
                        <span className="text-[10px] font-medium text-ink-400 num">
                          +{h.holdings.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t hairline">
                      <div>
                        <div className="text-[9px] font-medium text-ink-500 uppercase tracking-[0.06em] mb-0.5">CAGR</div>
                        <div className={`text-[13px] font-semibold num ${h.metrics.cagr >= 0 ? "text-up" : "text-down"}`}>
                          {fmtPct(h.metrics.cagr, true)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-medium text-ink-500 uppercase tracking-[0.06em] mb-0.5">MDD</div>
                        <div className="text-[13px] font-semibold num text-down">{fmtPct(h.metrics.mdd)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 비교 결과 */}
          {selected.length === 0 ? (
            <div className="border hairline rounded-lg p-8 text-center bg-ink-50">
              <p className="text-[13px] text-ink-500">위 카드에서 비교할 기록을 선택하세요.</p>
            </div>
          ) : (
            <>
              <div className="bg-paper border hairline rounded-lg p-5">
                <h2 className="text-[14px] font-semibold text-ink-900 mb-3">주요 지표 비교</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" />
                    <XAxis dataKey="metric" tick={{ fontSize: 12, fill: "#737373", fontFamily: "JetBrains Mono" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }} />
                    <Tooltip
                      cursor={{ fill: "#f5f5f4" }}
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid #e5e5e3",
                        fontSize: 12,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#a3a3a3" />
                    {selected.map((h, i) => (
                      <Bar key={h.id} dataKey={h.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-paper border hairline rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b hairline">
                  <h2 className="text-[14px] font-semibold text-ink-900">상세 비교</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] border-b hairline">
                        <th className="px-5 py-2.5">비교 항목</th>
                        {selected.map((h, i) => (
                          <th
                            key={h.id}
                            className="px-5 py-2.5 font-semibold normal-case text-[12.5px]"
                            style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
                          >
                            {h.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <CompareRow label="연평균 수익률 (CAGR)" items={selected} getter={(h) => fmtPct(h.metrics.cagr, true)} valueClass="text-up" />
                      <CompareRow label="최대 낙폭 (MDD)" items={selected} getter={(h) => fmtPct(h.metrics.mdd)} valueClass="text-down" />
                      <CompareRow label="샤프 지수" items={selected} getter={(h) => h.metrics.sharpe.toFixed(2)} valueClass="text-ink-900" />
                      <CompareRow label="최고의 해" items={selected} getter={(h) => fmtPct(h.metrics.bestYear, true)} valueClass="text-pos" />
                      <CompareRow label="최악의 해" items={selected} getter={(h) => fmtPct(h.metrics.worstYear)} valueClass="text-down" />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  items,
  getter,
  valueClass,
}: {
  label: string;
  items: HistoryRecord[];
  getter: (h: HistoryRecord) => string;
  valueClass: string;
}) {
  return (
    <tr className="border-b hairline last:border-0 hover:bg-ink-50/50 transition-colors">
      <td className="px-5 py-3 font-medium text-ink-700">{label}</td>
      {items.map((h) => (
        <td key={h.id} className={`px-5 py-3 num font-semibold ${valueClass}`}>
          {getter(h)}
        </td>
      ))}
    </tr>
  );
}