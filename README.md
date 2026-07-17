# 달동이 경제모니터링 — 실시간 배포 가이드

정적 버전과 달리, 이 폴더는 **서버(API 함수)까지 포함**해서 값이 자동으로 갱신됩니다.
Netlify Drop이 아니라 **Vercel**에 올려야 해요(서버 함수가 Vercel에서 돌아감).

## 폴더 구성
```
index.html            프론트(대시보드) — API가 있으면 실시간, 없으면 샘플로 폴백
api/quotes.js         야후 파이낸스 시세 (지수·금·BTC·환율·원자재·VIX·섹터·옵션)
api/fred.js           FRED 매크로 (M2·연준자산·지급준비금·금리·실업 등) — 키 필요
api/telegram.js       텔레그램 공개 채널 최근 글 (@daldong_22)
api/feargreed.js      CNN 공포·탐욕 지수
vercel.json           함수 설정
```

## 1. FRED 무료 API 키 발급 (1분)
1. https://fred.stlouisfed.org 접속 → 우측 상단 **My Account** 가입/로그인
2. 로그인 후 https://fredaccount.stlouisfed.org/apikeys → **Request API Key**
3. 발급된 키(32자리)를 복사해 둡니다. (야후·텔레그램·CNN은 키가 필요 없음)

## 2. 이 폴더를 GitHub에 올리기
- GitHub에서 새 저장소(repo) 생성 → 이 폴더의 파일들을 그대로 업로드
- (터미널이 편하면: `git init && git add . && git commit -m init && git remote add origin <repo> && git push`)

## 3. Vercel 배포 (클릭 몇 번)
1. https://vercel.com 가입(깃허브 계정으로 로그인 추천)
2. **Add New… → Project** → 방금 만든 저장소 **Import**
3. 배포 설정은 기본값 그대로 → **Deploy**
4. 배포 후 **Project → Settings → Environment Variables** 로 이동
   - Name: `FRED_API_KEY` / Value: 1단계에서 받은 키 → **Save**
5. **Deployments → 최신 배포 → Redeploy** (환경변수 반영)
6. 끝. `https://<프로젝트>.vercel.app` 로 접속하면 값이 실시간으로 채워집니다.
   - 상단 배지가 **LIVE · 실시간**으로 바뀌면 정상.

## 4. 노션·유튜브·텔레그램에 뿌리기
- 노션: 페이지에서 `/embed` → 위 Vercel 주소 붙여넣기
- 유튜브 설명란 / 텔레그램 / 스레드: 주소를 링크로

## 참고 / 한계
- **자동 폴백**: 어떤 소스가 막히거나 느리면 그 모듈만 샘플값이 남고 나머지는 실시간으로 뜹니다. 앱이 통째로 깨지지 않아요.
- **캐시**: 시세 5분, FRED 1시간, 텔레그램 2분 캐시. 새로고침해도 야후가 매번 안 불려서 안정적입니다.
- **야후·텔레그램·CNN은 비공식**이라 가끔 막힐 수 있어요. 안정적인 상용 운영이 필요하면 유료 시세/캘린더 API로 교체하면 됩니다.
- **텔레그램 특정 주제(시황 브리핑)만** 뽑고 싶으면: 그 방 글에 해시태그(예: `#시황`)를 달고 `index.html`의 텔레그램 호출을 `/api/telegram?ch=daldong_22&tag=%23시황` 로 바꾸면 필터됩니다. 더 정확히는 텔레그램 봇 API(봇을 방에 넣고 message_thread_id로 필터)를 쓰면 됩니다.
- **경제지표 캘린더**: 실제값(FRED)은 자동화 가능하지만, 일정+예상치(컨센서스)는 별도 캘린더 API가 필요해 지금은 `index.html`의 `ECON` 설정을 직접 수정하는 방식입니다.
- **커스텀 도메인**: Vercel → Settings → Domains 에서 `dashboard.내도메인.com` 연결 가능.
