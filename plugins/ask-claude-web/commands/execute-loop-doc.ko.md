---
argument-hint: '"경로" [지시사항] [웹 클로드 검증] [항목마다 커밋] [Phase N만] [컨텍스트 N%까지]'
---
문서에 기술된 작업 계획을 순서대로 반복 실행한다. 사용자가 `$ARGUMENTS`에 경로와 지시사항을 입력한다.

## 대전제: 역할 구조

```
사용자 (대표)
  └─ 처음에 작업을 지시한다
  └─ 이후 끝날 때까지 개입하지 않는다 (최종 결과만 받는다)

웹 클로드 (중간 관리자)
  └─ 사용자의 지시를 받아 구체적인 작업 계획을 수립한다
  └─ 클로드 코드에게 "무엇을, 어떤 순서로, 어떤 관점에서" 작업할지 지시한다
  └─ 클로드 코드의 작업 결과를 검토하고 수정 지시 또는 승인한다
  └─ 모든 항목이 끝날 때까지 자율적으로 진행을 이끈다

클로드 코드 (실행자)
  └─ 웹 클로드의 지시에 따라 실제 작업을 수행한다
  └─ 작업 전 범위 우려가 있으면 WORK 시작 전에 제기한다
  └─ 작업 결과에 대해 의견을 개진할 수 있다
  └─ 웹 클로드와 이견이 있으면 합의될 때까지 논의한다
```

**핵심**: 사용자는 처음에 한 번 지시하고, 나머지는 웹 클로드가 끝까지 이끈다. 클로드 코드가 혼자 판단하고 혼자 진행하지 않는다. 단독 모드에서만 클로드 코드가 자체 판단으로 진행한다.

## 입력 파싱
- `$ARGUMENTS`에서 경로(파일 또는 디렉토리)와 자연어 지시사항을 분리
- 디렉토리면 README.md를 메인 문서로 간주
- "웹 클로드", "상의", "검증", "claude.ai", "의논", "리뷰", "같이" 등 키워드가 있으면 → 웹 클로드 검증 모드 활성화
- 사용자의 자연어 지시가 커맨드의 기본 동작보다 우선한다

## 0단계: 사전 체크 (작업 시작 전 — 사용자가 자리 뜨기 전에 확인)
사용자에게 먼저 안내:
> "작업을 시작하기 전에 필요한 조건을 확인하겠습니다."

### 문서 경로 확인 (필수)
- `$ARGUMENTS`에서 경로가 지정되었는지 확인
- 경로가 없거나 존재하지 않는 경로면 → 사용자에게 경로 요청 → 대기
- 디렉토리인 경우 README.md 존재 확인, 없으면 메인 문서가 뭔지 질문

### 웹 클로드 통신 스킬 (검증 모드일 때만)
웹 클로드와의 모든 통신은 `ask-claude-web` 스킬의 절차를 따른다.

### 웹 클로드 체크 (검증 모드일 때만)
순서대로 체크:
1. chrome-devtools MCP 연결 (`list_pages` 호출)
2. claude.ai 탭 존재 + 단일 여부
3. 입력창 접근 가능 (`evaluate_script`로 `contenteditable` 탐색)

- 모두 OK → "문제 없습니다." → 바로 진행
- 실패 시 → 구체적 문제 안내 + 사용자에게 조치 요청 → 대기
  - MCP 미연결: "/mcp에서 chrome-devtools 재연결 필요"
  - 탭 없음: "claude.ai 탭을 열어주세요"
  - 탭 여러 개: 어떤 탭을 사용할지 질문
  - 입력창 접근 불가: "MCP 리커넥트가 필요합니다"

## 1단계: 실행 계획 생성 + 사용자에게 표시

메인 문서를 읽고 작업 순서를 자연어로 파악한다 (고정 포맷 없음 — 문서마다 다를 수 있음).

### _progress.md 생성
메인 문서와 같은 디렉토리에 `_progress.md`를 생성한다. 이미 있으면 읽고 이어서 진행.
중단 상태 항목이 있으면 세션 메모리를 먼저 참조한다.

`_progress.md` 구조:
```
# 실행 계획

## 기본 정보
- 소스 문서: (경로)
- 실행 모드: (웹 클로드 검증/단독)
- 총 항목: N개
- 생성일: YYYY-MM-DD

## 진행 방식

🔁 **웹 클로드 검증 모드 — 항목당:**
  A. INSTRUCT — 웹 클로드에게 작업 맥락 전송 → 웹 클로드가 작업 방법/관점/순서를 지시
  B. WORK — 웹 클로드의 지시에 따라 실제 작업 수행
  C. PREP — 작업 결과 + 본인 분석 + 구체적 질문/반론 정리
  D. VERIFY — 브리프를 웹 클로드에 전송, 응답 수신
  E. RESPOND + RECORD — 응답 산출물 작성, 수정/합의 → 결론 파일 기록

🔁 **단독 모드 — 항목당:**
  A. WORK — 작업 실행
  B. SELF-VERIFY — 자체 검증 (문제 0건까지 GOTO 반복)

🔁 **반복 종료 조건: 모든 항목 완료 또는 컨텍스트 400k 토큰 초과**

## 핵심 제약 (문서에서 추출)
- (문서에서 자동 추출한 주의사항/의존 관계)

## 중단 시 참조
- 세션 메모리에 마지막 상태 저장됨 — 재개 시 반드시 확인

---

# 진행 상황

- [ ] 항목 1: ... [challenge: pending]
      instruct: (pending)
      artifact: pending
- [ ] 항목 2: ... [challenge: pending]
      instruct: (pending)
      artifact: pending

# 발견된 이슈 (범위 밖 — 최종 보고 시 사용자에게 전달)
(없음)
```

**항목 목록 불변 원칙**: 항목 목록은 1단계에서 확정되며 이후 추가/삭제/분할하지 않는다. 범위는 사용자의 결정이다. 실행 중 범위 밖 이슈를 발견하면 "발견된 이슈" 섹션에 즉시 기록한다.

### 대화 화면에 실행 계획 표시
항목이 5개 이상이면 실행 계획 표시 최상단에 다음 안내를 출력한다:
> "⚠️ 항목이 N개입니다. 품질 유지를 위해 5항목씩 나눠서 진행하는 것을 권장합니다. 동의하시면 '5항목까지 진행 후 중단'이라고 적어주세요."
사용자가 아무 말 없으면 전부 진행한다 (대기하지 않는다).

아래 순서대로 출력한다:
1. `📋 실행 계획을 생성했습니다. 문제 있으면 ESC로 중단하세요.`
2. `_progress.md`의 **전체 내용을 그대로** 출력한다. 요약하거나 축약하지 않는다.
3. `바로 진행합니다.`

표시 후 바로 반복 루프로 진행한다.

## 반복 루프 (웹 클로드 검증 모드)

### A. INSTRUCT — 웹 클로드에게 지시 요청
- 웹 클로드에게 현재 항목의 작업 맥락(**대상 파일 목록 필수** + 범위 + 문서 내용)을 전송
- "Please provide INSTRUCT: work approach, focus areas, challenge type. Answer in English only."
- 웹 클로드 응답에서 작업 방법, 관점, 순서, challenge 형태를 확인
- _progress.md에 challenge와 instruct 필드를 기록
- 항목 5 이후에는 INSTRUCT 요청 메시지 시작에 역할 리마인드를 포함한다:
  "[Role: You are the reviewer. Maintain consistent verification standards.]"

### B. WORK — 작업 실행
- INSTRUCT 대기 중 대상 파일을 읽어두는 것은 허용하되, 최종 분석과 결론은 반드시 INSTRUCT 내용을 반영해야 한다
- INSTRUCT의 pre-flagged 항목을 모두 확인한다 (VERIFY의 INSTRUCT_COVERAGE에 기재 필수)
- 해당 항목의 상세 내용을 메인 문서 + 관련 문서 + 소스 코드에서 파악
- 웹 클로드의 지시에서 빠진 범위가 보이면 먼저 제기 후 진행
- 범위 밖 이슈 발견 시 → "발견된 이슈" 섹션에 즉시 기록

### C. PREP — 브리프 준비
- 작업 결과 + 본인 분석 + 구체적 질문/반론을 정리
- challenge 형태별 내용은 INSTRUCT에서 웹 클로드가 지정한 대로 따른다

### D. VERIFY — 웹 클로드에 전송 + 응답 수신
- PREP에서 정리한 브리프를 웹 클로드에 전송
- **메시지 첫 줄에 `INSTRUCT_REF: Item #N`을 포함한다** — A단계에서 실제로 수신한 INSTRUCT를 증명하는 필드. INSTRUCT를 수신하지 않은 항목에는 이 필드를 작성할 수 없다. 웹 클로드가 이 필드 없이는 검증을 거부한다.
- **INSTRUCT_REF 다음 줄에 `INSTRUCT_COVERAGE`를 포함한다** — 웹 클로드의 INSTRUCT에서 pre-flagged된 항목 각각에 대한 판정:
  ```
  INSTRUCT_COVERAGE:
  - Pre-flagged #1 (double CDR): FOUND HIGH — burst_cooldown CDR 이중 적용
  - Pre-flagged #2 (stale _shooter): CHECKED CLEAN — null guard at L47
  - Pre-flagged #3 (burst timing): NOT A BUG — last write wins
  ```
  - 모든 pre-flagged 항목에 FOUND / CHECKED CLEAN / NOT A BUG / WAIVE 중 하나 + 1줄 근거
  - WAIVE — 면제 사유 1줄 필수. "보충", "나중에" 같은 연기 표현 금지
  - 웹 클로드가 빠진 항목을 발견하면 CORRECTIONS
- 메시지 끝에 아래 검증 태그를 붙인다 (스킬 기본 태그 대신 이 커맨드 전용 태그를 사용). INSTRUCT 메시지에는 붙이지 않는다:
```
---
[VERIFICATION PROTOCOL]
If no "INSTRUCT_REF: Item #" line appears in the message above, respond ONLY with:
🚫 MISSING_INSTRUCT — cannot verify without INSTRUCT reference. Stopping review.
Otherwise, review the content and end with exactly one of:
⚠️ CORRECTIONS: [N] — fix these and send back for re-verification.
✅ CONFIRMED — no issues found.
---
```
- 응답 끝의 상태 마커 확인:
  - `✅ CONFIRMED` → E단계로 (합의)
  - `⚠️ CORRECTIONS: [N]` → E단계로 (수정 필요)
  - `🚫 MISSING_INSTRUCT` → 해당 항목의 INSTRUCT를 요청한다 (대상 파일 + 맥락 포함) → 웹 클로드 응답 수신 → A단계로 돌아감
  - 마커 없음 → 웹 클로드에 마커 재요청

### E. RESPOND + RECORD
- **⚠️ CORRECTIONS이면:**
  → 지적사항 수정 후 웹 클로드에 재전송 (INSTRUCT_REF + 검증 태그 재포함) → D단계로 돌아감 → 해소될 때까지 반복
- **✅ CONFIRMED이면:**
  → 결론 파일에 기록 → _progress.md artifact 경로 기록 → 항목 완료
  → 다음 항목으로 → A단계부터 반복
  → 모든 항목 완료면 → 전체 완료 단계로 진행

## 반복 루프 (단독 모드)

### A. WORK — 작업 실행
- 중간 관리자 없이 클로드 코드가 자체 판단으로 작업 진행
- 해당 항목의 상세 내용을 메인 문서 + 관련 문서 + 소스 코드에서 파악

### B. SELF-VERIFY — 자체 검증 (문제 0건까지 GOTO 반복)
- B-1. "내가 한 것 중 뭐가 잘못됐을까?" (적대적 자기 질문으로 시작)
- B-2. 문제 발견 시 즉시 수정 → B-1 반복
- B-3. 문제 0건 확인 → 결론 파일 기록 → artifact 경로 기록 → 항목 완료
- 다음 항목으로 → A단계부터 반복

## 조건부 컨텍스트 체크

반복 루프 진행 중, 매 항목 시작 전에 자문한다:
> "현재 실행 모드와 진행 중인 항목을 알고 있는가?"
- 확신 있으면 → 계속 진행
- 불확실하면 → _progress.md 읽기

## 전체 완료
- 모든 항목 완료 시, 사용자에게 보고하기 **전에** 웹 클로드에게 위반 체크를 요청한다:
  - 대화 이력을 기반으로 검증 가능한 사실만 체크
  - 메시지 끝에 아래 태그를 붙인다:
  ```
  ---
  [VIOLATION CHECK]
  Review the conversation history and check ONLY verifiable facts:
  1. For each item: was INSTRUCT request sent before VERIFY? (message order)
  2. For each VERIFY: does INSTRUCT_REF match an actual INSTRUCT exchange?
  3. For each VERIFY: are INSTRUCT pre-flagged items addressed? (INSTRUCT_COVERAGE)
  4. Did any message contain false claims about previous messages?
  List violations with message references, or state:
  ✅ NO_VIOLATIONS — all verifiable protocol facts check out.
  ---
  ```
- 웹 클로드의 위반 체크 결과를 사용자 보고에 **반드시 포함**한다 (생략 금지)
- 이후 진행 사항과 결론을 한글로 사용자에게 보고
- "발견된 이슈" 섹션에 기록된 내용이 있으면 함께 전달

## 컨텍스트 관리
컨텍스트 사용량이 400k 토큰 이상이면:
1. 세션 메모리에 현재 상태 저장 (진행 중인 항목, 남은 작업, 주요 결정)
2. 프로그레스 파일에 중단 상태 기록:
   - 해당 항목을 "진행 중 중단"으로 표시 (현재 단계 A~E 명시)
   - "세션 메모리 참조 필요" 메모 추가
3. 사용자에게 중단 사유 보고 → 대기

## 주의사항
- 사용자의 자연어 지시가 이 커맨드의 기본 동작보다 항상 우선한다
- 커밋은 커맨드가 관여하지 않음. 문서에 커밋 전략이 있으면 따르고, 사용자가 요청하면 실행
- 계획 문서 형식은 매번 다를 수 있음 — 자연어로 파악할 것
- 웹 클로드와의 대화는 영문으로, 사용자 보고는 한글로
- 검증에서 문제를 발견하면 반드시 즉시 수정한다. "나중에 수정" 금지
- 웹 클로드와의 대화에서는 반드시 본인 분석 + 구체적 질문을 포함한다 (자료만 전달 금지)
