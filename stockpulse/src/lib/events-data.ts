/**
 * 이벤트 데이터 (예시)
 *
 * ⚠️ 주가는 실제 데이터지만, 아래 뉴스는 아직 **예시**다.
 *    뉴스 수집(네이버 뉴스 API)이 붙기 전까지 화면 구조를 보여주기 위한 자리표시자다.
 *    실 데이터 연결 시 news_articles + news_stock_mappings 에서 채운다.
 *
 * 등락률을 여기에 적지 않는 이유:
 *   하드코딩하면 실제 주가 차트와 어긋난다. 핀이 +4.1%라고 표시하는데
 *   차트는 그 지점에서 하락하는 모순이 생긴다.
 *   그래서 dayChange/week1Change 는 price-data 에서 파생시킨다.
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
  /** 이 이벤트가 속한 종목 */
  ticker: string;
  /** 최신 거래일로부터 며칠 전(거래일 기준) */
  daysAgo: number;
  time: string;
  headline: string;
  type: EventType;
  /** 보도한 매체 수 — 중요도 가중에 사용 */
  sources: number;
  /** "이게 왜 주가에 영향을 주나요" 해설 */
  explainer: string;
  articles: { source: string }[];
}

/**
 * 예시 이벤트는 삼성전자에만 붙여 둔다.
 * 다른 종목에 삼성전자 뉴스(HBM·평택 등)를 그대로 노출하면 내용이 맞지 않으므로,
 * 뉴스 수집이 붙을 때까지 해당 종목은 빈 상태로 둔다.
 */
export const STOCK_EVENTS: StockEvent[] = [
  {
    id: 'e1',
    ticker: '005930',
    daysAgo: 0,
    time: '08:40',
    headline: '미 반도체 관세 확대 검토 보도',
    type: '정책·규제',
    sources: 22,
    explainer:
      '관세는 제품을 미국에 팔 때 붙는 세금입니다. 세금이 늘면 같은 물건을 팔아도 회사에 남는 돈이 줄어들 수 있어, 시장은 미래 이익을 미리 깎아서 계산합니다. 아직 "검토" 단계라는 점이 중요합니다 — 확정 발표 때 한 번 더 크게 움직이는 경우가 많습니다.',
    articles: [{ source: '연합뉴스' }, { source: 'Reuters' }, { source: '한국경제' }],
  },
  {
    id: 'e2',
    ticker: '005930',
    daysAgo: 2,
    time: '07:15',
    headline: '2분기 HBM 점유율 반등 추정 — 목표주가 상향',
    type: '애널리스트 의견',
    sources: 9,
    explainer:
      '증권사가 "이 회사 주식은 이 정도 값은 한다"고 계산한 숫자가 목표주가입니다. 이것이 올라가면 기존에 보던 사람들의 기대치도 함께 올라갑니다. 다만 실제 실적이 아니라 전망이 바뀐 것이므로, 반응은 보통 하루 안에 소화됩니다.',
    articles: [{ source: '미래에셋증권' }, { source: 'Bloomberg' }],
  },
  {
    id: 'e3',
    ticker: '005930',
    daysAgo: 5,
    time: '09:02',
    headline: 'HBM4 대형 공급 계약 체결 — 3년 물량',
    type: '수주·계약',
    sources: 31,
    explainer:
      '수주는 "앞으로 이만큼 팔기로 약속했다"는 뜻입니다. 매출이 아직 들어오지는 않았지만 앞으로 들어올 것이 거의 확정되므로, 시장은 이를 가장 확실한 좋은 소식으로 취급합니다. 3년처럼 기간이 긴 계약은 반응이 하루로 끝나지 않고 며칠에 걸쳐 이어지는 편입니다.',
    articles: [{ source: '전자신문' }, { source: 'Reuters' }, { source: 'Nikkei' }],
  },
  {
    id: 'e4',
    ticker: '005930',
    daysAgo: 9,
    time: '14:20',
    headline: '평택 신규 라인 가동 지연 확인',
    type: '사고·소송',
    sources: 12,
    explainer:
      '공장이 늦게 돌아가면 팔 수 있는 물량이 계획보다 줄어듭니다. 반도체는 값이 좋을 때 많이 파는 것이 중요해서, 시기를 놓치는 것 자체가 손실로 계산됩니다.',
    articles: [{ source: '매일경제' }, { source: '디지털타임스' }],
  },
  {
    id: 'e5',
    ticker: '005930',
    daysAgo: 13,
    time: '08:00',
    headline: '2분기 실적 발표 — 영업이익 컨센서스 상회',
    type: '실적 발표',
    sources: 47,
    explainer:
      '컨센서스는 증권사들이 예상한 평균 성적표입니다. 실적이 이 예상보다 좋으면 "이만큼 잘할 줄 몰랐다"는 부분만큼 주가가 새로 반영됩니다. 그래서 실적이 좋아도 예상보다 나쁘면 주가는 떨어질 수 있습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '연합뉴스' }, { source: 'WSJ' }],
  },
  {
    id: 'e6',
    ticker: '005930',
    daysAgo: 18,
    time: '06:30',
    headline: '미 금리 인하 기대 후퇴 — 기술주 전반 약세',
    type: '금리·거시',
    sources: 18,
    explainer:
      '금리가 높게 유지되면 안전한 예금 이자가 좋아지므로, 위험을 감수하는 주식의 매력이 상대적으로 줄어듭니다. 이 유형은 특정 회사의 문제가 아니라 시장 전체가 같이 움직이므로, 이 종목만의 뉴스와 구분해서 볼 필요가 있습니다.',
    articles: [{ source: 'Bloomberg' }, { source: '한국경제' }],
  },
  {
    id: 'e7',
    ticker: '005930',
    daysAgo: 26,
    time: '10:45',
    headline: '2나노 파운드리 수율 개선 발표',
    type: '신제품·기술',
    sources: 15,
    explainer:
      '수율은 만든 것 중 제대로 된 제품의 비율입니다. 이 비율이 오르면 같은 비용으로 더 많이 팔 수 있으니 이익률이 좋아집니다. 다만 발표만으로는 확인이 어려워, 실적으로 증명될 때까지 반응이 제한되는 경우가 많습니다.',
    articles: [{ source: '전자신문' }, { source: 'TrendForce' }],
  },
  {
    id: 'e8',
    ticker: '005930',
    daysAgo: 34,
    time: '16:10',
    headline: '자사주 매입 계획 발표 — 3조원 규모',
    type: '지분·인수합병',
    sources: 26,
    explainer:
      '회사가 자기 주식을 사들이면 시장에 남는 주식 수가 줄어듭니다. 같은 이익을 더 적은 주식이 나눠 갖게 되므로 주당 가치가 올라갑니다. 회사가 "지금 주가가 싸다"고 판단했다는 신호로도 읽힙니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '서울경제' }],
  },
  {
    id: 'e9',
    ticker: '005930',
    daysAgo: 48,
    time: '08:00',
    headline: '1분기 실적 발표 — 컨센서스 하회',
    type: '실적 발표',
    sources: 44,
    explainer:
      '예상보다 못한 성적표가 나오면, 시장은 다음 분기 기대치까지 함께 낮춥니다. 그래서 실적 발표일 하루보다 그 뒤 1~2주의 흐름이 더 나쁠 때가 있습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: 'Reuters' }],
  },
  {
    id: 'e10',
    ticker: '005930',
    daysAgo: 61,
    time: '11:30',
    headline: '대형 고객사 품질 인증 통과 보도',
    type: '수주·계약',
    sources: 20,
    explainer:
      '인증 통과는 "이제 이 회사에 납품할 자격이 생겼다"는 의미입니다. 계약 자체는 아니지만 계약의 문이 열린 것이어서, 수주 기대가 주가에 먼저 반영됩니다.',
    articles: [{ source: '전자신문' }, { source: 'Bloomberg' }],
  },
  {
    id: 'e11',
    ticker: '005930',
    daysAgo: 96,
    time: '09:20',
    headline: '메모리 현물 가격 반등 지표 확인',
    type: '금리·거시',
    sources: 14,
    explainer:
      '반도체는 시장 가격이 실적을 거의 그대로 결정합니다. 가격이 오르기 시작하면 아직 실적에 반영되지 않아도 주가가 먼저 반응합니다.',
    articles: [{ source: 'TrendForce' }, { source: '한국경제' }],
  },
  {
    id: 'e12',
    ticker: '005930',
    daysAgo: 131,
    time: '13:05',
    headline: '공정거래위 조사 착수 보도',
    type: '사고·소송',
    sources: 29,
    explainer:
      '조사는 결과가 나올 때까지 시간이 걸리고, 그 사이 얼마의 과징금이 나올지 아무도 모릅니다. 시장은 이런 불확실성 자체를 위험으로 계산해 값을 깎습니다.',
    articles: [{ source: '연합뉴스' }, { source: '조선비즈' }],
  },
  {
    id: 'e13',
    ticker: '005930',
    daysAgo: 168,
    time: '16:00',
    headline: '연간 배당 정책 상향 발표',
    type: '지분·인수합병',
    sources: 17,
    explainer:
      '배당은 회사가 주주에게 나눠주는 현금입니다. 배당이 늘면 주식을 오래 들고 있을 이유가 커지므로, 장기 투자자 쪽 수요가 붙습니다.',
    articles: [{ source: '삼성전자 IR' }, { source: '매일경제' }],
  },
  {
    id: 'e14',
    ticker: '005930',
    daysAgo: 205,
    time: '22:40',
    headline: 'AI 가속기 공동개발 파트너십 발표',
    type: '신제품·기술',
    sources: 38,
    explainer:
      '새로운 시장에 들어갈 통로가 생기면, 시장은 아직 존재하지 않는 미래 매출까지 미리 값에 넣습니다. 그래서 이런 뉴스는 반응이 가장 크고, 동시에 되돌림도 큽니다.',
    articles: [{ source: 'Reuters' }, { source: 'The Verge' }, { source: '전자신문' }],
  },
];

/** 해당 종목의 예시 이벤트 */
export function eventsFor(ticker: string): StockEvent[] {
  return STOCK_EVENTS.filter(e => e.ticker === ticker);
}

/**
 * 기간 옵션
 *
 * days는 거래일 수다. 달력일이 아니라 거래일이라 1개월이 22일이다.
 * label은 한글로 둔다 — '1M'은 무슨 뜻인지 바로 읽히지 않는다.
 * '전체'는 보유한 데이터를 모두 쓰도록 큰 값을 두고 호출부에서 clamp한다.
 *
 * resolution: 캔들 1개가 나타내는 시간 폭. 기간이 길어질수록 해상도를 낮춰
 * 캔들 수를 화면에 맞는 범위(50~150개)로 유지한다.
 * 'day'는 원본 그대로, 'week'와 'month'는 일봉을 집계해 만든다.
 */
export const PERIODS = [
  { key: '1W' as const, label: '1주', days: 5, resolution: 'day' as const },
  { key: '1M' as const, label: '1개월', days: 22, resolution: 'day' as const },
  { key: '3M' as const, label: '3개월', days: 64, resolution: 'day' as const },
  { key: '6M' as const, label: '6개월', days: 125, resolution: 'day' as const },
  { key: '1Y' as const, label: '1년', days: 250, resolution: 'week' as const },
  { key: 'ALL' as const, label: '전체', days: 99999, resolution: 'week' as const },
];

export type PeriodKey = (typeof PERIODS)[number]['key'];
export type Resolution = 'day' | 'week' | 'month';
