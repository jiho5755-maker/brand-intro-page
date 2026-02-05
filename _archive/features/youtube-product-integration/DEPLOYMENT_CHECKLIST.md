# 배포 체크리스트

YouTube-제품 자동 연동 시스템 배포 전 최종 점검 체크리스트입니다.

---

## 📋 배포 전 체크리스트

### 1. API 및 키 발급

- [ ] **YouTube Data API 키 발급**
  - [ ] Google Cloud Console 프로젝트 생성
  - [ ] YouTube Data API v3 활성화
  - [ ] API 키 생성 및 복사
  - [ ] API 키 제한 설정 (YouTube Data API v3만)

- [ ] **카카오 앱 키 발급**
  - [ ] Kakao Developers 앱 생성
  - [ ] Web 플랫폼 등록 (도메인 추가)
  - [ ] 카카오 로그인 활성화
  - [ ] JavaScript 키 복사

### 2. Google Apps Script 설정

- [ ] **프로젝트 생성 및 배포**
  - [ ] `youtube-proxy-v2.gs` 코드 복사
  - [ ] 프로젝트 이름: "YouTube Proxy v2"
  - [ ] 스크립트 속성에 `YOUTUBE_API_KEY` 추가
  - [ ] `testGetVideos()` 함수로 테스트 실행
  - [ ] 웹 앱으로 배포 (액세스: 모든 사용자)
  - [ ] 배포 URL 복사 및 보관

- [ ] **배포 URL 테스트**
  - [ ] 브라우저에서 배포 URL 접속
  - [ ] JSON 응답 확인 (status: "success")
  - [ ] 영상 4개 데이터 확인

### 3. 파일 설정

- [ ] **youtube-product.js 수정**
  - [ ] `CONFIG.googleScriptUrl` 변경 (배포 URL)
  - [ ] `CONFIG.maxVideos` 확인 (기본값: 4)
  - [ ] `CONFIG.debug` 확인 (배포 시 false)

- [ ] **youtube-product.html 수정**
  - [ ] `Kakao.init()` 부분에 JavaScript 키 입력
  - [ ] 카카오 SDK 로드 확인

- [ ] **product-mapping.json 수정**
  - [ ] 최소 10개 제품 정보 추가
  - [ ] 제품 이미지 경로 확인 (실제 경로)
  - [ ] 제품 링크 확인 (실제 branduid)
  - [ ] 키워드 매핑 추가
  - [ ] JSON 형식 검증 (jsonlint.com)

### 4. 메이크샵 업로드

- [ ] **파일 업로드**
  - [ ] `youtube-product.css` 업로드
    - 위치: `/design/jewoo/youtube-product-integration/`
    - 또는 메이크샵 관리자 > CSS 탭
  - [ ] `youtube-product.js` 업로드
    - 위치: `/design/jewoo/youtube-product-integration/`
    - 또는 메이크샵 관리자 > JS 탭
  - [ ] `product-mapping.json` 업로드
    - FTP로 업로드 (필수)
    - 위치: `/design/jewoo/youtube-product-integration/`

- [ ] **index.html 수정**
  - [ ] 삽입 위치 확인 (메인 배너 끝 ~ BEST ITEM 시작)
  - [ ] `youtube-product.html` 내용 복사
  - [ ] 메이크샵 관리자 > HTML 편집 > index.html
  - [ ] 붙여넣기 및 저장

---

## 🧪 테스트 체크리스트

### 1. 기능 테스트

- [ ] **YouTube 영상 로드**
  - [ ] 메이크샵 쇼핑몰 접속
  - [ ] Ctrl+F5 (강력 새로고침)
  - [ ] 영상 4개 정상 표시
  - [ ] 영상 썸네일 로드 확인
  - [ ] 영상 재생 확인

- [ ] **NEW 배지**
  - [ ] 3일 이내 영상에 NEW 배지 표시
  - [ ] 3일 이후 영상에는 배지 없음
  - [ ] 배지 스타일 확인 (빨간색 그라디언트)

- [ ] **조회수 표시**
  - [ ] 조회수 정상 표시 (예: 1.5만 조회)
  - [ ] 1만 이하는 천 단위 구분 (예: 5,432 조회)
  - [ ] 날짜 포맷팅 (오늘, 어제, N일 전)

- [ ] **제품 매칭**
  - [ ] 제품 정보 표시 (이미지, 이름, 가격)
  - [ ] "관련 제품 보기" 버튼 클릭
  - [ ] 제품 상세페이지로 이동 확인
  - [ ] 매칭 실패 시 영상만 표시 (에러 없음)

- [ ] **소셜 공유**
  - [ ] 카카오톡 공유 버튼 클릭
  - [ ] 카카오톡 앱/웹 열림 확인
  - [ ] 공유 카드 확인 (썸네일, 제목)
  - [ ] 페이스북 공유 버튼 클릭
  - [ ] 페이스북 공유 창 열림 확인

- [ ] **캐싱**
  - [ ] 첫 로드 시간 확인 (< 3초)
  - [ ] Ctrl+Shift+R (새로고침)
  - [ ] 두 번째 로드 시간 확인 (< 1초)
  - [ ] F12 > Network 탭에서 API 호출 확인
  - [ ] 캐시 사용 로그 확인 (Console)

### 2. 반응형 테스트

- [ ] **PC (1200px 이상)**
  - [ ] 2x2 그리드 레이아웃 확인
  - [ ] 영상 카드 정상 표시
  - [ ] 제품 정보 가로 배치 확인
  - [ ] 호버 효과 확인

- [ ] **태블릿 (768-1199px)**
  - [ ] 2x2 그리드 유지 확인
  - [ ] 패딩 조정 확인
  - [ ] 터치 인터랙션 확인

- [ ] **모바일 (767px 이하)**
  - [ ] 1열 세로 배치 확인
  - [ ] 제품 정보 세로 배치 확인
  - [ ] 소셜 공유 버튼 세로 배치 확인
  - [ ] 터치 인터랙션 정상

### 3. 성능 테스트

- [ ] **로딩 속도**
  - [ ] Lighthouse 실행 (F12 > Lighthouse)
  - [ ] Performance 점수 확인 (목표: 90+)
  - [ ] 첫 로드: < 3초
  - [ ] 캐시 로드: < 1초
  - [ ] 이미지 Lazy Loading 작동 확인

- [ ] **API 호출**
  - [ ] F12 > Network 탭
  - [ ] Google Apps Script 호출 1회 확인
  - [ ] YouTube Data API 직접 호출 없음 확인
  - [ ] 캐시 사용 시 API 호출 0회 확인

### 4. 크로스브라우저 테스트

- [ ] **Chrome (최신)**
  - [ ] 모든 기능 정상 작동
  - [ ] Console 에러 없음

- [ ] **Safari (iOS 14+)**
  - [ ] 모바일 Safari 테스트
  - [ ] 영상 재생 확인
  - [ ] 소셜 공유 확인

- [ ] **Firefox (최신)**
  - [ ] 모든 기능 정상 작동
  - [ ] Console 에러 없음

- [ ] **Edge (최신)**
  - [ ] 모든 기능 정상 작동
  - [ ] Console 에러 없음

### 5. 에러 처리 테스트

- [ ] **YouTube API 실패 시**
  - [ ] Google Apps Script URL을 잘못 입력
  - [ ] fallback 메시지 표시 확인
  - [ ] "YouTube 채널에서 직접 보기" 링크 작동

- [ ] **제품 매칭 실패 시**
  - [ ] 제품 코드 없는 영상 테스트
  - [ ] 영상만 표시 확인 (에러 없음)
  - [ ] Console에 "[Match] 매칭 실패" 로그

- [ ] **카카오 SDK 실패 시**
  - [ ] 카카오 앱 키를 잘못 입력
  - [ ] 공유 버튼 클릭 시 alert 표시
  - [ ] Console에 에러 로그

---

## 📊 최종 점검

### 1. 설정 확인

- [ ] **Google Apps Script**
  - [ ] 배포 URL 정확히 입력
  - [ ] API 키 설정 확인 (checkApiKey() 실행)
  - [ ] 채널 ID 정확히 입력

- [ ] **카카오 SDK**
  - [ ] JavaScript 키 정확히 입력
  - [ ] 도메인 등록 확인 (Kakao Developers)
  - [ ] 카카오 로그인 활성화 확인

- [ ] **제품 데이터**
  - [ ] 10개 이상 제품 정보 입력
  - [ ] 제품 이미지 경로 정확히 입력
  - [ ] 제품 링크 (branduid) 정확히 입력
  - [ ] JSON 형식 검증 완료

### 2. 문서 확인

- [ ] **README.md**
  - [ ] 빠른 시작 가이드 확인
  - [ ] 사용 방법 확인
  - [ ] 문제 해결 섹션 확인

- [ ] **IMPLEMENTATION_GUIDE.md**
  - [ ] 구현 단계 확인
  - [ ] 설정 방법 확인
  - [ ] 최적화 방법 확인

- [ ] **DEPLOYMENT_CHECKLIST.md**
  - [ ] 이 체크리스트 완료

### 3. 백업

- [ ] **로컬 백업**
  - [ ] 모든 파일 로컬 저장
  - [ ] Git 저장소에 커밋 (권장)
  - [ ] 버전 태그 지정 (v1.0)

- [ ] **메이크샵 백업**
  - [ ] index.html 백업
  - [ ] CSS 파일 백업
  - [ ] JS 파일 백업

- [ ] **설정 정보 백업**
  - [ ] Google Apps Script 배포 URL
  - [ ] YouTube Data API 키
  - [ ] 카카오 JavaScript 키
  - [ ] 메이크샵 FTP 정보

---

## ✅ 배포 완료 후 확인

### 1일 후

- [ ] YouTube 영상 자동 로드 확인
- [ ] 캐싱 정상 작동 확인
- [ ] Console 에러 없음 확인

### 1주일 후

- [ ] 새 영상 업로드 시 자동 반영 확인
- [ ] NEW 배지 정상 작동 확인
- [ ] 제품 매칭 정확도 확인 (목표: 80% 이상)
- [ ] API 사용량 확인 (Google Cloud Console)

### 1개월 후

- [ ] 전환율 통계 확인 (Google Analytics)
- [ ] 사용자 피드백 수집
- [ ] 개선 사항 검토

---

## 🚨 배포 후 체크리스트

- [ ] **모니터링 설정**
  - [ ] Google Analytics 이벤트 추적 설정
  - [ ] 에러 모니터링 설정 (Sentry 등)
  - [ ] 성능 모니터링 설정

- [ ] **유지보수 계획**
  - [ ] 주간 점검 일정 수립
  - [ ] 월간 백업 일정 수립
  - [ ] 분기 최적화 일정 수립

- [ ] **문서 업데이트**
  - [ ] 배포 날짜 기록
  - [ ] 설정 정보 업데이트
  - [ ] 변경 이력 기록

---

## 📞 문제 발생 시

### 긴급 연락처

- **Google Apps Script 문제**: [Google Apps Script 도움말](https://developers.google.com/apps-script)
- **YouTube API 문제**: [YouTube Data API 문서](https://developers.google.com/youtube/v3)
- **카카오 SDK 문제**: [Kakao Developers](https://developers.kakao.com/)
- **메이크샵 문제**: [메이크샵 고객센터](https://help.makeshop.co.kr/)

### 롤백 절차

1. 메이크샵 관리자 > HTML 편집
2. YouTube 섹션 제거
3. 저장
4. Ctrl+F5 (강력 새로고침)

---

## 🎉 배포 완료!

모든 체크리스트를 완료했다면 축하합니다!

이제 YouTube 영상을 업로드할 때마다 자동으로 사이트에 반영됩니다.

**마지막 체크:**
- [ ] YouTube 영상 설명에 `[제품코드: P1001]` 추가
- [ ] 10-15분 후 자동 반영 확인
- [ ] 팀원들에게 사용 방법 공유

---

**배포일**: _______________
**배포자**: _______________
**버전**: 1.0
**상태**: [ ] 성공 [ ] 실패 [ ] 보류

**비고**:
_______________________________________________
_______________________________________________
_______________________________________________
