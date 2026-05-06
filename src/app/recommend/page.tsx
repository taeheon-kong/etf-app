"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  InvestorProfile,
  InvestmentInterest,
  InvestmentRegion,
} from "@/lib/finance/profileEngine";

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
    interests: [],
    regions: ["korea", "usa"],
    macroView: "unsure",
    portfolioSize: "balanced",
  });
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof InvestorProfile>(key: K, value: InvestorProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const toggleInterest = (v: InvestmentInterest) => {
    setProfile((p) => {
      if (v === "none") return { ...p, interests: ["none"] };
      const without = p.interests.filter((x) => x !== "none");
      const exists = without.includes(v);
      const next = exists ? without.filter((x) => x !== v) : [...without, v];
      return { ...p, interests: next };
    });
  };

  const toggleRegion = (v: InvestmentRegion) => {
    setProfile((p) => {
      const exists = p.regions.includes(v);
      const next = exists ? p.regions.filter((x) => x !== v) : [...p.regions, v];
      return { ...p, regions: next };
    });
  };

  const goRecommend = () => {
    setError(null);
    sessionStorage.setItem("etf_recommend_profile", JSON.stringify(profile));
    router.push("/recommend/result");
  };

  return (
    <div className="max-w-[1080px] mx-auto px-10 py-10 pb-32">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">01 / 추천 시작</div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">당신에게 맞는 포트폴리오를 찾습니다</h1>
          <p className="text-[13.5px] text-ink-600 mt-2">11개 질문에 답하면, 5년 백테스트 + 점수 엔진으로 ETF와 자산배분을 추천합니다.</p>
        </div>
        <div className="text-[12px] text-ink-500 num">예상 소요 · 60s</div>
      </div>

      <div className="mt-8 mb-10 flex items-center gap-3">
        <div className="flex-1 h-px bg-ink-200" />
        <div className="text-[11px] text-ink-500 num">11문항</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8">
        {/* Q1 */}
        <QSection num={1} label="투자 기간" desc="얼마나 오래 운용하시나요?">
          <div className="grid grid-cols-3 gap-2">
            <Pill active={profile.horizon === "short"} onClick={() => update("horizon", "short")}><b>단기</b><sub>1–3년</sub></Pill>
            <Pill active={profile.horizon === "mid"} onClick={() => update("horizon", "mid")}><b>중기</b><sub>3–10년</sub></Pill>
            <Pill active={profile.horizon === "long"} onClick={() => update("horizon", "long")}><b>장기</b><sub>10년+</sub></Pill>
          </div>
        </QSection>

        {/* Q2 */}
        <QSection num={2} label="위험 감수도" desc="일시적 손실을 견딜 수 있나요?">
          <div className="grid grid-cols-2 gap-2">
            <Pill active={profile.riskTolerance === "conservative"} onClick={() => update("riskTolerance", "conservative")}><b>안정 추구</b><sub>손실 최소화</sub></Pill>
            <Pill active={profile.riskTolerance === "neutral"} onClick={() => update("riskTolerance", "neutral")}><b>중립</b><sub>적당히 감수</sub></Pill>
            <Pill active={profile.riskTolerance === "aggressive"} onClick={() => update("riskTolerance", "aggressive")}><b>공격적</b><sub>변동성 OK</sub></Pill>
            <Pill active={profile.riskTolerance === "very_aggressive"} onClick={() => update("riskTolerance", "very_aggressive")}><b>매우 공격적</b><sub>고위험 OK</sub></Pill>
          </div>
        </QSection>

        {/* Q3 */}
        <QSection num={3} label="투자 목표" desc="무엇을 위해 투자하시나요?">
          <div className="grid grid-cols-2 gap-2">
            <Pill active={profile.goal === "preserve"} onClick={() => update("goal", "preserve")}><b>자산 보존</b><sub>물가 방어</sub></Pill>
            <Pill active={profile.goal === "balance"} onClick={() => update("goal", "balance")}><b>균형</b><sub>안정+성장</sub></Pill>
            <Pill active={profile.goal === "growth"} onClick={() => update("goal", "growth")}><b>성장</b><sub>자산 증식</sub></Pill>
            <Pill active={profile.goal === "maximize"} onClick={() => update("goal", "maximize")}><b>수익 극대화</b><sub>최고 수익</sub></Pill>
          </div>
        </QSection>

        {/* Q4 */}
        <QSection num={4} label="시장 선호" desc="어느 시장에 투자하시나요?">
          <div className="grid grid-cols-2 gap-2">
            <Pill active={profile.market === "kr"} onClick={() => update("market", "kr")}><b>한국 ETF</b><sub>국내 상장</sub></Pill>
            <Pill active={profile.market === "us"} onClick={() => update("market", "us")}><b>미국 ETF</b><sub>해외 직투</sub></Pill>
            <Pill active={profile.market === "global"} onClick={() => update("market", "global")}><b>글로벌</b><sub>한국+미국</sub></Pill>
            <Pill active={profile.market === "any"} onClick={() => update("market", "any")}><b>상관없음</b><sub>최고 점수</sub></Pill>
          </div>
        </QSection>

        {/* Q5 */}
        <QSection num={5} label="배당 선호" desc="배당을 얼마나 중시하시나요?">
          <div className="grid grid-cols-3 gap-2">
            <Pill active={profile.dividendPref === "high"} onClick={() => update("dividendPref", "high")}><b>매우 중시</b><sub>현금흐름</sub></Pill>
            <Pill active={profile.dividendPref === "medium"} onClick={() => update("dividendPref", "medium")}><b>적당히</b><sub>있으면 좋음</sub></Pill>
            <Pill active={profile.dividendPref === "none"} onClick={() => update("dividendPref", "none")}><b>신경 안 씀</b><sub>시세차익</sub></Pill>
          </div>
        </QSection>

        {/* Q6 */}
        <QSection num={6} label="운용보수 민감도" desc="보수가 얼마나 신경 쓰이세요?">
          <div className="grid grid-cols-3 gap-2">
            <Pill active={profile.costSensitive === "high"} onClick={() => update("costSensitive", "high")}><b>매우 민감</b><sub>최저가</sub></Pill>
            <Pill active={profile.costSensitive === "medium"} onClick={() => update("costSensitive", "medium")}><b>보통</b><sub>적당히</sub></Pill>
            <Pill active={profile.costSensitive === "low"} onClick={() => update("costSensitive", "low")}><b>신경 안 씀</b><sub>성과 우선</sub></Pill>
          </div>
        </QSection>

        {/* Q7 */}
        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <QHeader num={7} label="레버리지 / 인버스 ETF" desc="2배·3배 ETF, 인버스 ETF를 후보에 포함할까요?" />
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <Pill active={!profile.allowLeveraged} onClick={() => update("allowLeveraged", false)}><b>제외</b><sub>일반 ETF만</sub></Pill>
            <Pill active={profile.allowLeveraged} onClick={() => update("allowLeveraged", true)}><b>허용</b><sub>고변동성 OK</sub></Pill>
          </div>
          {profile.allowLeveraged && (
            <Notice tone="warn" className="mt-3 max-w-md">
              레버리지 ETF는 일별 변동성으로 시간 감쇠가 발생합니다. 장기 보유 시 단순 N배 수익이 아닐 수 있어요.
            </Notice>
          )}
        </div>

        {/* Q8 */}
        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <QHeader num={8} label="관심 테마" desc="복수 선택. 선택한 테마와 관련 ETF에 가산점이 붙습니다." />
          <div className="flex flex-wrap gap-1.5">
            {[
              ["ai_semi", "AI · 반도체"], ["tech", "빅테크 · 플랫폼"],
              ["clean_energy", "친환경 · 2차전지"], ["healthcare", "헬스케어 · 바이오"],
              ["infra", "인프라 · 방산"], ["finance", "금융 · 은행"],
              ["realestate", "부동산 · 리츠"], ["crypto", "비트코인 · 이더"],
              ["commodity", "금 · 원자재"], ["dividend", "고배당"], ["none", "특별히 없음"],
            ].map(([v, l]) => (
              <Chip key={v} active={profile.interests.includes(v as InvestmentInterest)}
                onClick={() => toggleInterest(v as InvestmentInterest)}>{l}</Chip>
            ))}
          </div>
        </div>

        {/* Q9 */}
        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <QHeader num={9} label="관심 지역" desc="복수 선택. 글로벌 뉴스 분석에 반영됩니다." />
          <div className="flex flex-wrap gap-1.5">
            {[
              ["korea", "한국", "KR"], ["usa", "미국", "US"], ["europe", "유럽", "EU"],
              ["japan", "일본", "JP"], ["china", "중국", "CN"], ["emerging", "신흥국", "EM"], ["global", "글로벌 분산", "WW"],
            ].map(([v, l, code]) => (
              <Chip key={v} active={profile.regions.includes(v as InvestmentRegion)}
                onClick={() => toggleRegion(v as InvestmentRegion)}>
                <span className="num text-[10px] text-ink-500 mr-1.5">{code}</span>{l}
              </Chip>
            ))}
          </div>
        </div>

        {/* Q10 */}
        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <QHeader num={10} label="시장 전망" desc="요즘 시장을 어떻게 보세요?" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Pill active={profile.macroView === "inflation"} onClick={() => update("macroView", "inflation")}><b>인플레 우려</b><sub>물가 상승</sub></Pill>
            <Pill active={profile.macroView === "recession"} onClick={() => update("macroView", "recession")}><b>침체 우려</b><sub>경기 둔화</sub></Pill>
            <Pill active={profile.macroView === "bull"} onClick={() => update("macroView", "bull")}><b>강세장 기대</b><sub>상승 기대</sub></Pill>
            <Pill active={profile.macroView === "neutral"} onClick={() => update("macroView", "neutral")}><b>중립</b><sub>박스권</sub></Pill>
            <Pill active={profile.macroView === "unsure"} onClick={() => update("macroView", "unsure")}><b>모르겠음</b><sub>분석에 맡김</sub></Pill>
          </div>
        </div>

        {/* Q11 */}
        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <QHeader num={11} label="ETF 개수" desc="포트폴리오를 몇 개의 ETF로 구성할까요?" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Pill active={profile.portfolioSize === "minimal"} onClick={() => update("portfolioSize", "minimal")}><b>미니멀 · 2개</b><sub>버핏 스타일</sub></Pill>
            <Pill active={profile.portfolioSize === "simple"} onClick={() => update("portfolioSize", "simple")}><b>심플 · 3개</b><sub>3펀드 포트폴리오</sub></Pill>
            <Pill active={profile.portfolioSize === "balanced"} onClick={() => update("portfolioSize", "balanced")}><b>균형 · 4–5개</b><sub>기본 (추천)</sub></Pill>
            <Pill active={profile.portfolioSize === "diverse"} onClick={() => update("portfolioSize", "diverse")}><b>분산 · 5–6개</b><sub>테마 포함</sub></Pill>
          </div>
          {profile.portfolioSize === "minimal" && (
            <Notice tone="warn" className="mt-3">2개 구성은 분산 효과가 제한적입니다. 한 자산이 큰 손실을 보면 포트폴리오 전체가 영향받을 수 있습니다.</Notice>
          )}
          {profile.portfolioSize === "simple" && (
            <Notice tone="info" className="mt-3">Bogleheads 3펀드 스타일 — 미국 주식 + 해외 주식 + 채권의 클래식 분산 전략입니다.</Notice>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 lg:left-[232px] right-0 bg-paper/85 backdrop-blur-md border-t hairline px-10 py-4 z-40">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between gap-4">
          <div className="text-[12px] text-ink-600">
            모든 답변 저장됨 · <span className="num text-ink-900">11문항</span>
          </div>
          <button
            onClick={goRecommend}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-ink-900 text-paper rounded-md text-[14px] font-medium hover:bg-ink-800"
          >
            추천 받기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="max-w-[1080px] mx-auto mt-2 text-[12px] text-down bg-down-soft px-3 py-2 rounded-md">{error}</div>
        )}
      </div>
    </div>
  );
}

// ── 헬퍼 컴포넌트 ──

function QHeader({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2.5">
        <span className="num text-[10px] font-medium text-ink-500">Q{String(num).padStart(2, "0")}</span>
        <h3 className="text-[14px] font-semibold text-ink-900">{label}</h3>
      </div>
      <p className="text-[12.5px] text-ink-500 mt-1 ml-7">{desc}</p>
    </div>
  );
}

function QSection({ num, label, desc, children }: { num: number; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-lg p-5 bg-paper">
      <QHeader num={num} label={label} desc={desc} />
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-left px-3.5 py-2.5 rounded-md text-[13px] transition-all border ${
        active
          ? "bg-ink-900 text-paper border-ink-900"
          : "bg-paper border-ink-200 text-ink-800 hover:border-ink-400 hover:bg-ink-50"
      } [&_b]:block [&_b]:font-medium [&_sub]:block [&_sub]:text-[11px] [&_sub]:opacity-70 [&_sub]:mt-0.5 [&_sub]:bottom-auto [&_sub]:vertical-align-baseline`}>
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12.5px] transition-all border ${
        active
          ? "bg-ink-900 text-paper border-ink-900"
          : "bg-paper border-ink-200 text-ink-700 hover:border-ink-400 hover:bg-ink-50"
      }`}>{children}</button>
  );
}

function Notice({ tone = "info", children, className = "" }: { tone?: "info" | "warn"; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "bg-ink-50 border-ink-200 text-ink-700",
    warn: "bg-accent-soft border-accent/30 text-accent-ink",
  };
  return (
    <div className={`flex items-start gap-2 text-[12px] px-3 py-2 rounded-md border ${tones[tone]} ${className}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}