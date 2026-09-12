# 📱 GitMobile AI (PocketAgent)

> **스마트폰과 모바일 기기에서 AI 에이전트를 활용해 클라우드/GitHub 프로젝트를 탐색하고, 자연어로 코드를 편집하여 원클릭으로 커밋 & PR을 올릴 수 있는 모바일 퍼스트 개발 어시스턴트 앱입니다.**

---

## 🌟 주요 기능

1. **모바일 퍼스트(Mobile-First) UI & PWA**:
   - 한 손 조작과 엄지 인터페이스에 최적화된 하단 탭 내비게이션
   - iOS 노치 및 Android Safe-Area 완벽 대응
   - 브라우저에서 '홈 화면에 추가' 시 네이티브 앱처럼 풀스크린 실행 (PWA 매니페스트 내장)
   - PC 구동 시 콘솔에 **QR 코드 자동 출력** → 스마트폰 카메라로 스캔하여 1초 만에 접속

2. **Gemini 기반 자율 코딩 에이전트 (Tool-Calling Loop)**:
   - **다단계 자율 도구 실행**:
     - `get_repo_structure`: 저장소 폴더 및 파일 트리 파악
     - `search_files`: 키워드 및 파일명 패턴 검색
     - `read_file`: 실제 소스 코드 조회
     - `propose_file_edit`: 변경 전/후 코드 및 신규 파일 생성 제안
   - **실시간 SSE 스트리밍**: AI 에이전트의 생각 과정(Thinking)과 도구 호출 내역을 실시간으로 확인

3. **모바일 최적화 비주얼 Diff 뷰어**:
   - 모바일 작은 화면에서도 한눈에 파악할 수 있는 통합 라인 단위 Diff (Unified Diff)
   - 추가된 코드(+)는 에메랄드 그린, 삭제된 코드(-)는 로즈 레드로 시각화
   - 파일별 변경사항 검토 및 개별 변경 취소(Discard) 지원

4. **원클릭 커밋 & Pull Request**:
   - AI가 Conventional Commit 규격에 맞춘 커밋 메시지 자동 제안
   - **현재 브랜치 직접 푸시** 또는 **신규 브랜치 생성 + GitHub Pull Request(PR)** 선택 가능
   - 푸시 완료 후 생성된 GitHub 커밋 및 PR 웹 링크 바로가기 제공

5. **인터랙티브 파일 브라우저**:
   - 저장소 내 파일 및 폴더 구조 실시간 탐색
   - 파일 내용 뷰어 및 코드 복사 기능
   - *"AI에게 이 파일 수정 요청하기"* 버튼을 통해 특정 파일의 개선/리팩토링을 즉시 에이전트에 위임

---

## 🚀 빠른 시작 (Quick Start)

### 1. 패키지 설치
```bash
# 루트 디렉터리에서 모든 의존성 설치
npm run install:all
```

### 2. 앱 실행 (서버 & 클라이언트 동시 실행)
```bash
npm run dev
```

실행 시 터미널에 아래와 같은 안내 배너와 **QR 코드**가 출력됩니다:
```
==================================================
🚀 GitMobile AI Backend Server running at:
   Local:   http://localhost:3001
   Network: http://192.168.0.15:3001

📱 Mobile Frontend available at:
   http://192.168.0.15:5173

📲 Scan this QR code on your smartphone to open:
==================================================
[ QR CODE ]
==================================================
```

### 3. 모바일 기기로 접속
1. 스마트폰이 PC와 **동일한 Wi-Fi**에 연결되어 있는지 확인합니다.
2. 스마트폰 기본 카메라 앱을 켜고 터미널의 **QR 코드를 스캔**하거나, 모바일 브라우저에 표시된 네트워크 URL(`http://<IP>:5173`)을 입력합니다.
3. (선택사항) 브라우저 공유 메뉴에서 **"홈 화면에 추가(Add to Home Screen)"**를 누르면 앱 아이콘이 생성되어 네이티브 앱처럼 사용할 수 있습니다.

---

## ⚙️ 환경 설정 (인증 키)

앱을 실행한 후 하단 **[설정]** 탭에서 입력하거나, 로컬 보안을 위해 `server/.env` 파일에 미리 등록할 수 있습니다:

1. **GitHub Personal Access Token (PAT)**:
   - [GitHub Tokens 설정 페이지](https://github.com/settings/tokens/new?scopes=repo,read:user)에서 발급 (`repo`, `read:user` 권한 체크)
   - 비공개/공개 저장소 읽기, 브랜치 생성, 커밋 푸시, PR 생성에 사용됩니다.

2. **AI 엔진 선택 (Gemini 또는 Ollama/로컬 AI)**:
   - **Google Gemini (클라우드)**:
     - [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 키 발급
     - `gemini-3.6`, `gemini-3.6-flash`, `gemini-2.0-flash` 등 최신 모델 지원 (지원 모델 자동 조회 버튼 제공)
   - **Ollama / 로컬 AI (OpenAI 규격)**:
     - 내 PC 또는 클라우드 GPU 서버(RunPod/Vast.ai 등)의 Ollama / vLLM 주소 입력 (예: `http://localhost:11434/v1` 또는 `https://my-server.com/v1`)
     - 추천 코딩 모델: `qwen2.5-coder:7b`, `deepseek-coder-v2:16b`, `llama3.1:8b`
     - 서버 모델 목록 조회 버튼으로 다운로드된 모델 자동 탐색 지원

---

## 📁 프로젝트 구조

```
remoteTask/
├── package.json              # 전체 프로젝트 통합 실행 스크립트
├── server/                   # 백엔드 API & AI 에이전트 서비스
│   ├── src/
│   │   ├── index.ts          # Express 서버 & IP/QR 코드 자동 생성
│   │   ├── types.ts          # 데이터 모델 및 이벤트 타입
│   │   └── services/
│   │       ├── githubService.ts # GitHub Octokit REST & Git Data API 연동
│   │       └── agentService.ts  # Gemini AI 자율 에이전트 도구 루프 & SSE
│   ├── test/                 # 백엔드 유닛 테스트 (diff, commit 검증)
│   ├── package.json
│   └── tsconfig.json
└── client/                   # 모바일 퍼스트 프론트엔드 (React + Tailwind)
    ├── public/
    │   ├── manifest.json     # PWA 모바일 앱 매니페스트
    │   └── logo.svg          # 앱 로고 아이콘
    ├── src/
    │   ├── App.tsx           # 메인 애플리케이션 & 탭 라우팅
    │   ├── main.tsx          # React 마운트 진입점
    │   ├── index.css         # Tailwind v4 및 Safe-Area 스타일
    │   ├── types.ts          # 프론트엔드 타입 정의
    │   ├── services/
    │   │   └── api.ts        # 백엔드 통신 & SSE 스트림 파서
    │   ├── utils/
    │   │   └── diffHelper.ts # 모바일 라인 단위 Unified Diff 계산 유틸
    │   └── components/
    │       ├── Header.tsx    # 상단 저장소/브랜치 상태 바
    │       ├── Navigation/   # 하단 모바일 엄지 내비게이션
    │       ├── Agent/        # AI 에이전트 대화 및 실시간 활동 스트림
    │       ├── Explorer/     # 저장소 파일 탐색기 및 코드 뷰어
    │       ├── Diff/         # 변경사항 Diff 검토 덱
    │       ├── Commit/       # 원클릭 커밋 & PR 전송 드로어
    │       └── Settings/     # 토큰 및 모델 설정
    ├── index.html            # 모바일 뷰포트 & 터치 최적화 메타태그
    ├── vite.config.ts        # Vite 설정 (0.0.0.0 바인딩 & 프록시)
    └── package.json
```

---

## 🧪 테스트 실행

```bash
# 백엔드 유닛 테스트 실행
npm test
```
- Line Diff 계산 무결성 테스트 (신규 생성, 줄 수정, 줄 삭제)
- CommitRequest 데이터 유효성 및 PR 파라미터 검증 테스트
