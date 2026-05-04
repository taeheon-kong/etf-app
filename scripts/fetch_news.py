"""
글로벌 뉴스 수집 스크립트.
한국 + 미국 + 유럽 + 일본 + 중국 RSS 피드에서 헤드라인 수집.

실행: python scripts/fetch_news.py
출력: data/news/YYYY_MM_raw.md (마크다운, claude.ai 분석용)
"""

import os
import re
from datetime import datetime, timedelta
import feedparser

OUT_DIR = os.path.join("data", "news")
os.makedirs(OUT_DIR, exist_ok=True)

# 지역별 RSS 피드 목록
RSS_FEEDS = {
    "🇰🇷 한국": [
        ("연합뉴스 경제", "https://www.yna.co.kr/rss/economy.xml"),
        ("연합뉴스 정치", "https://www.yna.co.kr/rss/politics.xml"),
        ("매일경제 증권", "https://www.mk.co.kr/rss/50200011/"),
        ("매일경제 경제", "https://www.mk.co.kr/rss/30000001/"),
        ("한국경제 경제", "https://rss.hankyung.com/feed/economy.xml"),
        ("한국경제 증권", "https://rss.hankyung.com/feed/finance.xml"),
    ],
    "🇺🇸 미국": [
        ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
        ("CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
        ("CNBC Markets", "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
        ("MarketWatch Top", "https://feeds.marketwatch.com/marketwatch/topstories/"),
        ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
        ("Federal Reserve News", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ],
    "🇪🇺 유럽": [
        ("Reuters Europe", "https://feeds.reuters.com/reuters/EUbusinessNews"),
        ("Financial Times", "https://www.ft.com/rss/home/uk"),
        ("ECB Press", "https://www.ecb.europa.eu/rss/press.html"),
        ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ],
    "🇯🇵 일본": [
        ("NHK World Business", "https://www3.nhk.or.jp/nhkworld/en/news/feeds/business.xml"),
        ("Japan Times Business", "https://www.japantimes.co.jp/feed/business/"),
        ("Nikkei Asia", "https://asia.nikkei.com/rss/feed/nar"),
    ],
    "🇨🇳 중국": [
        ("Reuters China", "https://feeds.reuters.com/reuters/AsiabusinessNews"),
        ("South China Morning Post", "https://www.scmp.com/rss/91/feed"),
        ("Caixin Global", "https://www.caixinglobal.com/rss/"),
    ],
}

# 금융 시장 관련 키워드 (이거 포함된 헤드라인만 우선 추출)
KEYWORDS = [
    # 한국어
    "금리", "환율", "주식", "증시", "채권", "달러", "원화", "엔화", "위안",
    "인플레", "물가", "경기", "침체", "성장", "GDP", "수출", "수입",
    "한국은행", "기준금리", "코스피", "코스닥",
    "Fed", "연준", "ECB", "BoJ", "PBoC",
    "정책", "규제", "관세", "무역",
    "AI", "반도체", "전기차", "배터리", "에너지", "원자재",
    "비트코인", "암호화폐", "가상자산",
    "연준", "긴축", "완화", "인하", "동결",
    # 영어
    "rate", "yield", "stock", "bond", "dollar", "yen", "yuan", "euro",
    "inflation", "deflation", "recession", "growth", "GDP", "export", "import",
    "Federal Reserve", "Fed", "ECB", "central bank", "interest rate",
    "policy", "regulation", "tariff", "trade",
    "AI", "semiconductor", "chip", "EV", "battery", "energy", "commodity",
    "bitcoin", "crypto", "ethereum",
    "tightening", "easing", "cut", "hike", "hold",
    "tech", "earnings", "S&P", "Nasdaq", "Dow",
]


def is_relevant(title: str) -> bool:
    """헤드라인이 금융 시장 관련 키워드 포함하는지"""
    t = title.lower()
    for kw in KEYWORDS:
        if kw.lower() in t:
            return True
    return False


def clean_text(text: str) -> str:
    """HTML 태그 + 여러 공백 제거"""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_feed(name: str, url: str, days: int = 30, max_items: int = 30) -> list:
    """RSS 피드에서 최근 N일 헤드라인 추출"""
    items = []
    try:
        feed = feedparser.parse(url)
        cutoff = datetime.now() - timedelta(days=days)

        for entry in feed.entries[:max_items * 2]:
            title = clean_text(entry.get("title", ""))
            if not title:
                continue

            # 게시일 파싱
            pub_str = ""
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    pub_dt = datetime(*entry.published_parsed[:6])
                    if pub_dt < cutoff:
                        continue
                    pub_str = pub_dt.strftime("%m-%d")
                except Exception:
                    pass

            # 키워드 필터
            if not is_relevant(title):
                continue

            summary = clean_text(entry.get("summary", ""))[:200]

            items.append({
                "date": pub_str,
                "title": title,
                "summary": summary,
                "source": name,
            })

            if len(items) >= max_items:
                break
    except Exception as e:
        print(f"    ERROR: {e}")
    return items


def main():
    print("Fetching global news from RSS feeds...")
    print("=" * 60)

    all_news = {}
    total_count = 0

    for region, feeds in RSS_FEEDS.items():
        print(f"\n{region}")
        region_items = []
        for name, url in feeds:
            print(f"  [{name}]...", end=" ", flush=True)
            items = fetch_feed(name, url)
            region_items.extend(items)
            print(f"OK ({len(items)} items)")
        all_news[region] = region_items
        total_count += len(region_items)
        print(f"  → {region}: {len(region_items)}개 헤드라인")

    # 마크다운 출력 파일 생성
    now = datetime.now()
    filename = f"{now.year}_{now.month:02d}_raw.md"
    output_path = os.path.join(OUT_DIR, filename)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"# 글로벌 뉴스 헤드라인 모음\n\n")
        f.write(f"**수집일:** {now.strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"**총 헤드라인:** {total_count}개\n\n")
        f.write(f"이 파일은 claude.ai에 붙여넣어 월간 시장 환경을 분석할 때 사용합니다.\n\n")
        f.write("---\n\n")

        for region, items in all_news.items():
            f.write(f"## {region} ({len(items)}개)\n\n")
            for item in items:
                date_prefix = f"[{item['date']}] " if item['date'] else ""
                f.write(f"- {date_prefix}**{item['title']}** _({item['source']})_\n")
                if item['summary']:
                    f.write(f"  - {item['summary']}\n")
            f.write("\n")

    print("=" * 60)
    print(f"Total: {total_count} headlines collected")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()