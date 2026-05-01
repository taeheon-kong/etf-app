/**
 * 한국 ETF 카탈로그 (수동 정제 버전).
 * FinanceDataReader 기반, 시가총액 + 거래대금 가중 상위 200개.
 */

export type KrEtfCategory =
  | "kospi"
  | "kosdaq"
  | "usIndex"
  | "global"
  | "sector"
  | "thematic"
  | "dividend"
  | "coveredCall"
  | "bond"
  | "commodity"
  | "realEstate"
  | "leveraged"
  | "crypto";

export type KrEtfMeta = {
  ticker: string;
  name: string;
  category: KrEtfCategory;
  tags: KrEtfCategory[];
  marCap: number;
  volume: number;
  amount: number;
  price: number;
  nav: number;
};

export const KR_CATEGORY_LABELS: Record<KrEtfCategory, string> = {
  kospi: "코스피",
  kosdaq: "코스닥",
  usIndex: "미국지수",
  global: "글로벌",
  sector: "섹터",
  thematic: "테마",
  dividend: "배당",
  coveredCall: "커버드콜",
  bond: "채권/금리",
  commodity: "원자재",
  realEstate: "리츠",
  leveraged: "레버리지/인버스",
  crypto: "가상자산",
};

export const KR_CATEGORY_ORDER: KrEtfCategory[] = [
  "kospi",
  "kosdaq",
  "usIndex",
  "global",
  "sector",
  "thematic",
  "dividend",
  "coveredCall",
  "bond",
  "commodity",
  "realEstate",
  "leveraged",
  "crypto",
];

export const KR_ETF_CATALOG: KrEtfMeta[] = [
  { ticker: "069500", name: "KODEX 200", category: "kospi", tags: ["kospi"], marCap: 219042, volume: 76272, amount: 7621, price: 99905.0, nav: 99716.0 },
  { ticker: "360750", name: "TIGER 미국S&P500", category: "usIndex", tags: ["usIndex"], marCap: 165475, volume: 13979103, amount: 368017, price: 26160.0, nav: 26275.0 },
  { ticker: "122630", name: "KODEX 레버리지", category: "leveraged", tags: ["leveraged", "kospi"], marCap: 72791, volume: 16818390, amount: 1982746, price: 115450.0, nav: 115678.0 },
  { ticker: "396500", name: "TIGER 반도체TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 103657, volume: 20426431, amount: 829314, price: 40115.0, nav: 39966.0 },
  { ticker: "379800", name: "KODEX 미국S&P500", category: "usIndex", tags: ["usIndex"], marCap: 86863, volume: 16515655, amount: 396349, price: 23870.0, nav: 23954.0 },
  { ticker: "133690", name: "TIGER 미국나스닥100", category: "usIndex", tags: ["usIndex"], marCap: 92234, volume: 904922, amount: 162444, price: 177990.0, nav: 178826.0 },
  { ticker: "459580", name: "KODEX CD금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 80792, volume: 294814, amount: 316566, price: 1073785.0, nav: 1073796.0 },
  { ticker: "102110", name: "TIGER 200", category: "kospi", tags: ["kospi"], marCap: 87774, volume: 306, amount: 30, price: 99970.0, nav: 99719.0 },
  { ticker: "229200", name: "KODEX 코스닥150", category: "kosdaq", tags: ["kosdaq"], marCap: 62940, volume: 23132685, amount: 463214, price: 19855.0, nav: 19901.0 },
  { ticker: "488770", name: "KODEX 머니마켓액티브", category: "bond", tags: ["bond"], marCap: 80251, volume: 689315, amount: 71856, price: 104240.0, nav: 104243.0 },
  { ticker: "379810", name: "KODEX 미국나스닥100", category: "usIndex", tags: ["usIndex"], marCap: 68891, volume: 4657295, amount: 125183, price: 26645.0, nav: 26767.0 },
  { ticker: "278530", name: "KODEX 200TR", category: "kospi", tags: ["kospi"], marCap: 69925, volume: 1123717, amount: 40971, price: 36165.0, nav: 36061.0 },
  { ticker: "487240", name: "KODEX AI전력핵심설비", category: "sector", tags: ["sector", "thematic"], marCap: 34756, volume: 12175688, amount: 637429, price: 52820.0, nav: 52711.0 },
  { ticker: "498400", name: "KODEX 200타겟위클리커버드콜", category: "coveredCall", tags: ["coveredCall", "kospi"], marCap: 46722, volume: 7375023, amount: 152076, price: 20510.0, nav: 20369.0 },
  { ticker: "091160", name: "KODEX 반도체", category: "sector", tags: ["sector"], marCap: 52141, volume: 283, amount: 35, price: 123850.0, nav: 123503.0 },
  { ticker: "381180", name: "TIGER 미국필라델피아반도체나스닥", category: "usIndex", tags: ["usIndex", "sector"], marCap: 46871, volume: 1842987, amount: 74449, price: 39755.0, nav: 39930.0 },
  { ticker: "411060", name: "ACE KRX금현물", category: "commodity", tags: ["commodity"], marCap: 46906, volume: 1792620, amount: 54131, price: 30340.0, nav: 30351.0 },
  { ticker: "310970", name: "TIGER MSCI Korea TR", category: "kospi", tags: ["kospi"], marCap: 48948, volume: 26565, amount: 1179, price: 43860.0, nav: 43733.0 },
  { ticker: "357870", name: "TIGER CD금리투자KIS(합성)", category: "bond", tags: ["bond"], marCap: 45071, volume: 283868, amount: 16304, price: 57440.0, nav: 57436.0 },
  { ticker: "148020", name: "RISE 200", category: "kospi", tags: ["kospi"], marCap: 38703, volume: 1389900, amount: 141122, price: 100790.0, nav: 100482.0 },
  { ticker: "381170", name: "TIGER 미국테크TOP10 INDXX", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 41733, volume: 1554161, amount: 50926, price: 32490.0, nav: 32465.0 },
  { ticker: "423160", name: "KODEX KOFR금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 44061, volume: 1825, amount: 201, price: 110665.0, nav: 110654.0 },
  { ticker: "233740", name: "KODEX 코스닥150레버리지", category: "leveraged", tags: ["leveraged", "kosdaq"], marCap: 41538, volume: 68127, amount: 1147, price: 16615.0, nav: 16637.0 },
  { ticker: "273130", name: "KODEX 종합채권(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 40971, volume: 28796, amount: 3236, price: 112215.0, nav: 112287.0 },
  { ticker: "252670", name: "KODEX 200선물인버스2X", category: "leveraged", tags: ["leveraged", "kospi"], marCap: 11361, volume: 3605459400, amount: 599304, price: 169.0, nav: 169.0 },
  { ticker: "360200", name: "ACE 미국S&P500", category: "usIndex", tags: ["usIndex"], marCap: 36295, volume: 599362, amount: 15941, price: 26435.0, nav: 26558.0 },
  { ticker: "395270", name: "HANARO Fn K-반도체", category: "sector", tags: ["sector"], marCap: 27258, volume: 4303800, amount: 200670, price: 46005.0, nav: 45895.0 },
  { ticker: "458730", name: "TIGER 미국배당다우존스", category: "usIndex", tags: ["usIndex", "dividend"], marCap: 34149, volume: 1795235, amount: 26577, price: 14780.0, nav: 14811.0 },
  { ticker: "488080", name: "TIGER 반도체TOP10레버리지", category: "leveraged", tags: ["leveraged", "sector"], marCap: 17270, volume: 5980785, amount: 365700, price: 59450.0, nav: 59522.0 },
  { ticker: "305720", name: "KODEX 2차전지산업", category: "sector", tags: ["sector"], marCap: 25182, volume: 8814534, amount: 190288, price: 21450.0, nav: 21403.0 },
  { ticker: "102780", name: "KODEX 삼성그룹", category: "sector", tags: ["sector"], marCap: 30055, volume: 1592576, amount: 36441, price: 22700.0, nav: 22617.0 },
  { ticker: "367380", name: "ACE 미국나스닥100", category: "usIndex", tags: ["usIndex"], marCap: 30457, volume: 752078, amount: 23243, price: 30610.0, nav: 30747.0 },
  { ticker: "0043B0", name: "TIGER 머니마켓액티브", category: "bond", tags: ["bond"], marCap: 30705, volume: 142462, amount: 14582, price: 102365.0, nav: 102360.0 },
  { ticker: "455890", name: "RISE 머니마켓액티브", category: "bond", tags: ["bond"], marCap: 29106, volume: 431637, amount: 23695, price: 54900.0, nav: 54894.0 },
  { ticker: "481050", name: "KODEX CD1년금리플러스액티브(합성)", category: "bond", tags: ["bond"], marCap: 28865, volume: 13246, amount: 13535, price: 1021850.0, nav: 1021815.0 },
  { ticker: "161510", name: "PLUS 고배당주", category: "dividend", tags: ["dividend"], marCap: 27985, volume: 1112767, amount: 30340, price: 27165.0, nav: 27164.0 },
  { ticker: "114800", name: "KODEX 인버스", category: "leveraged", tags: ["leveraged", "kospi"], marCap: 8982, volume: 315721424, amount: 422585, price: 1349.0, nav: 1348.0 },
  { ticker: "466920", name: "SOL 조선TOP3플러스", category: "sector", tags: ["sector", "thematic"], marCap: 22193, volume: 2733041, amount: 114246, price: 41560.0, nav: 41679.0 },
  { ticker: "292150", name: "TIGER 코리아TOP10", category: "kospi", tags: ["kospi"], marCap: 22783, volume: 2269692, amount: 79250, price: 34730.0, nav: 34523.0 },
  { ticker: "449170", name: "TIGER KOFR금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 24442, volume: 99992, amount: 11077, price: 110785.0, nav: 110779.0 },
  { ticker: "395160", name: "KODEX AI반도체", category: "sector", tags: ["sector", "thematic"], marCap: 24931, volume: 1966, amount: 65, price: 33330.0, nav: 33255.0 },
  { ticker: "278540", name: "KODEX MSCI Korea TR", category: "kospi", tags: ["kospi"], marCap: 23634, volume: 35337, amount: 1246, price: 34910.0, nav: 34780.0 },
  { ticker: "232080", name: "TIGER 코스닥150", category: "kosdaq", tags: ["kosdaq"], marCap: 21371, volume: 930, amount: 18, price: 20265.0, nav: 20305.0 },
  { ticker: "449450", name: "PLUS K방산", category: "sector", tags: ["sector", "thematic"], marCap: 17874, volume: 909111, amount: 72283, price: 79405.0, nav: 79478.0 },
  { ticker: "214980", name: "KODEX 단기채권PLUS", category: "bond", tags: ["bond"], marCap: 20835, volume: 30849, amount: 3540, price: 114775.0, nav: 114809.0 },
  { ticker: "456600", name: "TIME 글로벌AI인공지능액티브", category: "global", tags: ["global", "thematic"], marCap: 18237, volume: 1038390, amount: 57608, price: 54570.0, nav: 54694.0 },
  { ticker: "385540", name: "RISE 종합채권(A-이상)액티브", category: "bond", tags: ["bond"], marCap: 20679, volume: 2683, amount: 281, price: 104955.0, nav: 105000.0 },
  { ticker: "487230", name: "KODEX 미국AI전력핵심인프라", category: "usIndex", tags: ["usIndex", "sector", "thematic"], marCap: 17921, volume: 1900567, amount: 47447, price: 24685.0, nav: 24801.0 },
  { ticker: "294400", name: "KIWOOM 200TR", category: "kospi", tags: ["kospi"], marCap: 18939, volume: 176718, amount: 23312, price: 131065.0, nav: 130652.0 },
  { ticker: "329200", name: "TIGER 리츠부동산인프라", category: "realEstate", tags: ["realEstate"], marCap: 16710, volume: 14799415, amount: 68406, price: 4665.0, nav: 4730.0 },
  { ticker: "139260", name: "TIGER 200 IT", category: "sector", tags: ["sector", "kospi"], marCap: 13062, volume: 1209269, amount: 140212, price: 114575.0, nav: 114089.0 },
  { ticker: "0162Z0", name: "RISE 삼성전자SK하이닉스채권혼합50", category: "bond", tags: ["bond", "sector"], marCap: 14866, volume: 8194580, amount: 94120, price: 11400.0, nav: 11403.0 },
  { ticker: "0117V0", name: "TIGER 코리아AI전력기기TOP3플러스", category: "sector", tags: ["sector", "thematic"], marCap: 10966, volume: 6301449, amount: 170232, price: 27245.0, nav: 27175.0 },
  { ticker: "494310", name: "KODEX 반도체레버리지", category: "leveraged", tags: ["leveraged", "sector"], marCap: 18389, volume: 2010, amount: 202, price: 100485.0, nav: 100635.0 },
  { ticker: "284430", name: "KODEX 200미국채혼합", category: "kospi", tags: ["kospi", "bond"], marCap: 16991, volume: 1175573, amount: 25018, price: 21175.0, nav: 21087.0 },
  { ticker: "426030", name: "TIME 미국나스닥100액티브", category: "usIndex", tags: ["usIndex"], marCap: 15010, volume: 1407431, amount: 66216, price: 46500.0, nav: 46482.0 },
  { ticker: "0091P0", name: "TIGER 코리아원자력", category: "sector", tags: ["sector", "thematic"], marCap: 11229, volume: 5457553, amount: 145430, price: 26515.0, nav: 26574.0 },
  { ticker: "453850", name: "ACE 미국30년국채액티브(H)", category: "bond", tags: ["bond", "usIndex"], marCap: 17891, volume: 2777, amount: 20, price: 7430.0, nav: 7435.0 },
  { ticker: "152100", name: "PLUS 200", category: "kospi", tags: ["kospi"], marCap: 15143, volume: 416228, amount: 42717, price: 101630.0, nav: 101344.0 },
  { ticker: "105190", name: "ACE 200", category: "kospi", tags: ["kospi"], marCap: 15829, volume: 274647, amount: 27883, price: 100500.0, nav: 100206.0 },
  { ticker: "475630", name: "TIGER CD1년금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 15851, volume: 23907, amount: 25469, price: 1065360.0, nav: 1065357.0 },
  { ticker: "472150", name: "TIGER 배당커버드콜액티브", category: "coveredCall", tags: ["coveredCall", "dividend"], marCap: 14020, volume: 2819073, amount: 57853, price: 20325.0, nav: 20276.0 },
  { ticker: "0167A0", name: "SOL AI반도체TOP2플러스", category: "sector", tags: ["sector", "thematic"], marCap: 9230, volume: 10523702, amount: 152572, price: 14310.0, nav: 14291.0 },
  { ticker: "441640", name: "KODEX 미국배당커버드콜액티브", category: "coveredCall", tags: ["coveredCall", "usIndex", "dividend"], marCap: 15544, volume: 1382661, amount: 17798, price: 12830.0, nav: 12882.0 },
  { ticker: "462330", name: "KODEX 2차전지산업레버리지", category: "leveraged", tags: ["leveraged", "sector"], marCap: 10186, volume: 47569141, amount: 127897, price: 2630.0, nav: 2652.0 },
  { ticker: "091230", name: "TIGER 반도체", category: "sector", tags: ["sector"], marCap: 11851, volume: 699949, amount: 91510, price: 129660.0, nav: 129220.0 },
  { ticker: "477080", name: "RISE CD금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 15916, volume: 11422, amount: 1216, price: 106475.0, nav: 106474.0 },
  { ticker: "305540", name: "TIGER 2차전지테마", category: "sector", tags: ["sector", "thematic"], marCap: 14285, volume: 1274265, amount: 34115, price: 26700.0, nav: 26563.0 },
  { ticker: "486290", name: "TIGER 미국나스닥100타겟데일리커버드콜", category: "coveredCall", tags: ["coveredCall", "usIndex"], marCap: 14883, volume: 1921198, amount: 21204, price: 10935.0, nav: 11004.0 },
  { ticker: "315930", name: "KODEX Top5PlusTR", category: "kospi", tags: ["kospi", "thematic"], marCap: 15047, volume: 59516, amount: 4272, price: 70975.0, nav: 70867.0 },
  { ticker: "379780", name: "RISE 미국S&P500", category: "usIndex", tags: ["usIndex"], marCap: 14181, volume: 580961, amount: 13329, price: 22835.0, nav: 22945.0 },
  { ticker: "445290", name: "KODEX 로봇액티브", category: "sector", tags: ["sector", "thematic"], marCap: 11402, volume: 1988151, amount: 71947, price: 35465.0, nav: 35320.0 },
  { ticker: "102970", name: "KODEX 증권", category: "sector", tags: ["sector"], marCap: 10779, volume: 3120164, amount: 84986, price: 26780.0, nav: 26784.0 },
  { ticker: "0072R0", name: "TIGER KRX금현물", category: "commodity", tags: ["commodity"], marCap: 14293, volume: 522, amount: 7, price: 14430.0, nav: 14504.0 },
  { ticker: "368590", name: "RISE 미국나스닥100", category: "usIndex", tags: ["usIndex"], marCap: 13824, volume: 232704, amount: 6966, price: 29665.0, nav: 29800.0 },
  { ticker: "364980", name: "TIGER 2차전지TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 9205, volume: 7139618, amount: 100654, price: 13990.0, nav: 13971.0 },
  { ticker: "371460", name: "TIGER 차이나전기차SOLACTIVE", category: "global", tags: ["global", "sector"], marCap: 13326, volume: 751388, amount: 10957, price: 14510.0, nav: 14590.0 },
  { ticker: "446770", name: "ACE 글로벌반도체TOP4 Plus", category: "global", tags: ["global", "sector"], marCap: 12681, volume: 279995, amount: 19575, price: 69295.0, nav: 69370.0 },
  { ticker: "0117L0", name: "KODEX 26-12 금융채(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 13539, volume: 21318, amount: 214, price: 10070.0, nav: 10069.0 },
  { ticker: "494670", name: "TIGER 조선TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 9041, volume: 2890739, amount: 94967, price: 32640.0, nav: 32718.0 },
  { ticker: "157450", name: "TIGER 단기통안채", category: "bond", tags: ["bond"], marCap: 13280, volume: 16670, amount: 1861, price: 111640.0, nav: 111640.0 },
  { ticker: "457480", name: "ACE 테슬라밸류체인액티브", category: "sector", tags: ["sector"], marCap: 12117, volume: 1080456, amount: 24860, price: 22840.0, nav: 23060.0 },
  { ticker: "144600", name: "KODEX 은선물(H)", category: "commodity", tags: ["commodity"], marCap: 11870, volume: 2365701, amount: 28147, price: 11930.0, nav: 12027.0 },
  { ticker: "448330", name: "KODEX 삼성전자채권혼합", category: "bond", tags: ["bond", "sector"], marCap: 11729, volume: 1795793, amount: 28968, price: 16045.0, nav: 16063.0 },
  { ticker: "455850", name: "SOL AI반도체소부장", category: "sector", tags: ["sector", "thematic"], marCap: 12620, volume: 133645, amount: 4169, price: 31200.0, nav: 31115.0 },
  { ticker: "465580", name: "ACE 미국빅테크TOP7 Plus", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 11291, volume: 1068665, amount: 26437, price: 24545.0, nav: 24573.0 },
  { ticker: "0148J0", name: "TIGER 코리아휴머노이드로봇산업", category: "sector", tags: ["sector", "thematic"], marCap: 6843, volume: 8995145, amount: 117795, price: 12755.0, nav: 12772.0 },
  { ticker: "436140", name: "SOL 종합채권(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 12391, volume: 5417, amount: 586, price: 108315.0, nav: 108289.0 },
  { ticker: "0101N0", name: "RISE AI전력인프라", category: "sector", tags: ["sector", "thematic"], marCap: 4604, volume: 6472104, amount: 160745, price: 25295.0, nav: 25194.0 },
  { ticker: "0139F0", name: "TIGER 12월자동연장금융채(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 11946, volume: 56, amount: 5, price: 101170.0, nav: 101170.0 },
  { ticker: "495050", name: "RISE 코리아밸류업", category: "kospi", tags: ["kospi", "thematic"], marCap: 8049, volume: 2635009, amount: 78835, price: 29645.0, nav: 29542.0 },
  { ticker: "469830", name: "SOL 초단기채권액티브", category: "bond", tags: ["bond"], marCap: 10840, volume: 300998, amount: 16191, price: 53795.0, nav: 53795.0 },
  { ticker: "390390", name: "KODEX 미국반도체", category: "usIndex", tags: ["usIndex", "sector"], marCap: 10400, volume: 499717, amount: 25465, price: 50240.0, nav: 50599.0 },
  { ticker: "494890", name: "KODEX 200액티브", category: "kospi", tags: ["kospi"], marCap: 11182, volume: 187167, amount: 5455, price: 28895.0, nav: 28825.0 },
  { ticker: "469150", name: "ACE AI반도체TOP3+", category: "sector", tags: ["sector", "thematic"], marCap: 7442, volume: 1393482, amount: 82761, price: 58600.0, nav: 58373.0 },
  { ticker: "356540", name: "ACE 종합채권(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 11312, volume: 5790, amount: 597, price: 103155.0, nav: 103199.0 },
  { ticker: "476550", name: "TIGER 미국30년국채커버드콜액티브(H)", category: "coveredCall", tags: ["coveredCall", "bond", "usIndex"], marCap: 10404, volume: 2024856, amount: 14639, price: 7230.0, nav: 7250.0 },
  { ticker: "226490", name: "KODEX 코스피", category: "kospi", tags: ["kospi"], marCap: 9765, volume: 380618, amount: 25955, price: 67810.0, nav: 67756.0 },
  { ticker: "451540", name: "TIGER 종합채권(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 10862, volume: 3660, amount: 197, price: 53940.0, nav: 53969.0 },
  { ticker: "434730", name: "HANARO 원자력iSelect", category: "sector", tags: ["sector", "thematic"], marCap: 10850, volume: 103, amount: 9, price: 87500.0, nav: 87715.0 },
  { ticker: "497570", name: "TIGER 미국필라델피아AI반도체나스닥", category: "usIndex", tags: ["usIndex", "sector"], marCap: 10135, volume: 666982, amount: 13746, price: 20210.0, nav: 20409.0 },
  { ticker: "0080G0", name: "KODEX 방산TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 5942, volume: 6688981, amount: 101180, price: 15120.0, nav: 15136.0 },
  { ticker: "367760", name: "RISE 네트워크인프라", category: "sector", tags: ["sector", "thematic"], marCap: 4393, volume: 2719332, amount: 133393, price: 48275.0, nav: 48256.0 },
  { ticker: "462010", name: "TIGER 2차전지소재Fn", category: "sector", tags: ["sector"], marCap: 8843, volume: 4998816, amount: 39037, price: 7710.0, nav: 7735.0 },
  { ticker: "466940", name: "TIGER 은행고배당플러스TOP10", category: "dividend", tags: ["dividend", "sector"], marCap: 10013, volume: 461847, amount: 12194, price: 26280.0, nav: 26369.0 },
  { ticker: "0177N0", name: "KODEX 삼성전자SK하이닉스채권혼합50", category: "bond", tags: ["bond", "sector"], marCap: 5573, volume: 8692012, amount: 105790, price: 12115.0, nav: 12097.0 },
  { ticker: "0163Y0", name: "KoAct 코스닥액티브", category: "kosdaq", tags: ["kosdaq"], marCap: 9217, volume: 2092367, amount: 27239, price: 12855.0, nav: 12888.0 },
  { ticker: "438080", name: "ACE 미국S&P500미국채혼합50액티브", category: "usIndex", tags: ["usIndex", "bond"], marCap: 10029, volume: 517714, amount: 7504, price: 14430.0, nav: 14440.0 },
  { ticker: "475720", name: "RISE 200위클리커버드콜", category: "coveredCall", tags: ["coveredCall", "kospi"], marCap: 9019, volume: 1788519, amount: 24798, price: 13790.0, nav: 13802.0 },
  { ticker: "463250", name: "TIGER K방산&우주", category: "sector", tags: ["sector", "thematic"], marCap: 9867, volume: 442, amount: 22, price: 50730.0, nav: 50822.0 },
  { ticker: "446720", name: "SOL 미국배당다우존스", category: "usIndex", tags: ["usIndex", "dividend"], marCap: 9488, volume: 588926, amount: 7987, price: 13535.0, nav: 13581.0 },
  { ticker: "479080", name: "1Q 머니마켓액티브", category: "bond", tags: ["bond"], marCap: 9454, volume: 68690, amount: 3652, price: 53180.0, nav: 53177.0 },
  { ticker: "441800", name: "TIME Korea플러스배당액티브", category: "dividend", tags: ["dividend"], marCap: 8800, volume: 505125, amount: 15581, price: 30555.0, nav: 30557.0 },
  { ticker: "479520", name: "RISE KOFR금리액티브(합성)", category: "bond", tags: ["bond"], marCap: 9477, volume: 4148, amount: 437, price: 105450.0, nav: 105447.0 },
  { ticker: "237350", name: "KODEX 코스피100", category: "kospi", tags: ["kospi"], marCap: 8392, volume: 288830, amount: 23006, price: 78795.0, nav: 78627.0 },
  { ticker: "444200", name: "SOL 코리아메가테크액티브", category: "sector", tags: ["sector", "thematic"], marCap: 7478, volume: 719754, amount: 36692, price: 50530.0, nav: 50378.0 },
  { ticker: "481060", name: "KODEX 미국30년국채타겟커버드콜(합성 H)", category: "coveredCall", tags: ["coveredCall", "bond", "usIndex"], marCap: 8677, volume: 1367351, amount: 10784, price: 7885.0, nav: 7911.0 },
  { ticker: "371160", name: "TIGER 차이나항셍테크", category: "global", tags: ["global", "sector"], marCap: 8718, volume: 1196601, amount: 9470, price: 7925.0, nav: 7963.0 },
  { ticker: "471990", name: "KODEX AI반도체핵심장비", category: "sector", tags: ["sector", "thematic"], marCap: 5628, volume: 2257599, amount: 72177, price: 31620.0, nav: 31649.0 },
  { ticker: "449180", name: "KODEX 미국S&P500(H)", category: "usIndex", tags: ["usIndex"], marCap: 8443, volume: 698693, amount: 11195, price: 15960.0, nav: 16010.0 },
  { ticker: "402970", name: "ACE 미국배당다우존스", category: "usIndex", tags: ["usIndex", "dividend"], marCap: 8481, volume: 377108, amount: 5674, price: 15010.0, nav: 15073.0 },
  { ticker: "251600", name: "PLUS 고배당주채권혼합", category: "dividend", tags: ["dividend", "bond"], marCap: 8086, volume: 594381, amount: 9526, price: 15980.0, nav: 15999.0 },
  { ticker: "385510", name: "KODEX 신재생에너지액티브", category: "sector", tags: ["sector", "thematic"], marCap: 5335, volume: 1128352, amount: 66843, price: 59280.0, nav: 59111.0 },
  { ticker: "069660", name: "KIWOOM 200", category: "kospi", tags: ["kospi"], marCap: 7788, volume: 119964, amount: 12072, price: 99840.0, nav: 99559.0 },
  { ticker: "0061Z0", name: "RISE 단기특수은행채액티브", category: "bond", tags: ["bond"], marCap: 8231, volume: 114, amount: 5, price: 50520.0, nav: 50520.0 },
  { ticker: "495850", name: "KODEX 코리아밸류업", category: "kospi", tags: ["kospi", "thematic"], marCap: 6977, volume: 884770, amount: 26296, price: 29500.0, nav: 29399.0 },
  { ticker: "153130", name: "KODEX 단기채권", category: "bond", tags: ["bond"], marCap: 7879, volume: 33272, amount: 3771, price: 113340.0, nav: 113346.0 },
  { ticker: "498410", name: "KODEX 금융고배당TOP10타겟위클리커버드콜", category: "coveredCall", tags: ["coveredCall", "dividend", "sector"], marCap: 7425, volume: 982317, amount: 12845, price: 13050.0, nav: 13069.0 },
  { ticker: "494300", name: "KODEX 미국나스닥100데일리커버드콜OTM", category: "coveredCall", tags: ["coveredCall", "usIndex"], marCap: 7938, volume: 113, amount: 1, price: 10010.0, nav: 10083.0 },
  { ticker: "487340", name: "ACE 머니마켓액티브", category: "bond", tags: ["bond"], marCap: 7819, volume: 7515, amount: 786, price: 104675.0, nav: 104670.0 },
  { ticker: "0183J0", name: "TIGER 미국우주테크", category: "usIndex", tags: ["usIndex", "sector", "thematic"], marCap: 4982, volume: 5848690, amount: 56941, price: 9600.0, nav: 9718.0 },
  { ticker: "458760", name: "TIGER 미국배당다우존스타겟커버드콜2호", category: "coveredCall", tags: ["coveredCall", "usIndex", "dividend"], marCap: 7296, volume: 666492, amount: 7435, price: 11130.0, nav: 11186.0 },
  { ticker: "138540", name: "TIGER 현대차그룹플러스", category: "sector", tags: ["sector"], marCap: 7632, volume: 930, amount: 57, price: 61745.0, nav: 61660.0 },
  { ticker: "471230", name: "KODEX 국고채10년액티브", category: "bond", tags: ["bond"], marCap: 7337, volume: 26395, amount: 2792, price: 105570.0, nav: 105592.0 },
  { ticker: "491010", name: "TIGER 글로벌AI전력인프라액티브", category: "global", tags: ["global", "sector", "thematic"], marCap: 6860, volume: 307988, amount: 9191, price: 29415.0, nav: 29495.0 },
  { ticker: "0115D0", name: "KODEX 조선TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 2296, volume: 8973512, amount: 104467, price: 11565.0, nav: 11585.0 },
  { ticker: "314250", name: "KODEX 미국빅테크10(H)", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 6914, volume: 110604, amount: 6103, price: 54740.0, nav: 54934.0 },
  { ticker: "438100", name: "ACE 미국나스닥100미국채혼합50액티브", category: "usIndex", tags: ["usIndex", "bond"], marCap: 6862, volume: 425679, amount: 6663, price: 15560.0, nav: 15557.0 },
  { ticker: "385560", name: "RISE KIS국고채30년Enhanced", category: "bond", tags: ["bond"], marCap: 7027, volume: 46978, amount: 2912, price: 61400.0, nav: 61406.0 },
  { ticker: "271050", name: "KODEX WTI원유선물인버스(H)", category: "leveraged", tags: ["leveraged", "commodity"], marCap: 1975, volume: 58841358, amount: 108056, price: 1809.0, nav: 1824.0 },
  { ticker: "423920", name: "TIGER 미국필라델피아반도체레버리지(합성)", category: "leveraged", tags: ["leveraged", "usIndex", "sector"], marCap: 6237, volume: 206097, amount: 17686, price: 83055.0, nav: 83902.0 },
  { ticker: "0167Z0", name: "KODEX 미국우주항공", category: "usIndex", tags: ["usIndex", "sector", "thematic"], marCap: 3800, volume: 6837282, amount: 68588, price: 9910.0, nav: 10025.0 },
  { ticker: "462900", name: "KoAct 바이오헬스케어액티브", category: "sector", tags: ["sector"], marCap: 5615, volume: 1320302, amount: 27711, price: 20720.0, nav: 20735.0 },
  { ticker: "0048J0", name: "KODEX 미국머니마켓액티브", category: "bond", tags: ["bond", "usIndex"], marCap: 6320, volume: 717320, amount: 10650, price: 14825.0, nav: 14836.0 },
  { ticker: "455030", name: "KODEX 미국달러SOFR금리액티브(합성)", category: "bond", tags: ["bond", "usIndex"], marCap: 6659, volume: 189686, amount: 2418, price: 12735.0, nav: 12740.0 },
  { ticker: "0105E0", name: "SOL 코리아고배당", category: "dividend", tags: ["dividend"], marCap: 6682, volume: 926, amount: 12, price: 13805.0, nav: 13771.0 },
  { ticker: "0025N0", name: "TIGER TDF2045 적격", category: "thematic", tags: ["thematic"], marCap: 6353, volume: 552731, amount: 6644, price: 11930.0, nav: 11987.0 },
  { ticker: "456610", name: "TIGER 미국달러SOFR금리액티브(합성)", category: "bond", tags: ["bond", "usIndex"], marCap: 6536, volume: 18915, amount: 1203, price: 63615.0, nav: 63565.0 },
  { ticker: "272580", name: "TIGER 단기채권액티브", category: "bond", tags: ["bond"], marCap: 6392, volume: 69725, amount: 3947, price: 56620.0, nav: 56615.0 },
  { ticker: "484790", name: "KODEX 미국30년국채액티브(H)", category: "bond", tags: ["bond", "usIndex"], marCap: 5902, volume: 1604585, amount: 13760, price: 8575.0, nav: 8579.0 },
  { ticker: "469070", name: "RISE AI&로봇", category: "sector", tags: ["sector", "thematic"], marCap: 5327, volume: 1550159, amount: 25129, price: 15900.0, nav: 15924.0 },
  { ticker: "0127P0", name: "ACE 미국대형성장주액티브", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 6467, volume: 67972, amount: 726, price: 10585.0, nav: 10611.0 },
  { ticker: "457990", name: "PLUS 태양광&ESS", category: "sector", tags: ["sector", "thematic"], marCap: 2200, volume: 1666407, amount: 88804, price: 52390.0, nav: 52493.0 },
  { ticker: "0131V0", name: "1Q 미국우주항공테크", category: "usIndex", tags: ["usIndex", "sector", "thematic"], marCap: 5729, volume: 1105063, amount: 13174, price: 11740.0, nav: 11871.0 },
  { ticker: "476800", name: "KODEX 한국부동산리츠인프라", category: "realEstate", tags: ["realEstate"], marCap: 5615, volume: 3184241, amount: 15290, price: 4855.0, nav: 4951.0 },
  { ticker: "438330", name: "TIGER 우량회사채액티브", category: "bond", tags: ["bond"], marCap: 6211, volume: 22468, amount: 2581, price: 114825.0, nav: 115009.0 },
  { ticker: "482730", name: "TIGER 미국S&P500타겟데일리커버드콜", category: "coveredCall", tags: ["coveredCall", "usIndex"], marCap: 5856, volume: 735719, amount: 8918, price: 12050.0, nav: 12155.0 },
  { ticker: "480260", name: "TIGER 27-04회사채(A+이상)액티브", category: "bond", tags: ["bond"], marCap: 6147, volume: 26205, amount: 1398, price: 53365.0, nav: 53405.0 },
  { ticker: "473290", name: "KODEX 26-12 회사채(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 6153, volume: 23291, amount: 251, price: 10802.0, nav: 10795.0 },
  { ticker: "447770", name: "TIGER 테슬라채권혼합Fn", category: "bond", tags: ["bond", "sector"], marCap: 5871, volume: 393067, amount: 5589, price: 14165.0, nav: 14228.0 },
  { ticker: "483280", name: "KODEX 미국AI테크TOP10타겟커버드콜", category: "coveredCall", tags: ["coveredCall", "usIndex", "thematic"], marCap: 5790, volume: 547704, amount: 7139, price: 12925.0, nav: 12963.0 },
  { ticker: "315960", name: "RISE 대형고배당10TR", category: "dividend", tags: ["dividend"], marCap: 5565, volume: 155961, amount: 10836, price: 68700.0, nav: 68457.0 },
  { ticker: "449190", name: "KODEX 미국나스닥100(H)", category: "usIndex", tags: ["usIndex"], marCap: 5461, volume: 623265, amount: 12897, price: 20530.0, nav: 20594.0 },
  { ticker: "458250", name: "TIGER 미국30년국채스트립액티브(합성 H)", category: "bond", tags: ["bond", "usIndex"], marCap: 5484, volume: 329895, amount: 12056, price: 36520.0, nav: 36552.0 },
  { ticker: "434060", name: "KODEX TDF2050액티브 적격", category: "thematic", tags: ["thematic"], marCap: 5666, volume: 294151, amount: 5219, price: 17705.0, nav: 17623.0 },
  { ticker: "114260", name: "KODEX 국고채3년", category: "bond", tags: ["bond"], marCap: 5707, volume: 53106, amount: 3261, price: 61370.0, nav: 61433.0 },
  { ticker: "490590", name: "RISE 미국AI밸류체인데일리고정커버드콜", category: "coveredCall", tags: ["coveredCall", "usIndex", "thematic"], marCap: 5332, volume: 732766, amount: 10906, price: 14710.0, nav: 14726.0 },
  { ticker: "329750", name: "TIGER 미국달러단기채권액티브", category: "bond", tags: ["bond", "usIndex"], marCap: 5453, volume: 373227, amount: 5190, price: 13900.0, nav: 13888.0 },
  { ticker: "270810", name: "RISE 코스닥150", category: "kosdaq", tags: ["kosdaq"], marCap: 5109, volume: 567762, amount: 11315, price: 19740.0, nav: 19774.0 },
  { ticker: "0007F0", name: "KODEX 27-12 회사채(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 5584, volume: 29236, amount: 295, price: 10095.0, nav: 10110.0 },
  { ticker: "157500", name: "TIGER 증권", category: "sector", tags: ["sector"], marCap: 4346, volume: 1372913, amount: 25793, price: 18495.0, nav: 18496.0 },
  { ticker: "091180", name: "KODEX 자동차", category: "sector", tags: ["sector"], marCap: 5548, volume: 138, amount: 4, price: 32165.0, nav: 32041.0 },
  { ticker: "433500", name: "ACE 원자력TOP10", category: "sector", tags: ["sector", "thematic"], marCap: 4528, volume: 242823, amount: 21280, price: 87075.0, nav: 87125.0 },
  { ticker: "295040", name: "SOL 200TR", category: "kospi", tags: ["kospi"], marCap: 5116, volume: 207517, amount: 7833, price: 37480.0, nav: 37341.0 },
  { ticker: "474220", name: "TIGER 미국테크TOP10타겟커버드콜", category: "coveredCall", tags: ["coveredCall", "usIndex", "thematic"], marCap: 5168, volume: 404811, amount: 6603, price: 16175.0, nav: 16196.0 },
  { ticker: "293180", name: "HANARO 200", category: "kospi", tags: ["kospi"], marCap: 5270, volume: 39677, amount: 4005, price: 100380.0, nav: 99986.0 },
  { ticker: "451000", name: "PLUS 종합채권(AA-이상)액티브", category: "bond", tags: ["bond"], marCap: 5424, volume: 59, amount: 6, price: 109550.0, nav: 109490.0 },
  { ticker: "442580", name: "PLUS 글로벌HBM반도체", category: "global", tags: ["global", "sector"], marCap: 4557, volume: 235286, amount: 17783, price: 74580.0, nav: 75209.0 },
  { ticker: "0015B0", name: "KoAct 미국나스닥성장기업액티브", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 4288, volume: 1145769, amount: 23099, price: 19850.0, nav: 19839.0 },
  { ticker: "0162Y0", name: "TIME 코스닥액티브", category: "kosdaq", tags: ["kosdaq"], marCap: 4908, volume: 888315, amount: 9742, price: 10810.0, nav: 10876.0 },
  { ticker: "0023A0", name: "SOL 미국양자컴퓨팅TOP10", category: "usIndex", tags: ["usIndex", "thematic"], marCap: 4593, volume: 588118, amount: 16187, price: 27100.0, nav: 27374.0 },
  { ticker: "496080", name: "TIGER 코리아밸류업", category: "kospi", tags: ["kospi", "thematic"], marCap: 4435, volume: 639768, amount: 19043, price: 29470.0, nav: 29429.0 },
  { ticker: "489250", name: "KODEX 미국배당다우존스", category: "usIndex", tags: ["usIndex", "dividend"], marCap: 5205, volume: 13, amount: 0, price: 12725.0, nav: 12769.0 },
  { ticker: "251350", name: "KODEX MSCI선진국", category: "global", tags: ["global"], marCap: 5087, volume: 55269, amount: 2160, price: 38980.0, nav: 39019.0 },
  { ticker: "091170", name: "KODEX 은행", category: "sector", tags: ["sector"], marCap: 4657, volume: 705910, amount: 11230, price: 15840.0, nav: 15892.0 },
  { ticker: "0177R0", name: "TIGER 반도체TOP10커버드콜액티브", category: "coveredCall", tags: ["coveredCall", "sector"], marCap: 2499, volume: 4862598, amount: 56341, price: 11465.0, nav: 11429.0 },
  { ticker: "412570", name: "TIGER 2차전지TOP10레버리지", category: "leveraged", tags: ["leveraged", "sector"], marCap: 2828, volume: 17043464, amount: 48715, price: 2785.0, nav: 2794.0 },
  { ticker: "361580", name: "RISE 200TR", category: "kospi", tags: ["kospi"], marCap: 4836, volume: 96644, amount: 5547, price: 56895.0, nav: 56683.0 },
  { ticker: "307520", name: "TIGER 지주회사", category: "sector", tags: ["sector"], marCap: 4335, volume: 638603, amount: 15818, price: 24560.0, nav: 24685.0 },
  { ticker: "365780", name: "ACE 국고채10년", category: "bond", tags: ["bond"], marCap: 5002, volume: 14012, amount: 1175, price: 83725.0, nav: 83811.0 },
  { ticker: "448290", name: "TIGER 미국S&P500(H)", category: "usIndex", tags: ["usIndex"], marCap: 4866, volume: 205247, amount: 3413, price: 16550.0, nav: 16615.0 },
  { ticker: "0167B0", name: "SOL 200타겟위클리커버드콜", category: "coveredCall", tags: ["coveredCall", "kospi"], marCap: 3916, volume: 1996734, amount: 23466, price: 11655.0, nav: 11623.0 },
  { ticker: "499660", name: "TIGER CD금리플러스액티브(합성)", category: "bond", tags: ["bond"], marCap: 4457, volume: 10733, amount: 10738, price: 1000480.0, nav: 1000477.0 },
  { ticker: "277630", name: "TIGER 코스피", category: "kospi", tags: ["kospi"], marCap: 4606, volume: 94327, amount: 6543, price: 68745.0, nav: 68730.0 },
  { ticker: "0052D0", name: "TIGER 코리아배당다우존스", category: "dividend", tags: ["dividend", "kospi"], marCap: 4733, volume: 219728, amount: 3638, price: 16520.0, nav: 16559.0 },
  { ticker: "0098F0", name: "KODEX 원자력SMR", category: "sector", tags: ["sector", "thematic"], marCap: 4762, volume: 854, amount: 20, price: 23400.0, nav: 23452.0 },
  { ticker: "123320", name: "TIGER 레버리지", category: "leveraged", tags: ["leveraged", "kospi"], marCap: 3228, volume: 274416, amount: 32264, price: 115280.0, nav: 115282.0 },
  { ticker: "148070", name: "KIWOOM 국고채10년", category: "bond", tags: ["bond"], marCap: 4519, volume: 29799, amount: 3170, price: 106155.0, nav: 106226.0 },
  { ticker: "484880", name: "SOL 금융지주플러스고배당", category: "dividend", tags: ["dividend", "sector"], marCap: 4087, volume: 521255, amount: 11711, price: 22335.0, nav: 22410.0 },
  { ticker: "139230", name: "TIGER 200 중공업", category: "sector", tags: ["sector", "kospi"], marCap: 4022, volume: 648311, amount: 12985, price: 20010.0, nav: 19978.0 },
];

export const KR_ALL_TICKERS = KR_ETF_CATALOG.map((e) => e.ticker);

export function krGroupByCategory(): Map<KrEtfCategory, KrEtfMeta[]> {
  const map = new Map<KrEtfCategory, KrEtfMeta[]>();
  for (const cat of KR_CATEGORY_ORDER) map.set(cat, []);
  for (const etf of KR_ETF_CATALOG) {
    const arr = map.get(etf.category) ?? [];
    arr.push(etf);
    map.set(etf.category, arr);
  }
  for (const cat of KR_CATEGORY_ORDER) {
    const arr = map.get(cat)!;
    arr.sort((a, b) => b.marCap - a.marCap);
  }
  return map;
}

export function krFindByTicker(ticker: string): KrEtfMeta | undefined {
  return KR_ETF_CATALOG.find((e) => e.ticker === ticker);
}