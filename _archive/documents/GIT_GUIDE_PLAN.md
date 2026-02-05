# Git 초보자를 위한 협업 가이드 (Notion 문서 작성)

## 현재 상태
- 프로젝트: `https://github.com/jiho5755-maker/brand-intro-page`
- 디자이너: Git 경험 없음
- 목표: 디자이너가 Git으로 협업할 수 있도록 가이드 작성

## 요구사항
1. Git 완전 초보자를 위한 협업 가이드
2. Notion MCP를 사용해서 Notion에 문서 작성
3. 단계별 스크린샷과 설명 포함

---

## Notion 문서 구조
```
📘 Git 협업 가이드 (초보자용)
├── 1️⃣ Git이란?
├── 2️⃣ 설치 및 설정
├── 3️⃣ GitHub 계정 생성
├── 4️⃣ 프로젝트 시작하기 (Clone)
├── 5️⃣ 기본 작업 흐름
├── 6️⃣ 협업 시 주의사항
├── 7️⃣ 명령어 치트시트
├── 8️⃣ 문제 해결
├── 9️⃣ 추천 도구
└── 🎯 실습 예제
```

---

## 작성할 내용

### 1. Git이란?
- Git과 GitHub의 차이
- 왜 사용하는지
- 기본 용어 설명 (repository, commit, push, pull, clone)

### 2. 설치 및 설정
**Windows:**
- Git 다운로드 (https://git-scm.com/)
- 설치 과정
- Git Bash 또는 VS Code 터미널 사용

**Mac:**
- Homebrew로 설치: `brew install git`
- 또는 Xcode Command Line Tools

**초기 설정:**
```bash
git config --global user.name "이름"
git config --global user.email "이메일@example.com"
```

### 3. GitHub 계정 생성
- GitHub.com 가입
- 프로필 설정

### 4. 저장소 클론하기
```bash
git clone https://github.com/jiho5755-maker/brand-intro-page.git
cd brand-intro-page
```

**설명:**
- `git clone`: 원격 저장소를 내 컴퓨터로 복사
- 저장소 URL은 프로젝트 관리자가 제공

### 5. 파일 수정 작업 흐름
**Step 1: 최신 코드 받기**
```bash
git pull
```

**Step 2: 파일 수정**
- 에디터(VS Code 등)로 HTML, CSS 수정
- 브라우저에서 index.html 열어서 확인

**Step 3: 변경사항 확인**
```bash
git status
```

**Step 4: 변경사항 스테이징**
```bash
git add .
# 또는 특정 파일만: git add index.html
```

**Step 5: 커밋 (변경사항 저장)**
```bash
git commit -m "헤더 색상 변경"
```

**Step 6: 원격 저장소에 업로드**
```bash
git push
```

### 6. 협업 시 주의사항
- 작업 시작 전 항상 `git pull` 먼저!
- 커밋 메시지는 명확하게 (무엇을 변경했는지)
- 자주 커밋하기 (작은 단위로)
- 충돌 발생 시 팀원과 상의

### 7. 자주 사용하는 명령어
```bash
git status          # 현재 상태 확인
git pull            # 최신 코드 받기
git add .           # 모든 변경사항 스테이징
git commit -m "메시지"  # 커밋
git push            # 업로드
git log             # 커밋 히스토리 확인
```

### 8. 문제 해결
**충돌(Conflict) 발생 시:**
1. 충돌 파일 열기
2. `<<<<<<<`, `=======`, `>>>>>>>` 표시 확인
3. 필요한 코드만 남기고 나머지 삭제
4. 저장 후 다시 add, commit, push

**실수로 잘못 커밋한 경우:**
```bash
git reset HEAD~1  # 마지막 커밋 취소 (변경사항은 유지)
```

### 9. 추천 도구
- **VS Code**: Git 통합 지원, 시각적 인터페이스
- **GitHub Desktop**: GUI 기반, 초보자 친화적
- **GitKraken**: 시각적으로 브랜치 관리

### 10. 실습 예제
**시나리오: 헤더 색상 변경하기**
1. `git pull` 실행
2. `css/heritage.css` 파일 열기
3. 색상 코드 변경
4. 저장
5. `git add css/heritage.css`
6. `git commit -m "헤더 배경색을 파란색으로 변경"`
7. `git push`

---

## 구현 단계

### 1. Notion MCP를 사용해서 페이지 생성
- 새 페이지 생성
- 제목: "Git 협업 가이드 - 초보자용"
- 위 내용을 섹션별로 작성

### 2. 포맷팅
- 코드 블록 사용 (bash 명령어)
- 토글 블록으로 단계별 설명
- 콜아웃으로 주의사항 강조
- 체크박스로 실습 체크리스트

### 3. 디자이너에게 전달
- Notion 페이지 링크 공유
- GitHub 저장소 collaborator로 추가

---

## 재시작 후 실행할 명령

1. Notion MCP 서버가 연결되었는지 확인:
   ```bash
   claude mcp list
   ```

2. Notion 페이지 생성 및 내용 작성 진행
