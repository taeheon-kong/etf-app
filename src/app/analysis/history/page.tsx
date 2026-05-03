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

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

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
    <div className="px-6 lg:px-8 py-8 pb-20 max-w-[1280px]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <button
          onClick={() => router.push("/analysis")}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ← 분석 도구로
        </button>
        {histories.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">기록 비교</h1>
        <p className="text-sm text-slate-500 mt-1">
          이전에 돌렸던 백테스트를 나란히 놓고 비교합니다. 카드를 눌러 비교 대상에 추가/제외하세요.
        </p>
      </div>

      {histories.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="flex flex-col items-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-5">
              <IconEmpty />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">저장된 기록이 없습니다</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              백테스트를 실행하면 결과가 자동으로 여기에 저장됩니다.
            </p>
            <button
              onClick={() => router.push("/backtest")}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors"
            >
              백테스트 하러 가기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 기록 카드 그리드 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">
                전체 기록{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({histories.length}개)
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                선택됨 {selectedIds.size} / 5
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {histories.map((h) => {
                const isSelected = selectedIds.has(h.id);
                const colorIdx = selected.findIndex((s) => s.id === h.id);
                const dotColor = isSelected
                  ? SERIES_COLORS[colorIdx % SERIES_COLORS.length]
                  : "#cbd5e1";

                return (
                  <div
                    key={h.id}
                    onClick={() => toggleSelect(h.id)}
                    className={`relative p-4 rounded-xl cursor-pointer transition-all group ${
                      isSelected
                        ? "bg-blue-50/40 border-2 border-blue-400 shadow-sm"
                        : "bg-white border border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(h.id);
                      }}
                      className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <IconTrash />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <h3 className="font-bold text-slate-900 truncate pr-6 text-sm">
                        {h.name}
                      </h3>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mb-3">
                      {h.date}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {h.holdings.slice(0, 4).map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                        >
                          {item.ticker} {item.weight}%
                        </span>
                      ))}
                      {h.holdings.length > 4 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          +{h.holdings.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                          CAGR
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            h.metrics.cagr >= 0 ? "text-blue-600" : "text-rose-600"
                          }`}
                        >
                          {fmtPct(h.metrics.cagr, true)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                          MDD
                        </div>
                        <div className="text-sm font-bold text-rose-600">
                          {fmtPct(h.metrics.mdd)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 비교 결과 */}
          {selected.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">
                위 카드에서 비교할 기록을 선택하세요.
              </p>
            </div>
          ) : (
            <>
              {/* 차트 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-3">주요 지표 비교</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    {selected.map((h, i) => (
                      <Bar
                        key={h.id}
                        dataKey={h.name}
                        fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 상세 테이블 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">상세 비교</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                        <th className="py-2 pr-3">비교 항목</th>
                        {selected.map((h, i) => (
                          <th
                            key={h.id}
                            className="py-2 pr-3 font-bold normal-case text-sm"
                            style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
                          >
                            {h.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <CompareRow
                        label="연평균 수익률 (CAGR)"
                        items={selected}
                        getter={(h) => fmtPct(h.metrics.cagr, true)}
                        valueClass="text-blue-600 font-bold"
                      />
                      <CompareRow
                        label="최대 낙폭 (MDD)"
                        items={selected}
                        getter={(h) => fmtPct(h.metrics.mdd)}
                        valueClass="text-rose-600 font-bold"
                      />
                      <CompareRow
                        label="샤프 지수"
                        items={selected}
                        getter={(h) => h.metrics.sharpe.toFixed(2)}
                        valueClass="text-slate-900 font-bold"
                      />
                      <CompareRow
                        label="최고의 해"
                        items={selected}
                        getter={(h) => fmtPct(h.metrics.bestYear, true)}
                        valueClass="text-emerald-600 font-bold"
                      />
                      <CompareRow
                        label="최악의 해"
                        items={selected}
                        getter={(h) => fmtPct(h.metrics.worstYear)}
                        valueClass="text-rose-600 font-bold"
                      />
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
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 pr-3 font-semibold text-slate-700">{label}</td>
      {items.map((h) => (
        <td key={h.id} className={`py-3 pr-3 ${valueClass}`}>
          {getter(h)}
        </td>
      ))}
    </tr>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

function IconEmpty() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 6-6" />
    </svg>
  );
}