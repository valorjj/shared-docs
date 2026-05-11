import { useNavigate } from 'react-router-dom'
import FloatingToc, { type TocItem } from '../components/FloatingToc'
import './Stock.css'

const tocItems: TocItem[] = [
  { id: 'sec-why', label: '왜 장기투자인가', emoji: '📊' },
  { id: 'sec-base', label: '시작 전 토대', emoji: '🧱' },
  { id: 'sec-accounts', label: '절세 계좌 인프라', emoji: '🏦' },
  { id: 'sec-assets', label: '자산 선택 (ETF)', emoji: '🌍' },
  { id: 'sec-dca', label: '적립식 자동매수', emoji: '🔁' },
  { id: 'sec-rebal', label: '리밸런싱', emoji: '⚖️' },
  { id: 'sec-rules', label: '부부 가드레일', emoji: '🛡️' },
  { id: 'sec-filter', label: '정보 거르기', emoji: '🕵️' },
  { id: 'sec-stockpick', label: '개별 종목 분석', emoji: '🔍' },
  { id: 'sec-case', label: 'LS일렉트릭 사례', emoji: '📉' },
  { id: 'sec-checklist', label: '체크리스트', emoji: '✅' },
  { id: 'sec-resources', label: '사이트 · 용어', emoji: '📚' },
]

export default function Stock() {
  const navigate = useNavigate()

  return (
    <div className="stock">
      <FloatingToc items={tocItems} />

      <button className="back-btn" onClick={() => navigate('/')}>
        ← 홈으로
      </button>

      {/* ══ HERO ══ */}
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-label">신혼부부 장기 투자 시스템 · 2026</div>
          <h1>
            안 파는 능력 + 절세 + 분산<br />
            <em>그게 우리 부부의 알파다</em>
          </h1>
          <p className="hero-sub">
            95%의 자산은 인덱스로 자동화. 5%만 개별 종목.<br />
            한 번 셋업하면 매월 5분 이상 신경 쓸 일 없는 시스템.
          </p>
          <div className="hero-tags">
            <span className="hero-tag">DCA 적립식</span>
            <span className="hero-tag">부부 절세 합산</span>
            <span className="hero-tag">S&P 500 TR</span>
            <span className="hero-tag">연 1회 리밸런싱</span>
            <span className="hero-tag">30일 룰</span>
            <span className="hero-tag">단일 종목 ≤ 10%</span>
          </div>
          <div className="hero-disclaimer">
            <strong>면책 고지:</strong> 본 문서는 일반 정보 제공 목적이며, 투자 자문이 아닙니다.
            모든 투자 결정의 책임은 부부 본인에게 있습니다.
          </div>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 1: 왜 장기투자인가 ══ */}
      <div className="sec-header" id="sec-why">
        <div className="sec-num">PRINCIPLE 01</div>
        <div className="sec-title">왜 — 통계가 말하는 사실</div>
      </div>

      <div className="container">
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 16 }}>
          S&P 500 (1970~2020년, 배당 포함) 데이터 기준. 보유 기간이 길수록 손실 확률은 0에 수렴한다.
          매수 타이밍보다 <strong>안 파는 능력</strong>이 결정 변수.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat-card danger">
          <div className="stat-num">20%</div>
          <div className="stat-label">1년 보유 시 손실 확률</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-num">15%</div>
          <div className="stat-label">5년 보유 시 손실 확률</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">0%</div>
          <div className="stat-label">15년 이상 보유 시 손실 확률</div>
        </div>
        <div className="stat-card navy">
          <div className="stat-num">+10.74%</div>
          <div className="stat-label">51년 연평균 총수익률</div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          통제 가능한 것에만 집중한다
        </p>
      </div>

      <div className="do-dont">
        <div className="dd-card do">
          <div className="dd-title">✓ 100% 통제 가능</div>
          <ul className="dd-list">
            <li>안 파는 능력</li>
            <li>세금 효율</li>
            <li>분산</li>
            <li>비용 최소화</li>
            <li>부부 합의 룰</li>
          </ul>
        </div>
        <div className="dd-card dont">
          <div className="dd-title">✕ 통제 불가능</div>
          <ul className="dd-list">
            <li>종목 선택 결과</li>
            <li>시장 타이밍</li>
            <li>단기 변동성</li>
            <li>외부 충격</li>
            <li>다른 사람의 수익률</li>
          </ul>
        </div>
      </div>

      <div className="container" style={{ marginTop: 28 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          신혼부부의 최대 알파 — 부부 합산 절세 한도
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>항목</th>
              <th>1인 한도</th>
              <th>부부 합산</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>연금저축</td><td className="num">600만 원</td><td className="num good">1,200만 원</td></tr>
            <tr><td>IRP 추가</td><td className="num">300만 원</td><td className="num good">600만 원</td></tr>
            <tr><td>ISA</td><td className="num">연 2,000만 원</td><td className="num good">연 4,000만 원</td></tr>
            <tr className="em">
              <td>연 환급액 (총급여 5,500만 이하)</td>
              <td className="num">148.5만 원</td>
              <td className="num good">297만 원</td>
            </tr>
            <tr>
              <td>연 환급액 (총급여 5,500만 초과)</td>
              <td className="num">118.8만 원</td>
              <td className="num good">237.6만 원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="callout growth">
        <strong>핵심:</strong> 부부 합산 연 1,800만 원 납입 시 즉시 확정 환급 <strong>약 297만 원/년</strong>.
        어떤 주식보다 확실한 수익. 이게 신혼부부의 최대 무기.
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 2: 시작 전 토대 ══ */}
      <div className="sec-header" id="sec-base">
        <div className="sec-num">PRINCIPLE 02</div>
        <div className="sec-title">투자 버튼을 누르기 전에</div>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num danger">1</div>
          <div className="principle-body">
            <div className="principle-title">비상금 <span className="arrow">→</span> 부부 합산 생활비의 3~6개월치</div>
            <div className="principle-desc">
              위치: <strong>CMA · MMF · 파킹통장</strong>. 절대 주식·ETF에 넣지 말 것.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 시장이 -30% 무너졌을 때 생활비가 부족해서 강제 매도하는 게
              개인투자자의 가장 큰 손실 패턴이다. 비상금이 없으면 변동성 자체를 견딜 수 없다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num navy">2</div>
          <div className="principle-body">
            <div className="principle-title">부부 통장 구조 <span className="arrow">→</span> 공동 70% + 개인 30%</div>
            <div className="principle-desc">
              생활비·비상금·공동 투자 = 공동 통장. 각자 용돈·개인 투자 = 개인 통장.
              서로 간섭하지 않는 영역을 명확히 분리.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 통계적으로 부부 갈등이 가장 적은 구조. 모든 돈을 공동으로 하면 사소한 지출에서
              마찰이 생기고, 모든 돈을 분리하면 공동 목표가 약해진다. 70/30이 균형점.
            </div>
          </div>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 3: 절세 계좌 ══ */}
      <div className="sec-header" id="sec-accounts">
        <div className="sec-num">INFRASTRUCTURE</div>
        <div className="sec-title">계좌 인프라 — 부부 합산 6개 계좌</div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>계좌</th>
              <th>세제 혜택</th>
              <th>인출 제약</th>
              <th>위험자산 한도</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>연금저축</strong></td>
              <td>세액공제 13.2~16.5%</td>
              <td>55세 전 16.5% 과세</td>
              <td className="good">100%</td>
            </tr>
            <tr>
              <td><strong>IRP</strong></td>
              <td>세액공제 13.2~16.5%</td>
              <td>55세 전 16.5% 과세</td>
              <td>70%</td>
            </tr>
            <tr>
              <td><strong>ISA</strong></td>
              <td>비과세 200~400만 원</td>
              <td>3년 의무 보유</td>
              <td className="good">100%</td>
            </tr>
            <tr>
              <td>일반 계좌</td>
              <td>없음</td>
              <td>자유</td>
              <td className="good">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="account-grid">
        <div className="account-card">
          <div className="account-head">
            <span className="account-name">📋 부부가 개설할 계좌 목록</span>
            <span className="account-tag">총 6개</span>
          </div>
          <div className="account-body">
            <p><strong>각자 다음 3개를 개설:</strong></p>
            <p>□ 연금저축 계좌 (증권사, 수수료 면제 상품)</p>
            <p>□ IRP 계좌</p>
            <p>□ ISA 계좌</p>
            <p style={{ marginTop: 10 }}>→ 부부 합산 <strong>6개 계좌</strong>가 평생의 인프라가 된다.</p>
          </div>
        </div>
      </div>

      <div className="callout">
        <strong>리밸런싱이 무료라는 숨은 강점:</strong> 연금저축·IRP 안에서는 매수·매도가
        모두 <strong>과세 이연</strong>(인출 시까지 세금 0). ISA 안에서도 손익 통산되어 200~400만 원까지 비과세.
        일반 계좌에서 ETF를 매도하면 배당소득세 15.4%가 매번 빠진다.
        리밸런싱은 무조건 절세 계좌 안에서 한다.
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 4: 자산 선택 ══ */}
      <div className="sec-header" id="sec-assets">
        <div className="sec-num">ALLOCATION</div>
        <div className="sec-title">자산 선택 — 무엇을 살 것인가</div>
      </div>

      <div className="container">
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 14, fontWeight: 600 }}>
          위험 자산 비율 (소득 안정성에 따라)
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>부부 상황</th>
              <th>주식 : 채권/현금</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>맞벌이 정규직 (안정성 최고)</td><td className="num good">70~80 : 20~30</td></tr>
            <tr><td>맞벌이 중 1명 비정규직</td><td className="num">60~70 : 30~40</td></tr>
            <tr><td>외벌이 정규직</td><td className="num">50~60 : 40~50</td></tr>
            <tr><td>프리랜서 · 자영업</td><td className="num">40~50 : 50~60</td></tr>
          </tbody>
        </table>
      </div>

      <div className="container" style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
          단순 공식: <strong>(100 − 평균 나이)% 주식</strong>. 신혼부부(30대 초반)면 자연스럽게 70% 안팎.
        </p>
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          지역 분산
        </p>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-num">60~70%</div>
          <div className="stat-label">미국 (S&P 500 메인)</div>
        </div>
        <div className="stat-card navy">
          <div className="stat-num">10~20%</div>
          <div className="stat-label">한국 (환위험 분산)</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-num">10~20%</div>
          <div className="stat-label">신흥국 · 기타</div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 28 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          구체적 ETF — 한국 상장, 절세 계좌 가능
        </p>
      </div>

      <div className="etf-grid">
        <div className="etf-card">
          <div className="etf-name">TIGER 미국S&P500 (TR)</div>
          <div className="etf-code">360750</div>
          <div className="etf-meta">
            <strong>메인 추천</strong> · 총보수 ≈ 0.07% · 배당 자동 재투자 (복리 최대화)
          </div>
        </div>
        <div className="etf-card">
          <div className="etf-name">RISE 미국S&P500</div>
          <div className="etf-code">379780</div>
          <div className="etf-meta">총보수 0.087% · 국내 <strong>최저 보수급</strong></div>
        </div>
        <div className="etf-card">
          <div className="etf-name">KODEX 미국S&P500</div>
          <div className="etf-code">379800</div>
          <div className="etf-meta">총보수 ≈ 0.09% · 분기 배당 (현금 흐름 원할 때)</div>
        </div>
        <div className="etf-card">
          <div className="etf-name">TIGER 미국나스닥100</div>
          <div className="etf-code">133690</div>
          <div className="etf-meta">선택 — 기술주 집중. S&P500과 일부 중복</div>
        </div>
        <div className="etf-card">
          <div className="etf-name">KODEX 200 / TIGER 200</div>
          <div className="etf-code">069500 / 102110</div>
          <div className="etf-meta">한국 지수 비중 — 환위험 분산용</div>
        </div>
        <div className="etf-card">
          <div className="etf-name">KODEX 단기채권 / KOSEF 국고채10년</div>
          <div className="etf-code">153130 / 148070</div>
          <div className="etf-meta">안전자산 — 현금성 + 중장기 국채</div>
        </div>
      </div>

      <div className="callout navy">
        <strong>환헤지 vs 비헤지:</strong> 장기투자는 일반적으로 <strong>비헤지(TR)</strong> 선호.
        헤지는 비용이 누적되고, 장기로 보면 환위험은 자연 분산으로 작용한다.
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          계좌별 운용 매핑
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>계좌</th>
              <th>담을 내용</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>연금저축</strong> (100% 위험자산 가능)</td>
              <td>TIGER 미국S&P500 (TR) 100%</td>
            </tr>
            <tr>
              <td><strong>IRP</strong> (위험자산 70% 한도)</td>
              <td>미국 S&P500 60% + 채권 ETF 30% + 안전자산 10%</td>
            </tr>
            <tr>
              <td><strong>ISA</strong></td>
              <td>미국 + 한국 ETF 혼합, 중기 목표 자금</td>
            </tr>
            <tr>
              <td>일반 계좌</td>
              <td>개별 종목 (LS일렉트릭 등) — <strong>전체의 5~10% 이하</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 5: DCA ══ */}
      <div className="sec-header" id="sec-dca">
        <div className="sec-num">EXECUTION</div>
        <div className="sec-title">적립식 자동매수 (DCA)</div>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num growth">1</div>
          <div className="principle-body">
            <div className="principle-title">매월 같은 날짜에 같은 금액을 자동 매수</div>
            <div className="principle-desc">
              가격이 떨어지면 더 많이, 오르면 더 적게 사게 됨 → <strong>자동 평균화</strong>.
              타이밍 잡으려 하지 말 것. 통계적으로 DCA가 일시 매수보다 안정적.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 자동이체 + 자동매수를 설정해두면 <strong>감정 개입 자체가 차단</strong>된다.
              "지금 살까 말까"라는 질문 자체가 없어지는 게 목표.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num navy">2</div>
          <div className="principle-body">
            <div className="principle-title">자동화 셋업 4단계</div>
            <div className="principle-desc">
              ① 월급통장 → 투자 통장 자동이체 (월급일 +1일)<br />
              ② 투자 통장 → 연금저축 / IRP / ISA 자동이체<br />
              ③ 각 계좌 내 ETF 정기 매수 설정 (증권사 앱 "월 적립식" 기능)<br />
              ④ <strong>결과 알림 OFF</strong> — 보면 손이 움직임
            </div>
            <div className="principle-why">
              <strong>알림 OFF가 핵심이다.</strong> 매일 등락을 확인하면 단기 사고로 끌려간다.
              월간 머니 데이트 때 1번만 본다는 룰을 지키려면 알림 자체를 꺼야 한다.
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          권장 적립 금액 — 부부 합산 절세 한도 풀가동 예시
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>항목</th>
              <th>부부 각자</th>
              <th>합산</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>연금저축</td><td className="num">월 50만 원</td><td className="num">월 100만 원</td></tr>
            <tr><td>IRP</td><td className="num">월 25만 원</td><td className="num">월 50만 원</td></tr>
            <tr className="em">
              <td><strong>소계 (절세 한도)</strong></td>
              <td className="num"><strong>월 75만 원</strong></td>
              <td className="num good"><strong>월 150만 원</strong></td>
            </tr>
            <tr><td>ISA (여유 시)</td><td className="num">월 10~30만 원</td><td className="num">월 20~60만 원</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout growth">
        부부 합산 월 150만 원 = 연 1,800만 원 → <strong>연 환급 약 297만 원</strong> (총급여 5,500만 이하 기준).
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 6: 리밸런싱 ══ */}
      <div className="sec-header" id="sec-rebal">
        <div className="sec-num">MAINTENANCE</div>
        <div className="sec-title">리밸런싱과 머니 데이트</div>
      </div>

      <div className="container">
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 16 }}>
          자동화가 돌고 나면 할 일은 거의 없다. 단, <strong>1년에 한 번은 점검</strong>.
          리밸런싱은 수익률 극대화가 아니라 <strong>위험 관리</strong> + 강제 "비싸게 팔고 싸게 사기" 실행.
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>방식</th>
              <th>주기</th>
              <th>장단점</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>시간 기반</td><td>연 1회</td><td>단순. 통계적으로 가장 무난</td></tr>
            <tr><td>임계값 기반</td><td>±5% 이탈 시</td><td>효율적이지만 모니터링 필요</td></tr>
            <tr className="em">
              <td><strong>현금흐름 기반 (권장)</strong></td>
              <td>매월</td>
              <td><strong>세금 0원</strong>, 매도 불필요 — 적립금을 부족 자산에 우선 투입</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="callout navy">
        <strong>부부 권장 조합:</strong><br />
        • <strong>평소(매월)</strong>: 적립금 비중을 부족 자산에 더 많이 배분 (현금흐름 기반)<br />
        • <strong>연 1회(머니 데이트)</strong>: 전체 점검, ±5% 이상 이탈 시 매매로 조정 (절세 계좌 안에서)
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          연 1회 리밸런싱 실전 (예: 매년 1월)
        </p>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num growth">1~6</div>
          <div className="principle-body">
            <div className="principle-title">6단계 작업</div>
            <div className="principle-desc">
              ① 현재 자산을 분류 (미국 주식 / 한국 주식 / 채권 / 현금)<br />
              ② 각 비중 계산<br />
              ③ 목표 비중과 비교<br />
              ④ ±5% 이상 이탈한 항목 식별<br />
              ⑤ <strong>절세 계좌 안에서 매수/매도</strong> (세금 0)<br />
              ⑥ 다음 12개월 자동이체 비율 조정
            </div>
          </div>
        </div>
      </div>

      <div className="do-dont" style={{ marginTop: 20 }}>
        <div className="dd-card do">
          <div className="dd-title">✓ 월간 머니 데이트</div>
          <ul className="dd-list">
            <li>매월 정해진 날 1시간</li>
            <li>자산 변화 점검, 다음 달 계획</li>
            <li><strong>이 자리에서만</strong> 투자 의사결정</li>
            <li>자동매수 정상 동작 확인</li>
          </ul>
        </div>
        <div className="dd-card dont">
          <div className="dd-title">✕ 흔한 실수</div>
          <ul className="dd-list">
            <li>너무 자주 리밸런싱 (월별, 주별)</li>
            <li>시장이 무서워서 보수적으로 변경</li>
            <li>절세 계좌 밖에서 적극적 매도</li>
            <li>목표 비중 자체를 자주 바꿈</li>
          </ul>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 7: 부부 가드레일 ══ */}
      <div className="sec-header" id="sec-rules">
        <div className="sec-num">GUARDRAIL</div>
        <div className="sec-title">부부 가드레일 — 사전에 정하는 룰</div>
      </div>

      <div className="container">
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          금액별 의사결정 임계값
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>금액</th>
              <th>의사결정 방식</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">~10만 원</td><td>각자 자유</td></tr>
            <tr><td className="num">10만 ~ 50만 원</td><td>사후 공유</td></tr>
            <tr><td className="num">50만 ~ 200만 원</td><td>사전 통보 (이의 없으면 진행)</td></tr>
            <tr className="em">
              <td className="num">200만 원 이상</td>
              <td><strong>사전 합의 필수</strong></td>
            </tr>
            <tr className="em">
              <td className="num">500만 원 이상</td>
              <td><strong>사전 합의 + 24시간 숙고</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="callout growth">
        이 룰 하나로 충동 매수의 <strong>약 80%가 차단</strong>된다.
      </div>

      <div className="principles" style={{ marginTop: 24 }}>
        <div className="principle">
          <div className="principle-num warn">30</div>
          <div className="principle-body">
            <div className="principle-title">30일 룰 <span className="arrow">→</span> 새 종목/ETF/큰 결정은 30일 보류</div>
            <div className="principle-desc">
              30일 후에도 같은 판단이면 실행. <strong>"오늘 안 사면 놓친다"는 90% 거짓.</strong>
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num danger">✋</div>
          <div className="principle-body">
            <div className="principle-title">거부권 (Veto) <span className="arrow">→</span> 한 명이 반대하면 무조건 보류</div>
            <div className="principle-desc">
              설득하지 말 것. 시간이 답한다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num growth">5~10%</div>
          <div className="principle-body">
            <div className="principle-title">단일 종목 한도 <span className="arrow">→</span> 전체 자산의 5~10%</div>
            <div className="principle-desc">
              어떤 종목이든 이 룰을 적용. LS일렉트릭 같은 개별 종목 보유 시에도 동일.
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          통계적으로 피해야 할 행동
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>행동</th>
              <th>이유</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="bad">단타 · 스윙 매매</td><td>수수료 · 세금 누수, 시장 수익률 미달</td></tr>
            <tr><td className="bad">레버리지 ETF (2X, 3X)</td><td>변동성 끌림으로 장기 음(-)의 기대값</td></tr>
            <tr><td className="bad">인버스 ETF</td><td>시장 장기 상승 추세에 역행</td></tr>
            <tr><td className="bad">테마 ETF의 "분산" 환상</td><td>BIG3에 68% 몰린 ETF는 분산 효과 거의 없음</td></tr>
            <tr><td className="bad">레버리지 빚투</td><td>변동성 견딜 능력 자체 소멸</td></tr>
            <tr><td className="bad">유튜브 · 커뮤니티 종목 추천</td><td>누가 그 정보로 이득 보는지 불명</td></tr>
            <tr><td className="bad">평단가 낮추기 (물타기)</td><td>잘못된 판단에 자본을 더 투입</td></tr>
            <tr><td className="bad">일봉 매시간 확인</td><td>단타 사고로 끌려감. 장기 투자자는 주봉/월봉</td></tr>
          </tbody>
        </table>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 8: 정보 거르기 ══ */}
      <div className="sec-header" id="sec-filter">
        <div className="sec-num">FILTER</div>
        <div className="sec-title">정보 거르기 — 5가지 질문</div>
      </div>

      <div className="container">
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 16 }}>
          커뮤니티 / 유튜브 / 지인 추천을 받았을 때 즉시 통과시키는 체크.
        </p>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num navy">Q1</div>
          <div className="principle-body">
            <div className="principle-title">리스크 언급이 있는가?</div>
            <div className="principle-desc">없으면 분석이 아니라 호객.</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num navy">Q2</div>
          <div className="principle-body">
            <div className="principle-title">반증 가능한 주장인가?</div>
            <div className="principle-desc">"지속적 우상향" 같은 모호한 표현은 위험 신호.</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num navy">Q3</div>
          <div className="principle-body">
            <div className="principle-title">누가 이득을 보는가?</div>
            <div className="principle-desc">작성자가 이미 보유 중이면 포지션 방어일 가능성.</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num navy">Q4</div>
          <div className="principle-body">
            <div className="principle-title">이미 다 알려진 사실인가?</div>
            <div className="principle-desc">커뮤니티 도달 정보 = 가격에 이미 반영 완료.</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num navy">Q5</div>
          <div className="principle-body">
            <div className="principle-title">시간 프레임이 일관되는가?</div>
            <div className="principle-desc">장기 시나리오와 단기 시나리오 혼용은 신호.</div>
          </div>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 9: 개별 종목 분석 ══ */}
      <div className="sec-header" id="sec-stockpick">
        <div className="sec-num">ADVANCED · 5% 영역</div>
        <div className="sec-title">개별 종목 분석 도구</div>
      </div>

      <div className="callout">
        <strong>전제:</strong> 95%는 인덱스 자동화. 이 도구는 <strong>5% 영역에만 적용</strong>한다.
        종목 선택의 주된 기준은 항상 펀더멘털. 차트는 "이미 정한 종목의 진입 시점 보조" 도구일 뿐.
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          펀더멘털 핵심 4가지 지표
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>지표</th>
              <th>뜻</th>
              <th>해석 기준</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>PER</strong></td><td>주가 / 주당순이익</td><td>10배 이하 저평가, 30배 이상 고평가 (업종별 차이)</td></tr>
            <tr><td><strong>PBR</strong></td><td>주가 / 주당순자산</td><td>1배 이하는 청산가치 미달</td></tr>
            <tr><td><strong>ROE</strong></td><td>자기자본이익률</td><td>10% 이상 우수, 15% 이상 매우 우수</td></tr>
            <tr><td><strong>부채비율</strong></td><td>부채 / 자본</td><td>100% 이하 안전, 200% 초과 주의</td></tr>
          </tbody>
        </table>
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          공매도 잔고 비율 위험도 (핵심 지표)
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>잔고 비율</th>
              <th>해석</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num good">&lt; 1%</td><td>무시 가능</td></tr>
            <tr><td className="num">1~3%</td><td>일반적 수준</td></tr>
            <tr><td className="num">3~5%</td><td>주의</td></tr>
            <tr className="em"><td className="num">5~10%</td><td><strong>명백한 베어 베팅 신호</strong></td></tr>
            <tr><td className="num bad">&gt; 10%</td><td>고위험. 펀더멘털 우려 가능성</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout danger">
        <strong>혼동 주의:</strong> "공매도 거래대금 비율"(당일 매매 강도)과 "공매도 <em>잔고</em> 비율"(누적 베어 베팅)은 다른 지표.
        <strong> 잔고 비율</strong>이 중장기 핵심 지표.
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          이동평균선 — 장기 투자자가 봐야 할 것
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>이동평균선</th>
              <th>기간</th>
              <th>누가 보는가</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>5일선</td><td>1주일</td><td className="bad">초단타 — 무시</td></tr>
            <tr><td>20일선</td><td>1개월</td><td className="bad">스윙 — 무시</td></tr>
            <tr><td>60일선</td><td>분기</td><td>중기 투자자</td></tr>
            <tr><td>120일선</td><td>반기</td><td>중장기 투자자</td></tr>
            <tr className="em"><td><strong>200일선</strong></td><td>1년</td><td className="good"><strong>장기 투자자 — 글로벌 표준</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout navy">
        <strong>이격도(Disparity):</strong> (현재 가격 / 120일 이동평균선) × 100. <strong>120% 초과 = 단기 과열 신호</strong>.
        장기 투자자는 <strong>주봉 · 월봉</strong>만 본다. 일봉을 보는 순간 단타로 끌려간다.
      </div>

      <div className="container" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          장기 투자자의 5단계 종목 점검
        </p>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num growth">1</div>
          <div className="principle-body">
            <div className="principle-title">펀더멘털 점검</div>
            <div className="principle-desc">
              매출/영업이익 성장률 · PER, PBR, ROE · 애널리스트 컨센서스 목표가 vs 현재가
            </div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num growth">2</div>
          <div className="principle-body">
            <div className="principle-title">52주 차트 위치 확인</div>
            <div className="principle-desc">52주 최고가/최저가 · 현재 위치 (<strong>신고가 부근이면 주의</strong>)</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num growth">3</div>
          <div className="principle-body">
            <div className="principle-title">이동평균선 점검 (60일 / 120일)</div>
            <div className="principle-desc">주가가 이동평균선 위/아래인지 · 120일 이격도 100% 초과 여부</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num growth">4</div>
          <div className="principle-body">
            <div className="principle-title">거래량 추이</div>
            <div className="principle-desc">가격 상승 + 거래량 증가 = 강한 상승. 가격 상승 + 거래량 감소 = 약한 상승 (의심)</div>
          </div>
        </div>
        <div className="principle">
          <div className="principle-num growth">5</div>
          <div className="principle-body">
            <div className="principle-title">공매도 잔고 비율</div>
            <div className="principle-desc">헤지펀드의 누적 의견. KRX 정보데이터시스템에서 확인.</div>
          </div>
        </div>
      </div>

      <div className="callout">
        <strong>판정 룰:</strong> 5가지가 <strong>모두 빨간불</strong>이면 매수 보류.
        한두 개만 빨간불이면 <strong>분할매수</strong> 고려.
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 10: LS일렉트릭 사례 ══ */}
      <div className="sec-header" id="sec-case">
        <div className="sec-num">CASE STUDY</div>
        <div className="sec-title">LS일렉트릭 — 첫 개별 종목 투자 사례</div>
      </div>

      <div className="case-card">
        <div className="case-inner">
          <div className="case-label">5단계 점검 도구를 실제로 적용한 회고</div>
          <div className="case-h">현재 포지션</div>

          <div className="case-grid">
            <div className="case-stat">
              <div className="case-stat-label">매수가</div>
              <div className="case-stat-val">312,000원</div>
            </div>
            <div className="case-stat">
              <div className="case-stat-label">현재가</div>
              <div className="case-stat-val">약 300,000원</div>
            </div>
            <div className="case-stat">
              <div className="case-stat-label">수량</div>
              <div className="case-stat-val">6주</div>
            </div>
            <div className="case-stat">
              <div className="case-stat-label">원금</div>
              <div className="case-stat-val">약 1,860,000원</div>
            </div>
            <div className="case-stat">
              <div className="case-stat-label">평가손익</div>
              <div className="case-stat-val bad">약 -3.8% (≈ -7만 원)</div>
            </div>
            <div className="case-stat">
              <div className="case-stat-label">전체 자산 내 비중</div>
              <div className="case-stat-val">5% 이하 유지</div>
            </div>
          </div>

          <div className="case-block-title">✓ 펀더멘털 (긍정)</div>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
            <li>26년 1Q 매출 1조3,766억 (+33.4%), 영업이익 1,266억 (+45.3%) — 분기 사상 최대</li>
            <li>수주잔고 5조6,000억 (+45% YoY), 초고압 변압기만 3조1,000억</li>
            <li>북미 매출 +80% YoY, AWS 등 빅테크 누적 수주 5,000억+</li>
            <li>26년 컨센서스: 영업이익 6,376억 (+50%)</li>
          </ul>

          <div className="case-block-title">✕ 밸류에이션 · 차트 (부정)</div>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
            <li>PER 83배, PBR 19.6배 — 매우 높음</li>
            <li>애널리스트 21명 평균 목표가 <strong style={{ color: 'var(--danger)' }}>215,181원 (현재가 대비 −31%)</strong></li>
            <li>액면분할 직후 <strong>7거래일 연속 신고가</strong> · 52주 신고가 부근</li>
            <li><strong>120일 이격도 100% 초과</strong> — 전형적 단기 과열</li>
            <li>외국인 지분율 20.5% → 18.7% 감소, 공매도 거래비중 16~17%</li>
          </ul>

          <div className="case-block-title">진단 결과</div>
          <div className="tbl-wrap" style={{ padding: 0, marginBottom: 14 }}>
            <table className="tbl">
              <thead>
                <tr><th>점검 항목</th><th>결과</th></tr>
              </thead>
              <tbody>
                <tr><td>펀더멘털</td><td className="good">✓ 강함</td></tr>
                <tr><td>밸류에이션</td><td className="bad">✕ 매우 높음 (컨센서스 −31%)</td></tr>
                <tr><td>52주 위치</td><td className="bad">✕ 신고가 부근</td></tr>
                <tr><td>120일 이격도</td><td className="bad">✕ 100% 초과 (과열)</td></tr>
                <tr><td>거래량</td><td>△ 변동 큼</td></tr>
                <tr><td>공매도 거래비중</td><td className="bad">✕ 16~17% (높음)</td></tr>
              </tbody>
            </table>
          </div>

          <div className="callout danger" style={{ margin: 0 }}>
            <strong>5개 중 4개 빨간불.</strong> 차트 도구를 알았다면 매수 보류 또는 분할매수가 정답이었던 케이스.
          </div>

          <div className="case-block-title" style={{ marginTop: 18 }}>부부 합의 결론</div>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
            <li><strong>추가 매수 X</strong> (이미 비싸게 샀음)</li>
            <li><strong>손절 X</strong> (펀더멘털 자체는 강함)</li>
            <li>12~24개월 보유 후 재평가</li>
            <li>이 6주는 <strong>별도 계정 분리</strong>. "공부 비용 + 적금"으로 명명</li>
            <li>다음 개별 종목 매수 시 <strong>5단계 점검 무조건 적용</strong></li>
          </ul>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 11: 체크리스트 ══ */}
      <div className="sec-header" id="sec-checklist">
        <div className="sec-num">CHECKLIST</div>
        <div className="sec-title">부부 자가 점검 체크리스트</div>
      </div>

      <div className="checklist">
        <div className="check-group">
          <div className="check-group-title">🧱 토대</div>
          <ul className="check-list">
            <li>비상금 3~6개월치 확보 (CMA/MMF/파킹통장)</li>
            <li>부부 통장 구조 합의 (공동 70% + 개인 30%)</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">🏦 계좌 인프라</div>
          <ul className="check-list">
            <li>부부 각자 연금저축 계좌 개설 (증권사, 수수료 면제)</li>
            <li>부부 각자 IRP 계좌 개설</li>
            <li>부부 각자 ISA 계좌 개설</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">🌍 자산 배분</div>
          <ul className="check-list">
            <li>위험 자산 비율 합의 (부부 상황에 맞게)</li>
            <li>지역 분산 비율 합의 (미국 / 한국 / 기타)</li>
            <li>목표 비중 문서화</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">🔁 자동화</div>
          <ul className="check-list">
            <li>월급통장 → 투자 통장 자동이체 설정</li>
            <li>각 계좌에 자동매수 설정</li>
            <li>결과 알림 OFF</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">⚖️ 유지 관리</div>
          <ul className="check-list">
            <li>연 1회 리밸런싱 날짜 합의 (예: 매년 1월)</li>
            <li>월간 머니 데이트 날짜 정하기</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">🛡️ 부부 룰</div>
          <ul className="check-list">
            <li>임계값 룰 합의 (10/50/200/500만 원)</li>
            <li>30일 룰 합의</li>
            <li>거부권 룰 합의</li>
          </ul>
        </div>

        <div className="check-group">
          <div className="check-group-title">🚫 투자 행동 금지선</div>
          <ul className="check-list">
            <li>단타 · 레버리지 · 인버스 · 테마 ETF 금지 합의</li>
            <li>단일 종목 5~10% 한도 합의</li>
            <li>일봉 보지 않기 합의</li>
          </ul>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 12: 사이트 · 용어 ══ */}
      <div className="sec-header" id="sec-resources">
        <div className="sec-num">RESOURCES</div>
        <div className="sec-title">유용한 사이트와 용어</div>
      </div>

      <div className="link-row">
        <a className="link-btn" href="https://data.krx.co.kr" target="_blank" rel="noreferrer">
          <div className="link-btn-title">KRX 정보데이터시스템 →</div>
          <div className="link-btn-desc">공매도 잔고 · 종목별 데이터 (공식, 무료)</div>
        </a>
        <a className="link-btn" href="https://short.krx.co.kr" target="_blank" rel="noreferrer">
          <div className="link-btn-title">KRX 공매도 종합포털 →</div>
          <div className="link-btn-desc">공매도 잔고 대량보유자 공시 (T+2)</div>
        </a>
        <a className="link-btn" href="https://finance.naver.com" target="_blank" rel="noreferrer">
          <div className="link-btn-title">네이버 금융 →</div>
          <div className="link-btn-desc">종합 종목 정보, 차트, 재무제표, 컨센서스</div>
        </a>
        <a className="link-btn" href="https://kr.investing.com" target="_blank" rel="noreferrer">
          <div className="link-btn-title">Investing.com →</div>
          <div className="link-btn-desc">글로벌 시세 · 차트 · 애널리스트 컨센서스</div>
        </a>
        <a className="link-btn" href="https://comp.fnguide.com" target="_blank" rel="noreferrer">
          <div className="link-btn-title">FnGuide 기업분석 →</div>
          <div className="link-btn-desc">기업 상세 분석 (재무제표 깊이)</div>
        </a>
      </div>

      <div className="container" style={{ marginTop: 28 }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 12, fontWeight: 600 }}>
          꼭 알아야 할 용어
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>용어</th>
              <th>뜻</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>DCA</strong></td><td>Dollar Cost Averaging — 적립식 매수. 매월 같은 금액 정기 매수</td></tr>
            <tr><td><strong>리밸런싱</strong></td><td>자산 비중이 목표에서 어긋날 때 원래 비율로 복원</td></tr>
            <tr><td><strong>TR (Total Return)</strong></td><td>배당 자동 재투자형 ETF (복리 최대화)</td></tr>
            <tr><td><strong>환헤지</strong></td><td>환율 변동 위험을 제거 (비용 발생, 장기엔 일반적으로 비헤지 선호)</td></tr>
            <tr><td><strong>과세 이연</strong></td><td>세금 부과 시점을 미래로 미루기 (연금저축/IRP의 핵심 혜택)</td></tr>
            <tr><td><strong>PER · PBR · ROE</strong></td><td>주가/순이익 · 주가/순자산 · 자본 효율성 — 펀더멘털 핵심 3지표</td></tr>
            <tr><td><strong>YoY</strong></td><td>Year over Year — 전년 동기 대비 성장률</td></tr>
            <tr><td><strong>컨센서스</strong></td><td>애널리스트 평균 전망치 · 목표주가</td></tr>
            <tr><td><strong>공매도 잔고 비율</strong></td><td>현재 공매도된 주식 / 상장주식수. <strong>누적 베어 베팅 강도</strong></td></tr>
            <tr><td><strong>이격도</strong></td><td>현재 가격이 이동평균선에서 얼마나 떨어졌는지 (%). 120% 초과 = 과열</td></tr>
            <tr><td><strong>골든/데드크로스</strong></td><td>단기선이 장기선을 위/아래로 돌파 (후행 지표 — 참고용)</td></tr>
            <tr><td><strong>52주 신고가/신저가</strong></td><td>최근 1년 중 최고/최저 가격</td></tr>
          </tbody>
        </table>
      </div>

      <div className="spacer"></div>

      <div className="stock-footer">
        부부 장기 투자 시스템 가이드 · 2026<br />
        95% 인덱스 자동화 + 5% 개별 종목
        <div className="disclaimer">
          본 문서는 일반 정보 제공 목적이며, 투자 자문이 아닙니다.<br />
          모든 투자 결정의 책임은 부부 본인에게 있습니다.
        </div>
      </div>
    </div>
  )
}
