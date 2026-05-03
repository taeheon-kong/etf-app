"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvestorProfile } from "@/lib/finance/profileEngine";

export default function RecommendPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<InvestorProfile>({
    horizon: "mid",
    riskTolerance: "neutral",
    goal: "balance",
    market: "global",
    dividendPref: "medium",
    costSensitive: "medium",
    allowLeveraged: false,
  });
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof InvestorProfile>(key: K, value: InvestorProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const goRecommend = () => {
    setError(null);
    sessionStorage.setItem("etf_recommend_profile", JSON.stringify(profile));
    router.push("/recommend/result");
  };

  return (
    <div className="px-6 lg:px-8 py-8 pb-32 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">포트폴리오 추천</h1>
        <p className="text-sm text-slate-500 mt-1">
          7문항 답변으로 당신에게 맞는 ETF와 포트폴리오를 찾아드립니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Q1 — 투자 기간 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={1} label="투자 기간" desc="얼마나 오래 운용하실 건가요?" />
          <div className="grid grid-cols-3 gap-2">
            <Option active={profile.horizon === "short"} onClick={() => update("horizon", "short")}>
              <div className="font-bold">단기</div>
              <div className="text-[11px] mt-0.5 opacity-80">1~3년</div>
            </Option>
            <Option active={profile.horizon === "mid"} onClick={() => update("horizon", "mid")}>
              <div className="font-bold">중기</div>
              <div className="text-[11px] mt-0.5 opacity-80">3~10년</div>
            </Option>
            <Option active={profile.horizon === "long"} onClick={() => update("horizon", "long")}>
              <div className="font-bold">장기</div>
              <div className="text-[11px] mt-0.5 opacity-80">10년+</div>
            </Option>
          </div>
        </div>

        {/* Q2 — 위험 감수도 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={2} label="위험 감수도" desc="자산 가치가 일시적으로 하락해도 견딜 수 있나요?" />
          <div className="grid grid-cols-2 gap-2">
            <Option active={profile.riskTolerance === "conservative"} onClick={() => update("riskTolerance", "conservative")}>
              <div className="font-bold">안정 추구</div>
              <div className="text-[11px] mt-0.5 opacity-80">손실 최소화</div>
            </Option>
            <Option active={profile.riskTolerance === "neutral"} onClick={() => update("riskTolerance", "neutral")}>
              <div className="font-bold">중립</div>
              <div className="text-[11px] mt-0.5 opacity-80">적당히 감수</div>
            </Option>
            <Option active={profile.riskTolerance === "aggressive"} onClick={() => update("riskTolerance", "aggressive")}>
              <div className="font-bold">공격적</div>
              <div className="text-[11px] mt-0.5 opacity-80">변동성 OK</div>
            </Option>
            <Option active={profile.riskTolerance === "very_aggressive"} onClick={() => update("riskTolerance", "very_aggressive")}>
              <div className="font-bold">매우 공격적</div>
              <div className="text-[11px] mt-0.5 opacity-80">고위험 OK</div>
            </Option>
          </div>
        </div>

        {/* Q3 — 목표 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={3} label="투자 목표" desc="무엇을 위해 투자하시나요?" />
          <div className="grid grid-cols-2 gap-2">
            <Option active={profile.goal === "preserve"} onClick={() => update("goal", "preserve")}>
              <div className="font-bold">자산 보존</div>
              <div className="text-[11px] mt-0.5 opacity-80">물가 방어</div>
            </Option>
            <Option active={profile.goal === "balance"} onClick={() => update("goal", "balance")}>
              <div className="font-bold">균형</div>
              <div className="text-[11px] mt-0.5 opacity-80">안정+성장</div>
            </Option>
            <Option active={profile.goal === "growth"} onClick={() => update("goal", "growth")}>
              <div className="font-bold">성장</div>
              <div className="text-[11px] mt-0.5 opacity-80">자산 증식</div>
            </Option>
            <Option active={profile.goal === "maximize"} onClick={() => update("goal", "maximize")}>
              <div className="font-bold">수익 극대화</div>
              <div className="text-[11px] mt-0.5 opacity-80">최고 수익</div>
            </Option>
          </div>
        </div>

        {/* Q4 — 시장 선호 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={4} label="시장 선호" desc="어느 시장에 투자하시겠어요?" />
          <div className="grid grid-cols-2 gap-2">
            <Option active={profile.market === "kr"} onClick={() => update("market", "kr")}>
              <div className="font-bold">한국 ETF</div>
              <div className="text-[11px] mt-0.5 opacity-80">국내 상장</div>
            </Option>
            <Option active={profile.market === "us"} onClick={() => update("market", "us")}>
              <div className="font-bold">미국 ETF</div>
              <div className="text-[11px] mt-0.5 opacity-80">해외 직투</div>
            </Option>
            <Option active={profile.market === "global"} onClick={() => update("market", "global")}>
              <div className="font-bold">글로벌</div>
              <div className="text-[11px] mt-0.5 opacity-80">한국+미국</div>
            </Option>
            <Option active={profile.market === "any"} onClick={() => update("market", "any")}>
              <div className="font-bold">상관없음</div>
              <div className="text-[11px] mt-0.5 opacity-80">최고 점수</div>
            </Option>
          </div>
        </div>

        {/* Q5 — 배당 선호 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={5} label="배당 선호" desc="배당 수익을 얼마나 중시하시나요?" />
          <div className="grid grid-cols-3 gap-2">
            <Option active={profile.dividendPref === "high"} onClick={() => update("dividendPref", "high")}>
              <div className="font-bold">매우 중시</div>
              <div className="text-[11px] mt-0.5 opacity-80">현금흐름</div>
            </Option>
            <Option active={profile.dividendPref === "medium"} onClick={() => update("dividendPref", "medium")}>
              <div className="font-bold">적당히</div>
              <div className="text-[11px] mt-0.5 opacity-80">있으면 좋음</div>
            </Option>
            <Option active={profile.dividendPref === "none"} onClick={() => update("dividendPref", "none")}>
              <div className="font-bold">신경 안 씀</div>
              <div className="text-[11px] mt-0.5 opacity-80">시세차익</div>
            </Option>
          </div>
        </div>

        {/* Q6 — 비용 민감도 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={6} label="운용보수 민감도" desc="ETF 운용보수(연 %)가 얼마나 신경 쓰이세요?" />
          <div className="grid grid-cols-3 gap-2">
            <Option active={profile.costSensitive === "high"} onClick={() => update("costSensitive", "high")}>
              <div className="font-bold">매우 민감</div>
              <div className="text-[11px] mt-0.5 opacity-80">최저가</div>
            </Option>
            <Option active={profile.costSensitive === "medium"} onClick={() => update("costSensitive", "medium")}>
              <div className="font-bold">보통</div>
              <div className="text-[11px] mt-0.5 opacity-80">적당히</div>
            </Option>
            <Option active={profile.costSensitive === "low"} onClick={() => update("costSensitive", "low")}>
              <div className="font-bold">신경 안 씀</div>
              <div className="text-[11px] mt-0.5 opacity-80">성과 우선</div>
            </Option>
          </div>
        </div>

        {/* Q7 — 레버리지 허용 (전체 너비) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Question num={7} label="레버리지 / 인버스 ETF 허용" desc="2배·3배 ETF, 인버스 ETF를 추천 후보에 포함할까요?" />
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <Option active={!profile.allowLeveraged} onClick={() => update("allowLeveraged", false)}>
              <div className="font-bold">제외</div>
              <div className="text-[11px] mt-0.5 opacity-80">일반 ETF만</div>
            </Option>
            <Option active={profile.allowLeveraged} onClick={() => update("allowLeveraged", true)}>
              <div className="font-bold">허용</div>
              <div className="text-[11px] mt-0.5 opacity-80">고변동성 OK</div>
            </Option>
          </div>
          {profile.allowLeveraged && (
            <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-start gap-2">
              <span className="font-bold shrink-0">⚠</span>
              <span>레버리지 ETF는 일별 변동성으로 시간 감쇠가 발생합니다. 장기 보유 시 단순 N배 수익이 아닐 수 있어요.</span>
            </div>
          )}
        </div>
      </div>

      {/* 실행 버튼 (고정) */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-4 z-40">
        <div className="max-w-[1400px] mx-auto">
          <button
            onClick={goRecommend}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors text-base shadow-lg shadow-blue-600/20"
          >
            추천 받기
          </button>
          {error && (
            <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────
function Question({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
          {num}
        </span>
        <h3 className="font-bold text-slate-900">{label}</h3>
      </div>
      <p className="text-xs text-slate-500 ml-8">{desc}</p>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-3 px-3 rounded-lg text-sm transition-all text-center ${
        active
          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
          : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}