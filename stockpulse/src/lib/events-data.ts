/**
 * 이벤트 데이터
 *
 * 각 이벤트는 "그날 무슨 일이 있었는지"와 "그게 왜 주가와 관계있는지"를 함께 담는다.
 * explainer는 금융 용어를 모르는 사람도 읽고 이해할 수 있는 수준으로 쓴다.
 * 실 데이터 연결 시 이 구조를 DB(news_articles + market_events)에서 채운다.
 */

export type EventType =
  | '정책·규제'
  | '애널리스트 의견'
  | '수주·계약'
  | '사고·소송'
  | '실적 발표'
  | '금리·거시'
  | '신제품·기술'
  | '지분·인수합병';

export interface StockEvent {
  id: string;
  /** 오늘로부터 며칠 전(영업일 기준 인덱스) */
  daysAgo: number;
  /** 보도 시각 */
  time: string;
  headline: string;
  type: EventType;
  /** 당일 등락률 (%) */
  dayChange: number;
  /** 1주 후 누적 등락률 (%) */
  week1Change: number;
  /** 보도한 매체 수 — 중요도 가중에 사용 */
  sources: number;
  /** "이게 왜 주가에 영향을 주나요" 해설 */
  explainer: string;
  articles: { source: string }[];
}

export const STOCK_EVENTS: StockEvent[] = [
  {
    id: 'e1',
    daysAgo: 0,
    time: '08:40',
    headline: '미 반도체 관세 확대 검토 보도',
    type: '정책·규제',
    dayChange: -2.7,
    week1Change: -1.1,
    sources: 22,
    explainer:
      '관세는 제품을 미국에 팔 때 붙는 세금입니다. 세금이 늘면 같은 물건을 팔아도 회사에 남는 돈이 줄어들 수 있어, 시장은 미래 이익을 미리 깎아서 계산합니다. 아직 "검토" 단계라는 점이 중요합니다 — 확정 발표 때 한 번 더 크게 움직이는 경우가 많습니다.',
    articles: [{ source: '연합뉴스' }, { source: 'Reuters' }, { source: '한국경제' }],
  },
  {
    id: 'e2',
    daysAgo: 2,
    time: '07:15',
    headline: '2분기 HBM 점유율 반등 추정 — 목표주가 상향',
    type: '애널리스트 의견',
    dayChange: 1.4,
    week1Change: 2.0,
    sources: 9,
    explainer:
      '증권사가 "이 회사 주식은 이 정도 값은 한다"고 계산한 숫자가 목표주가입니다. 이것이 올라가면 기존에 보던 사람들의 기대치도 함께 올라갑니다. 다만 실제 실적이 아니라 전망이 바뀐 것이므로, 반응은 보통 하루 안에 소화됩니다.',
    articles: [{ source: '미래에셋증권' }, { source: 'Bloomberg' }],
  },
  {
    id: 'e3',
    daysAgo: 5,
    time: '09:02',
    headline: 'HBM4 대형 공급 계약 체결 — 3년 물량',
    type: '수주·계약',
    dayChange: 4.1,
    week1Change: 6.4,
    sources: 31,
    explainer:
      '수주는 "앞으로 이만큼 팔기로 약속했다"는 뜻입니다. 매출이 아직 들어오지는 않았지만 앞으로 들어올 것이 거의 확정되므로, 시장은 이를 가장 확실한 좋은 소식으로 취급합니다. 3년처럼 기간이 긴 계약은 반응이 하루로 끝나지 않고 며칠에 걸쳐 이어지는 편입니다.',
    articles: [{ source: '전자신문' }, { source: 'Reuters' }, { source: 'Nikkei' }],
  },
  {
    id: 'e4',
    daysAgo: 9,
    time: '14:20',
    headline: '평택 신규 라인 가동 지연 확인',
    type: '사고·소송',
    dayChange: -1.9,
    week1Change: -2.6,
    sources: 12,
    explainer:
      '공장이 늦게 돌아가면 팔 수 있는 물량이 계획보다 줄어듭니다. 반도체는 값이 좋을 때 많이 파는 것이 중요해서, 시기를 놓치는 것 자체가 손실로 계산됩니다.',
    articles: [{ source: '매일경제' }, { source: '디지털타임스' }],
  },
  {
    id: 'e5',
    daysAgo: 13,
    time: '08:00',
    headline: '2분기 실적 발표 — 영업이익 컨센서스 상회',
    type: '실적 발표',
    dayChange: 3.2,
    week1Change: 4.4,
    sources: 47,
    explainer:
      '컨센서스는 증권사들이 예상한 평균 성적표입니다. 실적이 이 예상보다 좋으면 "이만큼 잘할 줄 몰랐다"는 부분만큼 주가가 새로 반영됩니다. 그래서 실적이 좋아도 예상보다 나쁘면 주가는 떨어질 수 있습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '연합뉴스' }, { source: 'WSJ' }],
  },
  {
    id: 'e6',
    daysAgo: 18,
    time: '06:30',
    headline: '미 금리 인하 기대 후퇴 — 기술주 전반 약세',
    type: '금리·거시',
    dayChange: -1.5,
    week1Change: -0.4,
    sources: 18,
    explainer:
      '금리가 높게 유지되면 안전한 예금 이자가 좋아지므로, 위험을 감수하는 주식의 매력이 상대적으로 줄어듭니다. 이 유형은 특정 회사의 문제가 아니라 시장 전체가 같이 움직이므로, 이 종목만의 뉴스와 구분해서 볼 필요가 있습니다.',
    articles: [{ source: 'Bloomberg' }, { source: '한국경제' }],
  },
  {
    id: 'e7',
    daysAgo: 26,
    time: '10:45',
    headline: '2나노 파운드리 수율 개선 발표',
    type: '신제품·기술',
    dayChange: 2.1,
    week1Change: 1.2,
    sources: 15,
    explainer:
      '수율은 만든 것 중 제대로 된 제품의 비율입니다. 이 비율이 오르면 같은 비용으로 더 많이 팔 수 있으니 이익률이 좋아집니다. 다만 발표만으로는 확인이 어려워, 실적으로 증명될 때까지 반응이 제한되는 경우가 많습니다.',
    articles: [{ source: '전자신문' }, { source: 'TrendForce' }],
  },
  {
    id: 'e8',
    daysAgo: 34,
    time: '16:10',
    headline: '자사주 매입 계획 발표 — 3조원 규모',
    type: '지분·인수합병',
    dayChange: 2.8,
    week1Change: 3.1,
    sources: 26,
    explainer:
      '회사가 자기 주식을 사들이면 시장에 남는 주식 수가 줄어듭니다. 같은 이익을 더 적은 주식이 나눠 갖게 되므로 주당 가치가 올라갑니다. 회사가 "지금 주가가 싸다"고 판단했다는 신호로도 읽힙니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '서울경제' }],
  },
  {
    id: 'e9',
    daysAgo: 48,
    time: '08:00',
    headline: '1분기 실적 발표 — 컨센서스 하회',
    type: '실적 발표',
    dayChange: -3.4,
    week1Change: -5.0,
    sources: 44,
    explainer:
      '예상보다 못한 성적표가 나오면, 시장은 다음 분기 기대치까지 함께 낮춥니다. 그래서 실적 발표일 하루보다 그 뒤 1~2주의 흐름이 더 나쁠 때가 있습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: 'Reuters' }],
  },
  {
    id: 'e10',
    daysAgo: 61,
    time: '11:30',
    headline: '대형 고객사 품질 인증 통과 보도',
    type: '수주·계약',
    dayChange: 3.6,
    week1Change: 2.2,
    sources: 20,
    explainer:
      '인증 통과는 "이제 이 회사에 납품할 자격이 생겼다"는 의미입니다. 계약 자체는 아니지만 계약의 문이 열린 것이어서, 수주 기대가 주가에 먼저 반영됩니다.',
    articles: [{ source: '전자신문' }, { source: 'Bloomberg' }],
  },
  {
    id: 'e11',
    daysAgo: 96,
    time: '09:20',
    headline: '메모리 현물 가격 반등 지표 확인',
    type: '금리·거시',
    dayChange: 1.8,
    week1Change: 2.7,
    sources: 14,
    explainer:
      '반도체는 시장 가격이 실적을 거의 그대로 결정합니다. 가격이 오르기 시작하면 아직 실적에 반영되지 않아도 주가가 먼저 반응합니다.',
    articles: [{ source: 'TrendForce' }, { source: '한국경제' }],
  },
  {
    id: 'e12',
    daysAgo: 131,
    time: '13:05',
    headline: '공정거래위 조사 착수 보도',
    type: '사고·소송',
    dayChange: -4.2,
    week1Change: -3.3,
    sources: 29,
    explainer:
      '조사는 결과가 나올 때까지 시간이 걸리고, 그 사이 얼마의 과징금이 나올지 아무도 모릅니다. 시장은 이런 불확실성 자체를 위험으로 계산해 값을 깎습니다.',
    articles: [{ source: '연합뉴스' }, { source: '조선비즈' }],
  },
  {
    id: 'e13',
    daysAgo: 168,
    time: '16:00',
    headline: '연간 배당 정책 상향 발표',
    type: '지분·인수합병',
    dayChange: 1.6,
    week1Change: 1.9,
    sources: 17,
    explainer:
      '배당은 회사가 주주에게 나눠주는 현금입니다. 배당이 늘면 주식을 오래 들고 있을 이유가 커지므로, 장기 투자자 쪽 수요가 붙습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '매일경제' }],
  },
  {
    id: 'e14',
    daysAgo: 205,
    time: '22:40',
    headline: 'AI 가속기 공동개발 파트너십 발표',
    type: '신제품·기술',
    dayChange: 5.3,
    week1Change: 3.8,
    sources: 38,
    explainer:
      '새로운 시장에 들어갈 통로가 생기면, 시장은 아직 존재하지 않는 미래 매출까지 미리 값에 넣습니다. 그래서 이런 뉴스는 반응이 가장 크고, 동시에 되돌림도 큽니다.',
    articles: [{ source: 'Reuters' }, { source: '전자신문' }, { source: 'The Verge' }],
  },
];

/** 기간 옵션 — n은 영업일 수 */
export const PERIODS = [
  { key: '1M' as const, days: 22 },
  { key: '3M' as const, days: 64 },
  { key: '1Y' as const, days: 250 },
];

export type PeriodKey = (typeof PERIODS)[number]['key'];

/** 오늘, 뉴스로 설명되는 움직임 (중요도 상위) */
export interface TodayMove {
  name: string;
  ticker: string;
  cause: string;
  changeRate: number;
}

export const TODAY_MOVES: TodayMove[] = [
  { name: 'SK하이닉스', ticker: '000660', cause: 'HBM 증설 계획 발표', changeRate: 5.2 },
  { name: '한화에어로스페이스', ticker: '012450', cause: '유럽 대규모 수출 계약 보도', changeRate: 4.8 },
  { name: '삼성전자', ticker: '005930', cause: '미 반도체 관세 확대 검토', changeRate: -2.7 },
  { name: '에코프로비엠', ticker: '247540', cause: '미 보조금 축소 검토 보도', changeRate: -6.1 },
  { name: 'NVDA', ticker: 'NVDA', cause: '데이터센터 매출 가이던스 상향', changeRate: 3.4 },
];

/** 종목 메타 — 실 데이터 연결 시 stocks 테이블에서 조회 */
export const STOCK_META: Record<string, { name: string; ticker: string; market: string }> = {
  '005930': { name: '삼성전자', ticker: '005930', market: 'KOSPI' },
  '000660': { name: 'SK하이닉스', ticker: '000660', market: 'KOSPI' },
  '035720': { name: '카카오', ticker: '035720', market: 'KOSPI' },
  '035420': { name: 'NAVER', ticker: '035420', market: 'KOSPI' },
  '247540': { name: '에코프로비엠', ticker: '247540', market: 'KOSDAQ' },
  '012450': { name: '한화에어로스페이스', ticker: '012450', market: 'KOSPI' },
};
