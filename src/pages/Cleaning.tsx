import { useNavigate } from 'react-router-dom'
import FloatingToc, { type TocItem } from '../components/FloatingToc'
import './Cleaning.css'

const tocItems: TocItem[] = [
  { id: 'sec-principles', label: '3가지 대원칙', emoji: '⚠️' },
  { id: 'sec-materials', label: '재질별 세제', emoji: '🧴' },
  { id: 'sec-glue', label: '도배풀 제거', emoji: '🧻' },
  { id: 'sec-rooms', label: '공간별 순서', emoji: '🏠' },
  { id: 'sec-supplies', label: '추천 용품', emoji: '🛒' },
  { id: 'sec-schedule', label: '주말 타임라인', emoji: '⏰' },
]

export default function Cleaning() {
  const navigate = useNavigate()

  return (
    <div className="cleaning">
      <FloatingToc items={tocItems} />

      <button className="back-btn" onClick={() => navigate('/')}>
        ← 홈으로
      </button>

      {/* ══ HERO ══ */}
      <div className="hero">
        <div className="container">
          <div className="hero-label">입주 청소 완전 가이드 · 2인 주말 플랜</div>
          <h1>전체 철거 인테리어 후<br /><em>직접 하는</em> 입주 청소</h1>
          <p className="hero-sub">
            권선대우 325동201호 · 32평 B타입<br />
            시멘트 분진 · 석고 가루 · 공사 잔여물 완전 제거
          </p>
          <div className="hero-tags">
            <span className="hero-tag">건식 → 습식</span>
            <span className="hero-tag">위 → 아래</span>
            <span className="hero-tag">안 → 밖</span>
            <span className="hero-tag">재질별 세제 구분</span>
            <span className="hero-tag">도배풀 제거 포함</span>
            <span className="hero-tag">다이소 준비물 포함</span>
          </div>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 1: 대원칙 ══ */}
      <div className="sec-header" id="sec-principles">
        <div className="sec-num">PRINCIPLE 01</div>
        <div className="sec-title">절대로 어기면 안 되는 3가지 대원칙</div>
      </div>

      <div className="principles">
        <div className="principle">
          <div className="principle-num red">1</div>
          <div className="principle-body">
            <div className="principle-title">건식 <span className="arrow">→</span> 습식 : 물보다 먼저 털어낸다</div>
            <div className="principle-desc">
              청소기·붓·마른 극세사로 <strong>가루를 완전히 제거한 후에</strong> 물걸레·세정제를 쓴다.<br />
              벽지뿐 아니라 장판, 가구, 타일 모두 동일하게 적용한다.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 시멘트·석고 가루는 물과 만나면 수화 반응(hydration)을 일으켜 <strong>얇은 시멘트 피막으로 굳는다.</strong>
              타일 줄눈, 가구 홈, 장판 이음매에 물 먼저 닿으면 가루가 굳어 긁어내야 하는 상황이 된다.
              특히 실크 엠보 벽지는 물에 닿은 순간 표면이 눌려 무늬가 망가지고 얼룩이 영구적으로 남는다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num amber">2</div>
          <div className="principle-body">
            <div className="principle-title">위 <span className="arrow">→</span> 아래 : 천장부터 바닥 순서를 절대 바꾸지 않는다</div>
            <div className="principle-desc">
              천장 몰딩 → 벽면 → 가구 상단 → 가구 하단 → 장판 순서로 내려온다.<br />
              청소한 바닥에 위에서 가루가 다시 떨어지는 이중 작업을 방지한다.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 중력 때문이다. 아무리 조심해도 위를 털면 아래로 분진이 내려온다.
              <strong>바닥은 항상 마지막</strong>에 해야 한 번에 끝낼 수 있다.
              거실 라인조명 목공 박스, 다운라이트 45개 주변은 시멘트·석고 가루가 특히 많이 쌓인다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num green">3</div>
          <div className="principle-body">
            <div className="principle-title">재질별 세제 구분 : 구연산(산성)은 타일·유리에만, 나머지는 중성</div>
            <div className="principle-desc">
              시멘트 가루는 온 집에 퍼져 있지만, 세제를 고를 때 기준은
              <strong>「시멘트가 어디 있는가」가 아니라 「어떤 재질 위에 있는가」</strong>이다.
            </div>
            <div className="principle-why">
              <strong>왜?</strong>
              구연산은 알칼리성 시멘트를 중화하는 데 효과적이지만, <strong>인조대리석(스타론 상판)</strong>에 쓰면
              표면이 부식·변색되고, <strong>PET 가구(한솔 포그그레이)</strong>에 반복 사용하면 코팅이 흐릿해진다.
              <strong>LX 장판</strong>도 산에 닿으면 표면 코팅이 손상된다.
              「시멘트 가루가 묻었으니 구연산 쓰면 되겠지」라는 생각이 가장 위험한 함정이다.
            </div>
          </div>
        </div>
      </div>

      {/* 절대 금지 */}
      <div style={{ maxWidth: 760, margin: '16px auto 0', padding: '0 20px' }}>
        <div className="prohib-box">
          <div className="prohib-title">⛔ 절대 해서는 안 되는 행동</div>
          <ul className="prohib-list">
            <li><strong>벽지에 물 또는 물걸레 직접 접촉</strong> — 실크 엠보 패턴이 눌리고 얼룩이 영구 잔존</li>
            <li><strong>인조대리석 상판(스타론), PET 가구, 장판에 구연산 사용</strong> — 표면 부식·코팅 손상</li>
            <li><strong>스테인리스 싱크볼·크롬 수전에 철수세미·일반 수세미 사용</strong> — 미세 스크래치 → 녹 발생</li>
            <li><strong>탄성코트 발코니에 물걸레 사용</strong> — 얼룩 영구 잔존, 도막 손상</li>
            <li><strong>가루 있는 상태에서 바로 문지르기</strong> — 가루가 연마재로 작용해 흠집 발생 (특히 싱크볼·수전)</li>
            <li><strong>창틀 레일에 물을 먼저 붓기</strong> — 가루가 굳어 레일 홈에 달라붙음</li>
            <li><strong>타일 시멘트 잔여물에 금속 스크래퍼·연마 수세미 사용</strong> — 타일 표면·광택 손상</li>
          </ul>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 2: 재질별 세제 가이드 ══ */}
      <div className="sec-header" id="sec-materials">
        <div className="sec-num">PRINCIPLE 02</div>
        <div className="sec-title">재질별 세제 선택 완전 가이드</div>
      </div>

      <div className="mat-section">
        <div className="mat-grid">

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">실크 엠보 벽지 (LX 베스티)</div><div className="mat-location">거실 · 침실 · 주방 · 현관 전체</div></div>
              <span className="badge badge-dry">건식 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 청소기 브러시 헤드, 돼지털 붓, 마른 극세사 (두드리듯 찍어냄)<br /><span className="no">✕ 금지</span> 물, 물걸레, 구연산, 어떠한 세정제도 금지</div>
              <div className="mat-reason">실크 벽지는 표면에 발포 엠보 코팅이 되어 있다. 물이 닿으면 코팅이 수분을 흡수해 패턴이 눌리고, 건조 후 물자국이 얼룩으로 영구 남는다. 엠보 사이 홈에 분진이 끼어 있어도 건식으로만 제거해야 한다. 붓으로 위→아래 방향으로 쓸어내리면 대부분 제거된다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">포세린·도기질 타일 / 줄눈</div><div className="mat-location">거실욕실(600×600) · 안방욕실(300×600) · 현관 · 주방 미드웨이</div></div>
              <span className="badge badge-safe">구연산 가능</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 구연산 희석액 (물 500ml + 구연산 1큰술), 중성세제, 칫솔(줄눈)<br /><span className="no">✕ 금지</span> 금속 스크래퍼, 연마 수세미 (타일 광택 손상)</div>
              <div className="mat-reason">굳은 시멘트는 알칼리성(pH 12~13). 산성인 구연산(pH 2~3)이 중화 반응으로 녹여낸다. 딱딱하게 굳은 잔여물엔 구연산 원액을 적신 키친타월을 10~15분 습포 후 닦는다. 줄눈 홈은 오래된 칫솔로 긁어내면 효율적이다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">인조대리석 상판 (롯데 스타론 아스펜아이스버그)</div><div className="mat-location">싱크대 상판</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 중성 주방세제 + 부드러운 스펀지, 극세사 천<br /><span className="no">✕ 금지</span> 구연산, 식초, 염산계 세정제, 연마 스펀지</div>
              <div className="mat-reason">인조대리석(아크릴릭 수지 계열)은 산에 취약하다. 구연산이나 식초를 쓰면 표면이 흐릿하게 부식되고 광택이 영구 손실된다. 위에 시멘트 가루가 묻어 있더라도 <strong>먼저 물로 충분히 불려 흘려보낸 뒤</strong> 중성세제로 닦아야 한다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">PET 가구 도어 (한솔 SB 포그그레이)</div><div className="mat-location">싱크대 · 신발장 · 냉장고장 · 키큰장</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 중성세제 희석액, 극세사 천 (가볍게 닦기)<br /><span className="no">✕ 금지</span> 구연산, 강알칼리 세정제, 알코올 계열, 연마제</div>
              <div className="mat-reason">PET(폴리에틸렌 테레프탈레이트) 필름 코팅은 산·강알칼리·알코올에 반응하면 코팅 표면이 뿌옇게 변색된다. 포그그레이 색상은 흐릿한 얼룩이 유독 잘 보인다. 가루 먼저 털어낸 뒤 살짝 물기 있는 극세사로 닦는 것으로 충분하다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">스테인리스 싱크볼 (백조 캄포르테 860)</div><div className="mat-location">주방</div></div>
              <span className="badge badge-warn">중성 + 주의</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 중성 주방세제 + 부드러운 스펀지, 극세사 천<br /><span className="no">✕ 금지</span> 철수세미, 일반 수세미, 연마 파우더 — <strong>가루 묻은 채로 문지르기</strong></div>
              <div className="mat-reason">시멘트·석고 미세 가루가 스테인리스 위에 있는 상태에서 수세미로 문지르면 가루 입자가 연마재처럼 작용해 표면에 미세 스크래치를 낸다. 스크래치에 수분이 고이면 산화(녹)가 시작된다. <strong>반드시 물을 충분히 흘려 가루를 씻어낸 후에</strong> 세제로 닦아야 한다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">크롬·니켈 수전 (대림, 슈티에싱크)</div><div className="mat-location">욕실 2개소 · 주방 · 발코니</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 중성세제 + 극세사 천 only<br /><span className="no">✕ 금지</span> 스펀지, 수세미, 구연산 반복 사용, 연마제</div>
              <div className="mat-reason">크롬 도금은 표면이 매우 얇아 스펀지의 거친 면에도 미세 스크래치가 발생한다. 구연산은 1~2회는 괜찮지만 반복 사용하면 도금이 벗겨질 수 있다. 수전은 <strong>극세사 천만</strong> 사용하는 것이 원칙이다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">LX 장판 2.2T (모하비스톤)</div><div className="mat-location">거실 · 침실 3개 · 전실</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 중성세제 희석 물걸레 (꽉 짜서 사용), 극세사 걸레<br /><span className="no">✕ 금지</span> 구연산, 알칼리 세정제, 과도한 물청소</div>
              <div className="mat-reason">장판 비닐 표면은 UV 코팅층이 있다. 산성 세정제는 이 코팅을 열화시켜 광택이 사라지고 장기적으로 표면이 갈라진다. 이음매 사이로 과도한 수분이 들어가면 들뜨거나 곰팡이가 생긴다. 물걸레는 항상 꽉 짜서 습기만 남은 상태로 사용한다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">샷시 유리 (KCC 홈씨씨 5n)</div><div className="mat-location">거실 · 안방 · 침실 · 주방 · 전실 외창</div></div>
              <span className="badge badge-safe">구연산 가능</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 구연산수 스프레이 + 신문지, 유리 클리너, 중성세제 희석액<br /><span className="no">✕ 금지</span> 연마 수세미 (Double Low-E 코팅 손상 주의)</div>
              <div className="mat-reason">Low-E 유리는 표면에 금속 산화물 코팅이 있다. 연마재나 강한 마찰은 이 코팅을 벗긴다. 신문지는 잉크가 극세 섬유 역할을 해 줄무늬 없이 깨끗하게 닦인다. 프레임 홈(레일)은 물 전 청소기로 가루 먼저 제거가 핵심.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">탄성코트 발코니</div><div className="mat-location">전실 1개소 + 베란다 3개소</div></div>
              <span className="badge badge-dry">건식 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 마른 빗자루, 청소기, 마른 극세사<br /><span className="no">✕ 금지</span> 물걸레, 고압수, 세정제</div>
              <div className="mat-reason">탄성코트는 방수 도막재다. 아이러니하게도 표면에 물걸레를 닿히면 도막 위에 물이 고여 얼룩이 생기고 장기적으로 들뜬다. 분진 제거는 빗자루나 청소기로만 한다.</div>
            </div>
          </div>

        </div>

        <div className="callout">
          <strong>핵심 요약:</strong> 구연산(산성) → 타일, 유리에만 / 중성세제 → 가구, 장판, 싱크볼, 수전 / 건식 전용 → 벽지, 탄성코트 / <strong>시멘트 가루가 어디 있든 세제 기준은 재질이지 가루가 아니다.</strong>
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 2.5: 도배풀 잔여물 제거 ══ */}
      <div className="sec-header" id="sec-glue">
        <div className="sec-num">SPOT TREATMENT</div>
        <div className="sec-title">도배풀 잔여물 제거 — 재질별 공략법</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
        <div className="callout" style={{ marginTop: 0 }}>
          <strong>현장 확인 결과 (2026-04-16 방문):</strong> 걸레받이·샷시 주변·장판 이음새·유리·가구 도어 모서리에 투명한 도배풀 잔여물이 <strong>여러 곳</strong>에서 발견됐다. 시공 직후 1~2일 이내에는 쉽게 제거되지만 시간이 지날수록 난이도가 급격히 올라가므로 입주 청소 때 반드시 함께 처리한다.
        </div>
      </div>

      <div className="principles" style={{ marginTop: 16 }}>
        <div className="principle">
          <div className="principle-num green">1</div>
          <div className="principle-body">
            <div className="principle-title">미온수(35~40°C)로 녹인다 <span className="arrow">—</span> 뜨거운 물 아님, 찬물 아님</div>
            <div className="principle-desc">
              도배풀은 전분·메틸셀룰로오스(MC) 기반 <strong>수용성 접착제</strong>다. 미온수가 닿으면 5~10분 이내에 팽윤·연화되어 극세사로 닦이거나 플라스틱 카드로 벗겨진다.
            </div>
            <div className="principle-why">
              <strong>왜 미온수인가?</strong> 뜨거운 물(60°C+)은 PET 필름 가구(포그그레이)의 표면을 변색시키고, 샷시 Low-E 유리에 열충격 균열을 낼 수 있다. 반면 찬물은 풀을 풀어내지 못한다. <strong>35~40°C(손으로 만져 따뜻한 정도)</strong>가 재질 손상 없이 풀을 녹이는 최적 온도다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num amber">2</div>
          <div className="principle-body">
            <div className="principle-title">불려서 떼낸다 <span className="arrow">—</span> 마른 상태로 문지르지 않는다</div>
            <div className="principle-desc">
              미온수 적신 키친타월·극세사를 <strong>5~10분 덮어두어</strong> 충분히 불린 뒤, 플라스틱 스크래퍼(또는 쓰지 않는 신용카드)로 비스듬히 밀어낸다.
            </div>
            <div className="principle-why">
              <strong>왜?</strong> 굳은 풀을 마른 상태로 문지르면 풀 입자가 연마재처럼 작용해 장판·유리·PET 필름에 미세 흠집을 낸다.
              스테인리스 싱크볼에서 시멘트 가루 문지르면 안 되는 원리와 동일하다.
              <strong>금속 스크래퍼·철수세미·유리칼은 절대 금지</strong>. 플라스틱 카드만 쓴다.
            </div>
          </div>
        </div>

        <div className="principle">
          <div className="principle-num red">3</div>
          <div className="principle-body">
            <div className="principle-title">산성(구연산)은 풀을 <span className="arrow">→</span> 오히려 굳힌다</div>
            <div className="principle-desc">
              도배풀은 구연산·식초 등 산성 세정제와 만나면 <strong>단백질이 응고되듯 더 단단하게 굳어버린다</strong>(전분 변성). 반드시 <strong>미온수 또는 중성세제로만</strong> 제거한다.
            </div>
            <div className="principle-why">
              <strong>순서가 핵심이다.</strong> 구연산은 "굳은 시멘트 제거"엔 필수지만, 도배풀 위에 닿으면 역효과를 낸다.
              동일 표면(특히 타일·유리)에 시멘트 얼룩과 풀이 모두 있을 땐
              <strong> ① 미온수로 풀 먼저 제거 → ② 그 뒤 구연산으로 시멘트 처리</strong> 순서를 반드시 지킨다.
              반대 순서로 하면 풀이 굳어 영영 안 떨어진다.
            </div>
          </div>
        </div>
      </div>

      <div className="mat-section" style={{ marginTop: 20 }}>
        <div className="mat-grid">

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">실크 엠보 벽지 표면 (LX 베스티)</div><div className="mat-location">벽지 면 위에 <strong>직접</strong> 떨어진 풀 방울</div></div>
              <span className="badge badge-dry">최소 수분 or 도배사 호출</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 풀 방울 <strong>지름 3mm 이하, 개수 5개 이하</strong>일 때만 — 면봉 끝에 미온수 1방울만 묻혀 풀 위에만 <strong>점으로 눌러주고 30초 대기 → 마른 극세사로 살짝 닦아냄</strong><br /><span className="no">✕ 금지</span> 물걸레, 스프레이, 문지르기, 키친타월 습포, 풀 주변 벽지 문지르기</div>
              <div className="mat-reason">풀 면적이 크거나 굳은 지 며칠 된 경우 <strong>직접 제거 시도 금지</strong> — 벽지 엠보가 눌리거나 얼룩이 번져 영구 잔존한다. 이 범위는 <strong>시공 하자 보수</strong>에 해당하므로 도배사에게 부분 재시공을 요청한다(입주 전 발견 시 보통 무상). 판단 기준: <strong>"내가 이 벽지 한 롤을 살 용의가 있나?"</strong> — 아니면 직접 손대지 않는다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">LX 장판 2.2T (모하비스톤)</div><div className="mat-location">이음매 · 걸레받이 접합부 · 이사 동선</div></div>
              <span className="badge badge-safe">미온수 OK</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 미온수 적신 극세사 5~10분 덮기 → 플라스틱 카드로 비스듬히 밀기 → 중성세제 물걸레 마무리<br /><span className="no">✕ 금지</span> 금속 스크래퍼, 뜨거운 물, 구연산</div>
              <div className="mat-reason">장판 이음매와 걸레받이 접합부에 풀이 흘러 고인 경우가 가장 많다. UV 코팅층이 얇으므로 금속 스크래퍼는 스크래치 필발. 플라스틱 카드(안 쓰는 신용카드)를 <strong>45도 각도로 눕혀</strong> 밀어내면 코팅 손상 없이 벗겨진다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">샷시 유리 (KCC 홈씨씨 5n)</div><div className="mat-location">창 모서리 · 실리콘 접합부 주변</div></div>
              <span className="badge badge-safe">미온수 OK</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 미온수 스프레이 → 5분 대기 → 플라스틱 스크래퍼 45도로 밀기 → 구연산수 + 신문지 마무리<br /><span className="no">✕ 금지</span> 뜨거운 물(열충격 균열), 금속 유리칼, 아세톤</div>
              <div className="mat-reason">도배풀은 유리에서 가장 깔끔하게 제거된다. 단 Double Low-E 코팅이 있어 <strong>금속 유리칼은 절대 금지</strong> — 코팅이 긁혀 무지개 얼룩이 영구 잔존한다. 문구용 플라스틱 스크래퍼 또는 안 쓰는 카드를 사용한다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">샷시 프레임 · 레일</div><div className="mat-location">창틀 레일 홈 · 프레임 상하 이음부</div></div>
              <span className="badge badge-neutral">건식 → 미온수</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> ① 청소기 틈새노즐로 가루 먼저 흡입 → ② 미온수 적신 면봉·칫솔로 홈 세척 → ③ 극세사로 마무리<br /><span className="no">✕ 금지</span> 가루 있는 상태에서 물 붓기 (풀+시멘트 가루가 엉겨 굳는다)</div>
              <div className="mat-reason">레일 홈엔 시멘트 가루와 도배풀이 섞여 있을 확률이 높다. 순서를 거꾸로 하면 가루+풀+물이 만나 콘크리트처럼 굳는 최악의 상황. <strong>반드시 건식 흡입이 먼저.</strong></div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">타일 / 줄눈</div><div className="mat-location">욕실 · 현관 · 주방 미드웨이 (시공 접합선)</div></div>
              <span className="badge badge-safe">미온수 → 구연산</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> <strong>① 미온수로 풀 먼저 제거 → ② 구연산 희석액으로 시멘트 잔여물 처리</strong> (순서 엄수)<br /><span className="no">✕ 금지</span> 구연산을 풀 위에 바로 뿌리기</div>
              <div className="mat-reason">타일에 풀과 시멘트가 함께 묻어있는 경우가 많다. 구연산(산)이 풀(전분)에 닿으면 풀이 응결되어 더 단단히 굳는다. <strong>순서를 반대로 하면 재작업이 몇 배로 힘들어진다.</strong></div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">걸레받이 · 아트월 몰딩</div><div className="mat-location">벽지-장판 접합부 상단 홈</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 미온수 극세사로 2~3회 닦기 → 굳은 부분은 플라스틱 카드<br /><span className="no">✕ 금지</span> 구연산, 연마 수세미, 알코올</div>
              <div className="mat-reason">도배 작업 중 풀이 가장 많이 흘러내리는 곳. 걸레받이 상단 홈(벽지와 만나는 부분)에 반드시 풀 자국이 있다고 가정하고 훑어본다. PVC 걸레받이는 산성에 약하므로 중성세제만.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">PET 가구 도어 (한솔 SB 포그그레이)</div><div className="mat-location">신발장 · 싱크대 · 키큰장 도어 엣지</div></div>
              <span className="badge badge-warn">중성 · 미지근 정도</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 미온수 담근 극세사로 30초 이내 짧게 대기 → 가볍게 닦기<br /><span className="no">✕ 금지</span> 뜨거운 물, 알코올, 아세톤, 시너, 구연산, 장시간 습포</div>
              <div className="mat-reason">포그그레이 PET 필름은 엣지(측면 이음매)에 풀이 잘 묻는다. 필름 코팅이 열과 용매 모두에 취약하므로 <strong>온도·시간·용매 세 가지를 모두</strong> 제한한다. 장시간 습포는 필름이 들뜰 수 있다.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">ABS 방문 · 천장몰딩 (예림 HP522)</div><div className="mat-location">문틀 상단 · 경첩 주변 · 천장 몰딩 하단</div></div>
              <span className="badge badge-warn">중성 전용</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 미온수 + 중성세제 희석 극세사<br /><span className="no">✕ 금지</span> 알코올, 아세톤 (ABS 백화 — crazing 현상)</div>
              <div className="mat-reason">문틀 상단과 경첩 근방은 도배 시 풀이 튀기 쉬운 위치. 알코올 계열 세정제는 ABS 표면을 뿌옇게 만드는 크레이징(미세 균열)을 유발한다. 한 번 생기면 복구 불가.</div>
            </div>
          </div>

          <div className="mat-card">
            <div className="mat-card-header">
              <div><div className="mat-name">스위치 · 콘센트 커버 (르그랑 아펠라)</div><div className="mat-location">스위치 테두리 · 콘센트 플레이트 엣지</div></div>
              <span className="badge badge-dry">최소 수분 + 전기주의</span>
            </div>
            <div className="mat-card-body">
              <div className="mat-detail"><span className="ok">✓ 가능</span> 해당 회로 차단 → 극세사 끝에 미온수 소량만 → 조심스럽게 닦기<br /><span className="no">✕ 금지</span> 스프레이 직접 분사, 물 흐를 정도 적시기, 커버 안쪽 적시기</div>
              <div className="mat-reason">스위치·콘센트 테두리는 도배 마감선과 붙어있어 풀이 묻기 쉽다. <strong>내부 접점에 수분 유입 시 단락(short) 위험</strong>이 있으므로 반드시 해당 차단기를 내리고 작업한다. 플레이트만 분리 가능하면 탈거 후 세척이 가장 안전.</div>
            </div>
          </div>

        </div>

        {/* ══ 벽지 근처 작업 결정 가이드 ══ */}
        <div className="room-card" style={{ marginTop: 20 }}>
          <div className="room-header"><span className="room-icon">🎯</span><span className="room-name">벽지 근처 도배풀 — 위치별 결정 가이드</span><span className="room-note">가장 중요</span></div>
          <div className="room-body">
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 12 }}>
              "물을 써야 풀이 녹지만, 벽지엔 물을 대면 안 된다"는 모순처럼 보이는 상황이다. <strong>핵심은 풀의 위치</strong>다. 벽지 표면에 있는지, 인접 자재에 있는지, 이음매에 있는지에 따라 방법이 완전히 달라진다. 먼저 위치를 4가지로 분류하고 거기에 맞게 움직인다.
            </div>

            <ul className="step-list">
              <li>
                <span className="step-n red">A</span>
                <span className="step-text">
                  <strong>벽지 표면 위에 떨어진 풀 방울</strong><br />
                  <span style={{ color: 'var(--ink3)', fontSize: 12 }}>
                    크기 3mm 이하·개수 적음 → 위 「실크 엠보 벽지 표면」 카드대로 면봉 + 1방울 미온수 점치기.<br />
                    크기 크거나 면적이 넓음 → <strong>건드리지 말고 도배사 부분 재시공 요청</strong>. 직접 시도하면 얼룩이 번져 더 큰 면적을 재시공하게 된다.
                  </span>
                </span>
              </li>
              <li>
                <span className="step-n">B</span>
                <span className="step-text">
                  <strong>벽지와 인접 자재 접합선 — 이음매(걸레받이 상단·천장 몰딩 하단·샷시 실리콘 라인)</strong><br />
                  <span style={{ color: 'var(--ink3)', fontSize: 12 }}>
                    ① <strong>벽지 쪽 1~2cm를 두꺼운 종이·왁스지·플라스틱 카드로 가리고 마스킹 테이프로 고정</strong> → 물리적 차폐.<br />
                    ② <strong>면봉에 미온수 1방울</strong>을 묻혀 풀 위에만 점으로 녹인다 (스프레이 X, 극세사 X).<br />
                    ③ 풀이 불면 면봉을 <strong>벽지 반대쪽으로만</strong> 굴려서 걷어낸다 (절대 벽지 방향으로 쓸지 않는다).<br />
                    ④ 작업 후 차폐물 제거 → 벽지 밑단에 <strong>마른 극세사·키친타월</strong> 깔아 흘러든 수분 흡수 확인.
                  </span>
                </span>
              </li>
              <li>
                <span className="step-n">C</span>
                <span className="step-text">
                  <strong>벽지에서 흘러내려 인접 자재(걸레받이·장판·몰딩·샷시·가구 상부)에 떨어진 풀</strong><br />
                  <span style={{ color: 'var(--ink3)', fontSize: 12 }}>
                    ① 벽지 밑단에 <strong>마른 키친타월을 일자로 깔아둔다</strong> — 수분이 벽지 쪽으로 역류하는 것을 방지하는 차단선.<br />
                    ② 해당 자재의 재질 카드(장판·걸레받이·샷시 등)에 맞춰 미온수 습포 → 제거.<br />
                    ③ 닦을 때는 <strong>반드시 벽지 반대 방향으로</strong> 쓸어낸다. 벽지 쪽으로 쓸면 수분이 역류한다.<br />
                    ④ 극세사·키친타월은 <strong>꽉 짜서 물이 떨어지지 않는 상태</strong>로만 사용.
                  </span>
                </span>
              </li>
              <li>
                <span className="step-n">D</span>
                <span className="step-text">
                  <strong>벽지에서 2cm 이상 떨어진 자재(가구 도어 중앙·유리 중앙·타일 중앙 등)의 풀</strong><br />
                  <span style={{ color: 'var(--ink3)', fontSize: 12 }}>
                    일반 재질 카드 그대로 적용. 특별한 벽지 차폐 불필요. 단 <strong>스프레이를 쓸 때는 벽지 방향으로 절대 분사하지 않는다</strong> — 미세 입자가 공중으로 튄다. 스프레이 노즐은 항상 벽지 반대쪽으로 향하게.
                  </span>
                </span>
              </li>
            </ul>

            <div style={{ background: '#fef3e2', borderLeft: '3px solid #b85c00', padding: '10px 12px', borderRadius: '0 4px 4px 0', marginTop: 12, fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7 }}>
              <strong>물리적 차폐물 준비:</strong> 두꺼운 도화지나 A4 크기 플라스틱 판(다이소 투명 클리어파일 표지), 왁스지(유산지), 마스킹 테이프(3M 저점착 — 벽지에 자국 안 남는 종류). 벽지와 맞닿는 부분은 <strong>저점착 테이프만</strong> — 일반 청테이프는 벽지 표면을 뜯어간다.
            </div>

            <div style={{ background: '#fff5f5', borderLeft: '3px solid var(--accent)', padding: '10px 12px', borderRadius: '0 4px 4px 0', marginTop: 10, fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7 }}>
              <strong>판단 기준 — 도배사 호출 vs 직접 작업:</strong> 풀이 <strong>벽지 표면에 있고</strong> 「3mm 이상 / 5개 이상 / 굳은 지 며칠 경과 / 엠보 깊숙이 스며듦」 중 <strong>하나라도 해당</strong>하면 직접 손대지 않고 시공사·도배사에 연락한다. 입주 전 하자 접수 범위이므로 무상 보수 대상일 가능성이 높다. 직접 시도 후 얼룩이 생기면 본인 과실이 되어 보수 거부당할 수 있다.
            </div>
          </div>
        </div>

        <div className="prohib-box" style={{ margin: '16px 0 0' }}>
          <div className="prohib-title">⛔ 도배풀 제거 시 절대 금지</div>
          <ul className="prohib-list">
            <li><strong>실크 벽지에 물걸레/스프레이로 풀 녹이기</strong> — 벽지 얼룩 영구 잔존, 부분 재시공 외 복구 불가</li>
            <li><strong>뜨거운 물(60°C+) 직접 사용</strong> — PET 필름 변색, 유리 열충격 균열, 실크 벽지 코팅 손상</li>
            <li><strong>구연산·식초로 풀 녹이려 하기</strong> — 전분 응결로 풀이 오히려 단단해짐. 순서를 지키지 않으면 재작업 불가</li>
            <li><strong>아세톤·시너·알코올 등 유기용매 사용</strong> — PET/ABS 표면 백화, 필름 녹아내림</li>
            <li><strong>금속 스크래퍼·유리칼·철수세미로 굳은 풀 긁기</strong> — 장판·유리·도장면 미세 흠집 (특히 Low-E 유리는 코팅 벗겨짐)</li>
            <li><strong>샷시 레일에 물부터 붓기</strong> — 시멘트 가루·풀·물이 엉겨 콘크리트처럼 굳음. 반드시 건식 흡입 먼저</li>
            <li><strong>스위치·콘센트에 스프레이 직접 분사</strong> — 내부 단락 위험. 반드시 차단기 내리고 극세사로만</li>
          </ul>
        </div>

        <div className="callout">
          <strong>🔦 발견 팁:</strong> 도배풀은 말라도 투명~반투명이라 정면에서 잘 안 보인다. <strong>휴대폰 플래시를 45도 각도로 비스듬히</strong> 비추며 벽·장판·유리 표면을 훑으면 번들거리는 풀 자국이 선명하게 드러난다. 입주 청소 <strong>시작 전</strong> 전 공간을 한 번 훑어 풀 위치를 방별로 메모해두면 작업 누락이 없고, 미온수 습포를 미리 올려둔 뒤 다른 청소를 병행할 수 있어 효율이 크게 올라간다.
        </div>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 3: 공간별 청소 순서 ══ */}
      <div className="sec-header" id="sec-rooms">
        <div className="sec-num">PRINCIPLE 03</div>
        <div className="sec-title">공간별 청소 순서 상세 가이드</div>
      </div>

      <div className="room-section">

        {/* 욕실 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🚿</span><span className="room-name">욕실 2개소 (거실욕실 · 안방욕실)</span><span className="room-note">Day 1 오전 최우선</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n red">1</span><span className="step-text"><strong>환풍기 켜기</strong> — 청소 내내 가동해 분진 배출</span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>SMC 천장</strong>: 마른 극세사로 위→아래 닦기 (물 쓰기 전 가루 제거)</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>벽타일 건식</strong>: 청소기 브러시 헤드로 타일 면·줄눈 홈 가루 제거</span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>욕실장·거울장</strong>: 중성세제 + 극세사. 내부 서랍 꺼내서 뒤집어 털기</span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>세면대·수전</strong>: 물 충분히 흘려 가루 제거 → 중성세제 + 극세사. 수전은 극세사만<em>가루 먼저 흘리기</em></span></li>
              <li><span className="step-n">6</span><span className="step-text"><strong>양변기</strong>: 물 내려 내부 확인 → 변기 세정제로 솔 청소 → 외부는 중성세제 + 극세사</span></li>
              <li><span className="step-n">7</span><span className="step-text"><strong>벽타일 습식</strong>: 구연산 희석액으로 닦기. 굳은 시멘트는 습포 10~15분 후 제거<em>구연산 가능</em></span></li>
              <li><span className="step-n">8</span><span className="step-text"><strong>바닥타일</strong>: 구연산 희석액으로 줄눈까지. 유가(트렌치) 주변 꼼꼼히</span></li>
              <li><span className="step-n">9</span><span className="step-text"><strong>배수 확인</strong>: 물 흘려 배수 방향·속도 확인 (시공 확인 겸)</span></li>
              <li><span className="step-n">10</span><span className="step-text"><strong>건조</strong>: 환풍기 30분 이상 가동 후 문 열어두기</span></li>
            </ul>
          </div>
        </div>

        {/* 주방 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🍳</span><span className="room-name">주방 / 식당</span><span className="room-note">Day 1 오후</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n">1</span><span className="step-text"><strong>후드 내부</strong>: 후드 가동해 분진 배기 → 내부 극세사로 닦기</span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>상부장 위쪽·상단</strong>: 청소기 → 마른 극세사 (가장 분진 많은 곳)</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>상부장·하부장·냉장고장 내부</strong>: 서랍·선반 꺼내서 털기 → 중성세제 극세사<span className="warn-em">PET: 중성만</span></span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>LED 스트랩조명</strong>: 불 켜서 확인 → 마른 극세사로 먼지만 (물 절대 닿으면 안됨)</span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>미드웨이 타일</strong>: 청소기 건식 → 구연산 희석액으로 닦기<em>구연산 가능</em></span></li>
              <li><span className="step-n">6</span><span className="step-text"><strong>인조대리석 상판</strong>: 물 충분히 흘려 가루 제거 → 중성세제 + 부드러운 스펀지<span className="warn-em">구연산 절대 금지</span></span></li>
              <li><span className="step-n">7</span><span className="step-text"><strong>싱크볼</strong>: 물 흘려 가루 제거 → 중성세제 + 부드러운 스펀지<em>가루 먼저 흘리기</em></span></li>
              <li><span className="step-n">8</span><span className="step-text"><strong>싱크 수전 (슈티에싱크 니켈)</strong>: 물 흘리기 → 극세사 천으로 중성세제 닦기</span></li>
              <li><span className="step-n">9</span><span className="step-text"><strong>현관 가벽 석고면</strong>: 마른 극세사로 먼지 닦기 (도배 안 된 면 있으면 건식만)</span></li>
            </ul>
          </div>
        </div>

        {/* 거실 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🛋️</span><span className="room-name">거실</span><span className="room-note">Day 1 오후</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n">1</span><span className="step-text"><strong>라인조명 박스 목공면·다운라이트 주변</strong>: 마른 붓으로 가루 털기 → 청소기</span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>커튼박스 T5 간접조명 홈</strong>: 마른 붓 → 청소기 (목공 박스 홈에 분진 집중)</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>천장 몰딩 (예림 HP522)</strong>: 붓 → 청소기 → 중성세제 극세사 (ABS 수지 재질)</span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>벽지</strong>: 청소기 브러시 헤드 → 돼지털 붓 → 마른 극세사 두드리기<span className="warn-em">물 절대 금지</span></span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>스위치·콘센트 (르그랑 아펠라)</strong>: 마른 극세사. 틈새는 붓으로 (전기 주의)</span></li>
              <li><span className="step-n">6</span><span className="step-text"><strong>걸레받이</strong>: 청소기 → 중성세제 물걸레</span></li>
              <li><span className="step-n">7</span><span className="step-text"><strong>장판</strong>: 청소기 전체 → 꽉 짠 중성세제 물걸레<em>마지막 순서</em></span></li>
            </ul>
          </div>
        </div>

        {/* 침실 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🛏️</span><span className="room-name">침실 3개 · 드레스룸</span><span className="room-note">Day 2 오전</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n">1</span><span className="step-text"><strong>단열 벽체 목공 마감면</strong> (입구방·주방옆방): 마른 극세사로 석고 가루 닦기</span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>다운라이트 주변 천장</strong>: 마른 붓 → 청소기</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>ABS 방문 (예림 HP522)</strong>: 중성세제 + 극세사. 문 위 상단은 분진 가장 많음</span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>도무스 손잡이 (스테인리스)</strong>: 극세사 천으로만 닦기</span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>벽지</strong>: 청소기 브러시 → 붓 → 마른 극세사<span className="warn-em">물 금지</span></span></li>
              <li><span className="step-n">6</span><span className="step-text"><strong>드레스룸 내부</strong>: 선반·행거 등 청소기 → 중성세제 극세사</span></li>
              <li><span className="step-n">7</span><span className="step-text"><strong>장판</strong>: 청소기 → 꽉 짠 중성세제 물걸레 (항상 마지막)</span></li>
            </ul>
          </div>
        </div>

        {/* 현관 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🚪</span><span className="room-name">현관 · 전실</span><span className="room-note">Day 2 오전</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n">1</span><span className="step-text"><strong>현관 신발장·벤치장 (PET 포그그레이)</strong>: 선반 꺼내서 털기 → 중성세제 극세사<span className="warn-em">구연산 금지</span></span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>전신 거울 도어</strong>: 유리클리너 또는 구연산수 + 신문지</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>현관문 필름 (포그그레이)</strong>: 중성세제 극세사 — 문 위쪽·경첩 주변 분진 집중<span className="warn-em">구연산 금지</span></span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>히든센서 감지기</strong>: 마른 극세사로 먼지만 (물 절대 금지)</span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>현관 바닥타일</strong>: 청소기 → 구연산 희석액<em>구연산 가능</em></span></li>
            </ul>
          </div>
        </div>

        {/* 중문·샷시 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🪟</span><span className="room-name">중문 · 샷시 전체</span><span className="room-note">Day 2 오후</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n">1</span><span className="step-text"><strong>레일 홈 건식</strong>: 청소기 틈새 노즐로 가루 흡입 (핵심 — 물 전 반드시)</span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>레일 홈 습식</strong>: 물 적신 화장지를 채워 5분 → 칫솔로 긁어냄</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>프레임</strong>: 중성세제 + 극세사 (흰색/화이트 프레임 — 중성만)</span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>중문 투명 유리</strong>: 구연산수 스프레이 + 신문지<em>구연산 가능</em></span></li>
              <li><span className="step-n">5</span><span className="step-text"><strong>샷시 유리 전체</strong>: 구연산수 + 신문지. 다중창은 안쪽→바깥쪽 순서로</span></li>
              <li><span className="step-n">6</span><span className="step-text"><strong>터닝도어 미스트 유리</strong>: 구연산수 + 극세사 (신문지 대신 극세사 권장 — 무늬 유리)</span></li>
            </ul>
          </div>
        </div>

        {/* 발코니 */}
        <div className="room-card">
          <div className="room-header"><span className="room-icon">🌿</span><span className="room-name">발코니 (거실 앞 · 전실)</span><span className="room-note">Day 2 오후 — 항상 마지막</span></div>
          <div className="room-body">
            <ul className="step-list">
              <li><span className="step-n red">!</span><span className="step-text"><strong>발코니는 반드시 마지막</strong> — 청소 중 분진이 실내에서 발코니 쪽으로 밀려나오기 때문</span></li>
              <li><span className="step-n">1</span><span className="step-text"><strong>탄성코트 벽면·천장</strong>: 마른 빗자루·청소기만. 물걸레 절대 금지<span className="warn-em">건식 전용</span></span></li>
              <li><span className="step-n">2</span><span className="step-text"><strong>거실 앞베란다 장판 (서비스 시공)</strong>: 청소기 → 꽉 짠 중성세제 물걸레</span></li>
              <li><span className="step-n">3</span><span className="step-text"><strong>발코니 조명 (슬림원형 3개소)</strong>: 마른 극세사로 먼지만</span></li>
              <li><span className="step-n">4</span><span className="step-text"><strong>세탁기 냉온수 수전</strong>: 중성세제 + 극세사</span></li>
            </ul>
          </div>
        </div>

      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 4: 추천 용품 ══ */}
      <div className="sec-header" id="sec-supplies">
        <div className="sec-num">SUPPLY LIST</div>
        <div className="sec-title">추천 용품 목록 (다이소 + 마트)</div>
      </div>

      <div className="supply-section">
        <table className="supply-table">
          <thead>
            <tr><th>용품</th><th>용도</th><th>구매처 / 비고</th></tr>
          </thead>
          <tbody>
            <tr><td>극세사 천 대형<br /><span className="supply-tag must">필수</span></td><td>가구·장판·수전 등 거의 모든 표면 닦기. 10장 이상 준비. 용도별로 색 구분해두면 좋음</td><td>다이소 (10장 세트) / 오염되면 즉시 교체</td></tr>
            <tr><td>돼지털 붓 (페인트 붓형)<br /><span className="supply-tag must">필수</span></td><td>실크 엠보 벽지 홈 분진 제거. 넓은 면은 넓은 붓, 창틀 레일은 작은 붓</td><td>다이소 (2~3종 크기 구비)</td></tr>
            <tr><td>구연산 (500g)<br /><span className="supply-tag must">필수</span></td><td>타일·줄눈·유리 시멘트 잔여물 제거. 물 500ml + 구연산 1큰술로 희석</td><td>다이소 / 마트 세정용품 코너</td></tr>
            <tr><td>스프레이 공병 (500ml)<br /><span className="supply-tag must">필수</span></td><td>구연산수 담아서 타일·유리에 뿌리기</td><td>다이소 2개 구매 (구연산용 / 중성세제용 구분)</td></tr>
            <tr><td>중성 주방세제<br /><span className="supply-tag must">필수</span></td><td>가구, 장판, 싱크볼, 수전, 욕실집기 등 대부분의 습식 청소</td><td>기존 사용 제품 / 마트</td></tr>
            <tr><td>키친타월<br /><span className="supply-tag must">필수</span></td><td>타일 시멘트 습포용 (구연산 원액 적셔서 붙이기), 1회성 오염 제거</td><td>마트 대용량</td></tr>
            <tr><td>오래된 칫솔 여러 개</td><td>타일 줄눈 홈 청소, 창틀 레일 홈, 수전 기저부</td><td>집에 있는 것 활용 / 다이소 세트</td></tr>
            <tr><td>플라스틱 스크래퍼 / 안 쓰는 카드<br /><span className="supply-tag must">필수</span></td><td>도배풀 제거용. 금속 스크래퍼 절대 금지 → 장판·유리·PET 필름 스크래치. 유리용 문구점 플라스틱 스크래퍼 또는 오래된 신용카드 2~3장</td><td>다이소 문구코너 / 집에 있는 카드</td></tr>
            <tr><td>면봉 (대용량)<br /><span className="supply-tag must">필수</span></td><td>도배풀 제거 — 샷시 레일 홈, 스위치 테두리, 문틀 경첩 주변 등 좁은 홈 전용. 미온수 적셔 사용</td><td>다이소</td></tr>
            <tr><td>전기주전자 / 보온병</td><td>도배풀 제거용 미온수(35~40°C) 공급. 뜨거운 물 아님 — 끓인 물을 식히거나 따뜻한 물에 희석해서 손으로 만져 따뜻한 정도로 맞춤</td><td>보유 주전자 활용</td></tr>
            <tr><td>저점착 마스킹 테이프 (3M)<br /><span className="supply-tag must">벽지 근처 필수</span></td><td>벽지 근처 도배풀 작업 시 벽지 차폐물 고정용. <strong>일반 청테이프·박스테이프 금지</strong> — 벽지 표면 뜯어감. 3M 저점착(파란색 페인터스 테이프 류)만</td><td>다이소 / 철물점 페인트 코너</td></tr>
            <tr><td>왁스지(유산지) 또는 두꺼운 도화지</td><td>벽지 근처 작업 시 물리적 차폐물. A4 크기로 잘라 벽지 밑단·모서리 가림. 플라스틱 클리어파일 표지로 대체 가능</td><td>집에 있는 것 활용 / 다이소</td></tr>
            <tr><td>청소기 (틈새노즐 필수)</td><td>전 공간 건식 분진 제거 1차 작업. 없으면 모든 작업이 2배 힘들어짐</td><td>보유 청소기에 틈새 노즐 확인</td></tr>
            <tr><td>신문지</td><td>유리·샷시 줄무늬 없이 닦기. 잉크가 극세 섬유 역할</td><td>버리기 전 신문지 모아두기</td></tr>
            <tr><td>욕실 세정제 (산성계)</td><td>욕실 바닥·벽 시멘트 잔여물 — 구연산 희석으로 대체 가능</td><td>다이소 / 룸바이홈 욕실청소제</td></tr>
            <tr><td>부드러운 스펀지</td><td>싱크볼·인조대리석 전용. 연마면 없는 것만 구매</td><td>다이소 — 「부드러운」 명시된 제품만</td></tr>
            <tr><td>고무장갑<br /><span className="supply-tag must">필수</span></td><td>구연산·세정제로부터 손 보호. 2인 각 1켤레씩</td><td>다이소</td></tr>
            <tr><td>KF94 마스크 (다수)<br /><span className="supply-tag must">필수</span></td><td>시멘트·석고 분진 흡입 방지. 전체 철거 집이라 분진 농도 매우 높음</td><td>마스크 10매 이상 준비</td></tr>
            <tr><td>보안경 (눈 보호)</td><td>천장 청소 시 분진이 눈으로 낙하. 특히 다운라이트 주변 청소 시 필요</td><td>다이소 작업용 보안경</td></tr>
            <tr><td>양동이 2개</td><td>1개: 세정액, 1개: 헹굼수. 항상 두 개로 운용해야 오염 교차 없음</td><td>다이소</td></tr>
          </tbody>
        </table>
      </div>

      <div className="spacer"></div>

      {/* ══ SECTION 5: 2인 주말 스케줄 ══ */}
      <div className="sec-header" id="sec-schedule">
        <div className="sec-num">SCHEDULE</div>
        <div className="sec-title">2인 주말 청소 타임라인</div>
      </div>

      <div className="schedule-section">

        <div className="sched-day-block">
          <div className="day-header d1">
            <span>DAY 1 — 토요일</span>
            <span className="day-badge">욕실 · 주방 · 거실</span>
            <span className="day-who">2인 풀가동</span>
          </div>
          <div className="time-row"><div className="time-cell">09:00</div><div className="task-cell"><strong>준비</strong> — 창문 전체 오픈(환기), 마스크·보안경·장갑 착용. 청소기·붓·극세사·구연산 등 용품 세팅. 구연산수 스프레이 미리 희석. <strong>전기주전자로 미온수(35~40°C) 준비</strong>.</div></div>
          <div className="time-row"><div className="time-cell">09:15</div><div className="task-cell"><span className="person-tag p-a">A</span><span className="person-tag p-b">B</span><strong>도배풀 위치 지도 작성</strong> — 휴대폰 플래시 45도 각도로 전 공간 훑기. 걸레받이·샷시 주변·장판 이음매·유리·가구 도어 엣지·스위치 테두리 집중 확인. 발견 즉시 미온수 적신 극세사 올려두고 다음 작업 진행 (불리는 시간 = 다른 청소 시간으로 활용).</div></div>
          <div className="time-row"><div className="time-cell">09:30</div><div className="task-cell"><span className="person-tag p-a">A</span><strong>거실욕실 전체 청소</strong> (천장→집기→타일→바닥 순)<br /><span className="person-tag p-b">B</span><strong>안방욕실 전체 청소</strong> 동시 진행</div></div>
          <div className="time-row"><div className="time-cell">11:30</div><div className="task-cell"><strong>욕실 완료 후 휴식 + 환풍기 계속 가동</strong></div></div>
          <div className="time-row"><div className="time-cell">12:00</div><div className="task-cell"><span className="person-tag p-a">A</span><strong>주방</strong> — 상부장 위부터 아래로, 인조대리석·싱크볼 마무리<br /><span className="person-tag p-b">B</span><strong>현관·전실 신발장·중문</strong> 가구 및 현관 타일</div></div>
          <div className="time-row"><div className="time-cell">14:30</div><div className="task-cell"><strong>점심 + 휴식</strong></div></div>
          <div className="time-row"><div className="time-cell">15:30</div><div className="task-cell"><span className="person-tag p-a">A</span><span className="person-tag p-b">B</span><strong>거실</strong> — 천장 목공 박스·다운라이트→벽지(건식)→걸레받이→장판 순서로 2인 협력</div></div>
          <div className="time-row"><div className="time-cell">18:00</div><div className="task-cell"><strong>Day 1 마무리</strong> — 거실 창문 오픈 유지, 욕실 문 열어 건조. 내일 필요한 용품 추가 구매 메모.</div></div>
        </div>

        <div className="sched-day-block">
          <div className="day-header d2">
            <span>DAY 2 — 일요일</span>
            <span className="day-badge">침실 · 샷시 · 발코니</span>
            <span className="day-who">2인 풀가동</span>
          </div>
          <div className="time-row"><div className="time-cell">09:00</div><div className="task-cell"><strong>환기 후 재시작</strong>. Day 1 결과 재확인 — 욕실 건조 상태, 줄눈 미처리 부분 확인.</div></div>
          <div className="time-row"><div className="time-cell">09:30</div><div className="task-cell"><span className="person-tag p-a">A</span><strong>침실 1 (주방옆방)</strong> — 단열 목공면 → 천장 → 벽지 → 장판<br /><span className="person-tag p-b">B</span><strong>침실 2 (입구방)</strong> — 동일 순서</div></div>
          <div className="time-row"><div className="time-cell">11:00</div><div className="task-cell"><span className="person-tag p-a">A</span><strong>침실 3 (우측하단)</strong><br /><span className="person-tag p-b">B</span><strong>드레스룸</strong></div></div>
          <div className="time-row"><div className="time-cell">13:00</div><div className="task-cell"><strong>점심 + 휴식</strong></div></div>
          <div className="time-row"><div className="time-cell">14:00</div><div className="task-cell"><span className="person-tag p-a">A</span><strong>샷시 전체</strong> — 레일 건식→습식, 유리 구연산+신문지 (7개 창호)<br /><span className="person-tag p-b">B</span><strong>중문 유리</strong> + 남은 스위치·콘센트 점검</div></div>
          <div className="time-row"><div className="time-cell">16:00</div><div className="task-cell"><span className="person-tag p-a">A</span><span className="person-tag p-b">B</span><strong>발코니 (반드시 마지막)</strong> — 탄성코트 건식만, 장판·수전 마무리</div></div>
          <div className="time-row"><div className="time-cell">17:00</div><div className="task-cell"><strong>최종 점검</strong> — 각 방 불 켜서 미처리 얼룩·분진 확인. 조명·수전·환풍기 작동 재확인. 전체 환기 후 입주 준비 완료.</div></div>
        </div>

        <div className="callout">
          <strong>청소 시작 전 꼭 확인:</strong> 전체 창문 오픈으로 분진 배출 환경을 먼저 만들고 시작하세요. 청소하는 내내 마스크는 절대 벗지 마세요 — 전체 철거 집의 분진 농도는 일반 청소보다 훨씬 높습니다. 창문 없이 밀폐 상태로 청소하면 오히려 분진이 재부유해서 온 집에 다시 쌓입니다.
        </div>
      </div>

      <div className="cleaning-footer">
        권선대우 325동201호 · 32평 B타입 · 156 SPACE DESIGN<br />
        입주 청소 완전 가이드 — 2인 주말 플랜
      </div>
    </div>
  )
}
