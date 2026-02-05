# GitHub Pages 배포 설정 가이드

## 문제 상황
Personal Access Token에 `workflow` 권한이 없어서 GitHub Actions 워크플로우를 푸시할 수 없습니다.

## 해결 방법: GitHub 웹 UI로 설정

### 1단계: Repository Settings
1. https://github.com/jiho5755-maker/brand-intro-page 접속
2. 상단 탭에서 **Settings** 클릭
3. 좌측 메뉴에서 **Pages** 클릭

### 2단계: GitHub Actions 활성화
4. **Source** 섹션에서:
   - Build and deployment
   - Source: **GitHub Actions** 선택 (드롭다운에서)

### 3단계: 워크플로우 파일 생성
5. 상단 탭에서 **Actions** 클릭
6. "set up a workflow yourself" 클릭
7. 파일명을 `deploy.yml`로 변경
8. 아래 코드를 전체 복사하여 붙여넣기:

```yaml
name: Deploy Partner Map to GitHub Pages

on:
  push:
    branches: [ main ]
    paths:
      - 'partnermap-v2/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Build
        run: |
          mkdir -p dist
          cp -r partnermap-v2/* dist/
          echo "Build completed successfully"

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

9. **Commit changes** 버튼 클릭 (우측 상단 초록색)
10. Commit message: "feat: Add GitHub Pages deployment workflow"
11. **Commit changes** 확인

### 4단계: 배포 확인
12. **Actions** 탭으로 이동
13. "Deploy Partner Map to GitHub Pages" 워크플로우 실행 확인
14. 완료되면 (✅ 초록색 체크) URL 확인:
    - https://jiho5755-maker.github.io/brand-intro-page/

### 5단계: 메이크샵 임베드
15. 메이크샵 관리자 접속
16. 디자인 관리 또는 게시판에 아래 코드 추가:

```html
<div style="width: 100%; max-width: 1400px; margin: 60px auto; padding: 0 20px;">
  <iframe
    src="https://jiho5755-maker.github.io/brand-intro-page/"
    width="100%"
    height="900"
    frameborder="0"
    scrolling="auto"
    loading="lazy"
    style="border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);"
    title="프레스코21 제휴 공방 지도"
    allow="geolocation">
  </iframe>
</div>
```

## 배포 후 확인사항

✅ **기능 테스트:**
- [ ] 지도가 정상적으로 로드되는지
- [ ] 필터 (카테고리/지역) 작동
- [ ] 검색 기능 작동
- [ ] GPS 위치 검색 작동
- [ ] 모달 상세보기 작동
- [ ] 모바일 반응형 확인

✅ **PWA 테스트:**
- [ ] 모바일에서 "홈 화면에 추가" 나타나는지
- [ ] 오프라인에서도 기본 UI 보이는지

✅ **메이크샵 연동:**
- [ ] iframe이 정상적으로 표시되는지
- [ ] GPS 권한 요청이 작동하는지

## 문제 해결

### 배포가 실패하면?
1. Actions 탭에서 에러 로그 확인
2. `partnermap-v2` 폴더 구조 확인
3. 파일 경로가 올바른지 확인

### URL이 작동하지 않으면?
1. Settings → Pages에서 URL 확인
2. 배포가 완료될 때까지 2-3분 대기
3. 브라우저 캐시 클리어 후 재시도

### iframe이 안 보이면?
1. 브라우저 콘솔에서 에러 확인
2. CORS 정책 확인
3. allow="geolocation" 속성 확인

## 추가 최적화 (선택사항)

나중에 시간이 되면:
1. 이미지 압축 (default-logo.jpg: 738KB → 50KB)
2. Google Analytics 연동
3. 커스텀 도메인 설정 (partnermap.fresco21.com)
4. Sentry 에러 모니터링

## 도움이 필요하면

claude를 호출해서 문제 상황을 설명하면 도와드릴게요!
