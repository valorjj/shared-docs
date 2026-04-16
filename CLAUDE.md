shared-docs — 프로젝트 지침서
> Claude Code와 함께 이어가기 위한 컨텍스트 및 작업 가이드
***프로젝트 개요
개인 가이드 허브 웹앱. 신혼집 인테리어, 신혼여행, 대출, 주식 등 생활 정보를 독립적인 HTML 페이지로 관리하고, React 메인 화면에서 카드 뷰로 선택하는 구조.
배포: Vercel
스택: Vite + React + TypeScript
핵심 아이디어: 각 가이드는 순수 HTML 파일로 독립 존재. React는 메인 허브 역할만 담당.
***디렉토리 구조
shared-docs/
├── public/
│   ├── honeymoon_v5.html       ✅ 완성 (신혼여행 가이드)
│   ├── interior_check.html     🚧 미완성
│   ├── loan_guide.html         🚧 미완성
│   └── stock_guide.html        🚧 미완성
├── src/
│   ├── App.tsx                 ✅ 카드 메인 화면
│   ├── App.css                 ✅ 스타일
│   ├── main.tsx                (기본값 유지)
│   └── index.css               (기본값 유지)
├── index.html                  (기본값 유지)
├── vercel.json                 ✅ 라우팅 설정
├── package.json
└── vite.config.ts
***현재 완성된 것
✅ src/App.tsx — 메인 카드 허브
Noto Sans KR 폰트 적용
guides 배열로 카드 목록 관리
카드 클릭 → 해당 HTML 파일로 이동 (새 탭)
status 값에 따라 카드 활성/비활성 처리
카드 status 값:
값	의미	동작
`'done'`	완성	클릭 가능, 초록 뱃지
`'wip'`	작성 중	클릭 가능, 노란 뱃지
`'todo'`	준비 중	클릭 불가, 회색 뱃지
✅ public/honeymoon_v5.html — 신혼여행 가이드
파리·니스·바르셀로나 9박 10일 완전 가이드
A안(추천)/B안(일반) 토글 기능
10일 캘린더 뷰
모든 공식 링크 포함
Noto Sans KR 폰트, 지중해 컬러 팔레트
✅ vercel.json — 라우팅 설정
{
"rewrites": [
{ "source": "/((?!.*\\.html$).*)", "destination": "/index.html" }
]
}
.html 확장자 파일은 직접 서빙, 나머지는 React SPA로 처리.
***아직 해야 할 것
🚧 1. 나머지 HTML 가이드 작성
각 파일은 public/ 폴더에 위치해야 함.
파일명	제목	주요 내용
`interior_check.html`	인테리어 체크리스트	공정별 체크사항, 시공 메모, 업체 정보
`loan_guide.html`	대출 가이드	디딤돌 구조, 신생아 특례 조건, 갈아타기 타이밍
`stock_guide.html`	주식 투자 가이드	ISA, TIGER S&P500 ETF, 적립식 전략
HTML 파일 작성 규칙 (기존 honeymoon_v5.html과 동일한 스타일 유지):
<!-- 반드시 포함할 것 -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Noto+Serif+KR:wght@400;600&display=swap" rel="stylesheet">
<!-- 컬러 팔레트 기준 (CSS 변수로 정의) -->
<style>
:root {
  --cream: #F4EFE5;
  --text: #1C1916;
  --muted: #6B6660;
  /* 섹션 컬러는 주제에 맞게 선택 */
}
</style>
***🚧 2. App.tsx에서 카드 상태 업데이트
HTML 파일 완성 시 guides 배열에서 해당 항목 수정:
// src/App.tsx — guides 배열
{
  id: 'interior',
  emoji: '🏠',
  title: '인테리어 체크리스트',
  subtitle: '권선대우 아파트 리모델링',
  description: '공정별 체크사항 및 시공 메모.',
  href: '/interior_check.html',
  status: 'todo',   // ← 완성 후 'done' 또는 'wip'으로 변경
  tags: ['리모델링', '체크리스트'],
  color: 'teal',
},
***🚧 3. Vercel 배포 연결 (최초 1회)
# 1. GitHub에 push
git add .
git commit -m "init: guide hub"
git push origin main
# 2. vercel.com 접속
# → Add New Project → GitHub repo import
# → Framework: Vite (자동 감지)
# → Build Command: npm run build
# → Output Directory: dist
# → Deploy
이후 main 브랜치에 push하면 자동 재배포.
***새 가이드 추가 절차 (반복 작업)
1. public/ 폴더에 새 HTML 파일 추가
         ↓
2. App.tsx의 guides 배열에 항목 추가 or status 변경
         ↓
3. git add . && git commit -m "add: xxx 가이드" && git push
         ↓
4. Vercel 자동 배포 완료
***디자인 원칙
모든 HTML 가이드 파일은 아래 기준을 따름:
폰트: Noto Sans KR (본문), Noto Serif KR (제목)
배경: #F4EFE5 (warm cream)
텍스트: #1C1916 (거의 검정)
섹션 컬러: 주제별 고유 색상 (파리=네이비, 니스=청록, 바르셀로나=테라코타 등)
링크: 공식 사이트 링크는 반드시 포함, 버튼 스타일로 표시
반응형: 모바일에서도 읽기 편하게
***참고 — honeymoon_v5.html 주요 기능
향후 다른 HTML 파일 작성 시 참고할 패턴:
// 탭/플랜 전환 (JavaScript)
function selectPlan(p) {
  document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.plan-content').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('cal-' + p).classList.add('active');
  document.getElementById('plan-' + p).classList.add('active');
}
/* 도시/섹션별 컬러 구조 패턴 */
.city-paris { --acc: #1B3A5C; --bg: #E8F0F8; }
.city-nice  { --acc: #0B6E7A; --bg: #E4F5F7; }
.city-bcn   { --acc: #A84010; --bg: #FAF0E8; }
***메모
index.html (프로젝트 루트) — Vite 진입점. 건드리지 않아도 됨.
public/ 폴더의 파일은 빌드 시 dist/로 그대로 복사됨.
HTML 파일 내 외부 폰트, CDN 사용 가능 (Vercel 서빙 시 문제 없음).
로컬 확인: npm run dev → localhost:5173
