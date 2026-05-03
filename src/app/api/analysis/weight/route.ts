import { NextResponse } from "next/server";
import { findHoldingsByTicker, searchHoldings } from "@/lib/finance/holdingsIndex";

export async function POST(req: Request) {
  try {
    const { query, mode } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "검색어를 입력하세요." }, { status: 400 });
    }

    if (mode === "search") {
      // 자동완성용 부분 일치
      const results = searchHoldings(query, 10);
      return NextResponse.json({ results });
    }

    // 정확한 티커 검색
    const info = findHoldingsByTicker(query);
    if (!info) {
      return NextResponse.json({
        found: false,
        symbol: query.toUpperCase(),
      });
    }

    return NextResponse.json({
      found: true,
      symbol: info.symbol,
      name: info.name,
      count: info.etfs.length,
      etfs: info.etfs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}