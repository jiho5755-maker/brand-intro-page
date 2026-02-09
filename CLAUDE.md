# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

프레스코21 브랜드 관련 웹 프로젝트 모음 (브랜드 헤리티지 페이지, 파트너맵, YouTube 연동)

**GitHub:** https://github.com/jiho5755-maker/brand-intro-page
**GitHub Pages:** https://jiho5755-maker.github.io/brand-intro-page/

## Project Structure

```
brand-intro-page/
├── 브랜드페이지/           # 메인: 브랜드 헤리티지 원페이지
│   ├── index.html
│   ├── css/heritage.css
│   ├── js/heritage.js
│   └── images/
├── partnermap-v2/         # 네이버 지도 API 파트너샵 지도
├── youtube-product-integration/  # YouTube 영상-제품 연동
└── _archive/              # 이전 작업물 보관
```

## Local Development

```bash
# 로컬 서버 실행
python3 -m http.server 8000

# 브랜드페이지 접속
open http://localhost:8000/브랜드페이지/

# 파트너맵 접속
open http://localhost:8000/partnermap-v2/
```

## Deployment URLs

| 프로젝트 | URL |
|----------|-----|
| 브랜드페이지 | https://jiho5755-maker.github.io/brand-intro-page/브랜드페이지/ |
| 파트너맵 v2 | https://jiho5755-maker.github.io/brand-intro-page/partnermap-v2/ |

## Architecture

### 브랜드페이지 (Main Project)

원페이지 브랜드 헤리티지 사이트. 11개 섹션으로 구성.

**기술 스택:**
- Vanilla JS (ES6+) with Intersection Observer API
- CSS3 Grid/Flexbox, CSS Variables, Animations
- Slick Carousel (저서 슬라이더)

**주요 기능 (heritage.js):**
- `initScrollAnimations()` - 타임라인 순차 reveal, stagger 효과
- `initGalleryFilter()` - 카테고리별 필터링
- `initTimelineModal()` - 클릭 시 상세 모달
- `initMobileDrawer()` - 햄버거 메뉴 드로워

**반응형 브레이크포인트 (heritage.css):**
- 1199px: 태블릿
- 991px: 드로워 활성화
- 767px: 모바일 레이아웃
- 480px: 초소형 모바일

**디자인 시스템:**
- Primary Color: `#2D5F4F` (녹색)
- Font: Pretendard
- Container: max-width 1440px

### partnermap-v2

네이버 지도 API 기반 제휴업체 지도. Google Apps Script로 스프레드시트 연동.

### youtube-product-integration

YouTube 영상과 쇼핑몰 제품을 자동 연동하는 시스템.

## Key Files

- `브랜드페이지/docs/PHASE2_UX_UI_COMPLETE.md` - Phase 2 개발 완료 보고서
- `_archive/INDEX.md` - 아카이브 폴더 인덱스
