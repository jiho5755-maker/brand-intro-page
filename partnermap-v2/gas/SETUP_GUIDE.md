# 프레스코21 파트너 등록 자동화 시스템 설정 가이드

## 개요

이 시스템은 제휴 파트너 데이터 수집을 자동화합니다:
- 웹 폼 등록
- REST API
- 이메일 자동 파싱
- CSV 대량 업로드
- 조건부 자동 승인

## 1. Google Apps Script 설정

### 1.1 스크립트 생성

1. [Google Apps Script](https://script.google.com) 접속
2. "새 프로젝트" 클릭
3. `Code.gs` 파일에 `gas/Code.gs` 내용 복사
4. 파일 > 저장

### 1.2 스프레드시트 연결

1. Google Sheets에서 새 스프레드시트 생성
2. 이름: "프레스코21 파트너 관리"
3. Apps Script에서:
   - 확장 프로그램 > Apps Script 클릭
   - 또는 스크립트에서 스프레드시트 ID 직접 설정

### 1.3 초기 설정 실행

Apps Script 에디터에서:
```javascript
// 한 번만 실행
setupSpreadsheet();  // 시트 구조 생성
setupTriggers();     // 트리거 설정
```

### 1.4 스크립트 속성 설정

파일 > 프로젝트 설정 > 스크립트 속성:

| 속성 | 값 | 설명 |
|------|-----|------|
| `ADMIN_EMAIL` | your@email.com | 관리자 알림 수신 이메일 |
| `GOOGLE_MAPS_API_KEY` | (선택) | Geocoding API 키 |
| `DRIVE_FOLDER_ID` | (선택) | 이미지 업로드 폴더 ID |

### 1.5 웹 앱 배포

1. 배포 > 새 배포
2. 유형: 웹 앱
3. 실행 사용자: 본인
4. 액세스 권한: 모든 사용자
5. 배포 > URL 복사

## 2. Google Sheets 시트 구조

배포 후 자동 생성되는 시트:

| 시트 이름 | 용도 |
|-----------|------|
| 제휴업체 | 승인된 파트너 (API 제공) |
| 신청대기 | 신규 신청 (검토 중) |
| 거부보류 | 거부/보류된 신청 |
| 블랙리스트 | 차단된 업체/연락처 |
| 협회목록 | 인증된 협회 목록 |
| API키관리 | 외부 연동용 API 키 |
| 로그 | 모든 변경 이력 |

### 협회목록 시트 설정

| 협회명 | 상태 |
|--------|------|
| 한국압화협회 | 인증 |
| 대한플라워협회 | 인증 |

### API키관리 시트 설정

| API키 | 권한 | 상태 |
|-------|------|------|
| admin_key_xxx | 관리자 | 활성 |
| partner_key_xxx | 일반 | 활성 |

### 블랙리스트 시트 설정

| 값 | 타입 |
|-----|------|
| spam@example.com | email |
| 010-0000-0000 | phone |

## 3. 프론트엔드 설정

### 3.1 파트너 등록 페이지

`/partnermap-v2/register/index.html`

API_URL 수정:
```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

### 3.2 관리자 업로드 페이지

`/partnermap-v2/admin/upload.html`

API_URL 수정:
```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

### 3.3 파트너맵 메인 페이지

`/partnermap-v2/index.html`에 등록 버튼 추가:
```html
<a href="./register/" class="register-btn">파트너 등록 신청</a>
```

## 4. Google Forms 연동 (선택)

자체 폼 대신 Google Forms 사용 시:

1. Google Forms 생성
2. 질문 항목 설정:
   - 업체명 (필수)
   - 대표자명 (필수)
   - 연락처 (필수)
   - 이메일 (필수)
   - 주소 (필수)
   - 카테고리 (체크박스)
   - 협회 (드롭다운)
   - 소개 (장문형)

3. 스프레드시트 연결:
   - 응답 > 스프레드시트 > 기존 스프레드시트 선택

4. Apps Script 트리거:
   - 트리거 > 트리거 추가
   - 함수: `onFormSubmit`
   - 이벤트: 양식 제출 시

## 5. 이메일 자동 파싱 설정

### Gmail 라벨 생성

1. Gmail에서 "파트너신청" 라벨 생성
2. 필터 설정:
   - 제목에 "[파트너 신청]" 포함 → 라벨 적용

### 이메일 형식 안내

파트너에게 아래 형식으로 이메일 발송 안내:
```
제목: [파트너 신청] 업체명

본문:
업체명: OOO공방
주소: 서울시 강남구 테헤란로 123
연락처: 02-1234-5678
이메일: example@email.com
카테고리: 압화, 플라워디자인
협회: 한국압화협회
소개: 간단한 소개글...

첨부: 로고 이미지 (선택)
```

## 6. API 사용

### 파트너 등록 (POST)

```bash
curl -X POST \
  "https://script.google.com/.../exec" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "꽃공방 압화",
    "address": "서울시 강남구 테헤란로 123",
    "phone": "02-1234-5678",
    "email": "flower@example.com",
    "category": ["압화", "플라워디자인"],
    "association": "한국압화협회"
  }'
```

### 대량 업로드 (POST)

```bash
curl -X POST \
  "https://script.google.com/.../exec?action=bulk&apiKey=YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "partners": [
      {"name": "공방1", "address": "주소1", ...},
      {"name": "공방2", "address": "주소2", ...}
    ]
  }'
```

### 파트너 목록 조회 (GET)

```bash
curl "https://script.google.com/.../exec"
```

## 7. 조건부 자동 승인 규칙

### 자동 승인 조건 (모두 충족 시)
- 필수 필드 완성: 업체명, 주소, 연락처, 이메일, 카테고리
- 좌표 변환 성공
- 블랙리스트 미포함
- (보너스) 인증된 협회 소속

### 자동 거부 조건
- 최소 필드 미충족 (업체명, 주소, 연락처)
- 블랙리스트 포함

### 수동 검토 대상
- 필수 필드 일부 누락
- 좌표 변환 실패

## 8. 테스트

1. **폼 등록 테스트**
   - `/register/` 페이지에서 테스트 데이터 제출
   - Google Sheets "신청대기" 시트 확인
   - 자동 승인 로직 확인

2. **CSV 업로드 테스트**
   - `/admin/upload.html`에서 템플릿 다운로드
   - 테스트 데이터 입력
   - 업로드 실행 및 결과 확인

3. **이메일 파싱 테스트**
   - 지정된 형식으로 테스트 이메일 발송
   - 1시간 내 자동 처리 확인

## 9. 문제 해결

### CORS 오류
- Apps Script Web App은 기본적으로 CORS를 허용합니다.
- `no-cors` 모드 사용 시 응답 확인 불가

### Geocoding 실패
- Google Maps API 키 확인
- 주소 형식 확인 (도로명 주소 권장)
- 일일 API 쿼터 확인

### 이메일 파싱 실패
- Gmail 라벨 확인
- 이메일 형식 확인
- "파싱실패" 라벨에서 확인

## 10. 보안 권장사항

- API 키를 코드에 직접 포함하지 않기
- 관리자 API 키는 안전하게 보관
- 정기적으로 API 키 교체
- 블랙리스트 정기 업데이트
