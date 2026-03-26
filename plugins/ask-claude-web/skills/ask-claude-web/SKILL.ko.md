---
name: ask-claude-web
argument-hint: "claude.ai와 [주제나 맥락] 의논해"
description: "chrome-devtools MCP로 claude.ai 웹과 협업하는 스킬 — 의논, 검증, 리뷰, 세컨드 오피니언. 입력 필드 찾기, 메시지 전송, 스트리밍 완료 감지(polling), 마지막 응답 추출의 evaluate_script 코드와 DOM 셀렉터 버전 이력 포함. 다회전 대화 지원: 메시지 전송, 응답 대기, 필요하면 후속 대화 진행. 'claude.ai와 의논해', 'claude.ai한테 검증 받아', 'claude.ai한테 리뷰 받아', 'claude.ai한테 물어봐', '웹 클로드랑 의논해', '웹 클로드한테 해결해달라고 해', '이건 claude.ai가 더 잘 알 거야' 같은 요청에 트리거. claude.ai와의 협업이 필요한 모든 상황 — 의논, 리뷰, 검증, 단순 질문 — 에서 이 스킬을 로드할 것. take_snapshot은 절대 사용 금지(13만자 토큰 낭비)."
---

# ask-claude-web 스킬

## 개요
chrome-devtools MCP를 통해 Claude Code와 claude.ai 간의 협업을 자동화하는 스킬. 의논, 검토, 검증, 질문에 다회전 대화 지원.

## 절대 규칙

### 파일 첨부는 반드시 클립보드 방식을 사용하라
**파일 내용을 evaluate_script에 넣지 마라.** take_snapshot도 절대 사용 금지 (13만자 토큰 낭비). 파일 내용이 Claude Code 컨텍스트를 거치면 토큰이 낭비된다.
파일을 웹 클로드에게 보내야 할 때는 반드시 아래 **클립보드 Ctrl+V 방식**을 사용하라.
이 방식은 파일 내용이 OS 클립보드 → 브라우저 경로로만 이동하여 **컨텍스트 소모 0**이다.

#### 금지 사항
- evaluate_script의 function 본문에 파일 내용을 template literal로 넣지 마라
- evaluate_script의 args로 파일 내용을 전달하지 마라
- DataTransfer API로 File 객체를 만들어 내용을 전달하지 마라
- Read 도구로 파일을 읽어서 evaluate_script에 전달하지 마라

#### 파일 첨부 절차 (컨텍스트 소모 0)

1. 클립보드에 파일 복사:

| OS | 명령 |
|----|------|
| **Windows** | `powershell -File "<plugin-dir>/scripts/clip-files.ps1" "파일1.md" "파일2.md"` |
| **macOS** | `bash "<plugin-dir>/scripts/clip-files-mac.sh" "파일1.md" "파일2.md"` |
| **Linux** | `bash "<plugin-dir>/scripts/clip-files-linux.sh" "파일1.md" "파일2.md"` |

> `<plugin-dir>`은 플러그인 설치 경로. 일반적으로 `~/.claude/plugins/ask-claude-web/`.

2. 입력창 포커스 (uid 불필요):
```
chrome-devtools - evaluate_script
function: () => {
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return 'NOT_FOUND';
  el.focus();
  return 'FOCUSED';
}
```

3. Ctrl+V로 붙여넣기:
```
chrome-devtools - press_key (key: "Control+v")   // Windows/Linux
chrome-devtools - press_key (key: "Meta+v")       // macOS
```

4. (권장) DOM으로 파일 첨부 확인 (~100 토큰, 스크린샷 대비 1/30):
```
chrome-devtools - evaluate_script
function: () => {
  const all = document.querySelectorAll('*');
  const found = [];
  for (const el of all) {
    if (el.children.length > 3) continue;
    const t = el.textContent;
    if (t && t.includes('TARGET_FILENAME') && t.length < 100) {
      found.push({ tag: el.tagName, text: t.substring(0, 80) });
      if (found.length >= 3) break;
    }
  }
  return { attached: found.length > 0, matches: found };
}
```
`TARGET_FILENAME`을 실제 파일명(예: `player.gd`)으로 교체하여 사용.
첨부 성공 시 `attached: true`, 실패 시 `attached: false`.

#### 주의사항
- **macOS:** 실험적 — claude.ai 붙여넣기 미검증
- **Linux:** `xclip` 필요, 실험적 — claude.ai 붙여넣기 미검증
- 인자로 파일 경로를 여러 개 넣으면 한 번의 Ctrl+V로 모두 첨부됨
- 존재하지 않는 파일은 `[SKIP]`으로 건너뜀
- 파일 내용이 Claude Code 컨텍스트를 거치지 않으므로 대용량 파일도 부담 없음

## 사전 조건
- Chrome이 실행 중이어야 함 — 꺼져 있으면 사용자에게 Chrome을 직접 실행하고 `chrome://inspect/#remote-debugging`에서 원격 디버깅을 활성화해달라고 안내할 것. 시스템 명령으로 Chrome을 켜지 마라 — MCP 초기화 이후에 뜬 Chrome에는 연결할 수 없다.
- `chrome://inspect/#remote-debugging` 토글이 ON이어야 함
- chrome-devtools MCP 서버가 Claude Code에 연결되어 있어야 함 (`/mcp`에서 chrome-devtools · ✔ connected 확인). `mcp__chrome-devtools__*` 도구가 사용 불가하면 작업을 중단하고 사용자에게 안내: "chrome-devtools MCP가 연결되어 있지 않습니다. `/ask-claude-web:setup`을 실행하세요." chrome-devtools 없이 진행하지 말 것.
- Chrome에 claude.ai 탭이 열려있어야 함 (로그인 상태) — 열려있지 않으면 `chrome-devtools - new_page (url: "https://claude.ai")`로 열 것
- **세션 첫 연결 시**: Chrome에 원격 디버깅 허용 확인창이 뜬다 — 사용자가 **허용(Allow)**을 눌러야 한다. Claude Code 세션당 1회 발생.
- **연결 실패 시**: Chrome이 켜진 상태에서 `/mcp`로 chrome-devtools를 재연결(reconnect)하라고 안내할 것.

## claude.ai 탭 선택

claude.ai 탭을 선택하려면:
```
chrome-devtools - select_page (pageId: <claude.ai 탭 번호>, bringToFront: true)
```
탭 번호를 모르면 먼저 `list_pages`로 확인.

## 메시지 입력 + 전송

### 입력 방법
`evaluate_script`로 입력 필드를 찾아 포커스 + 텍스트 입력:
```
chrome-devtools - evaluate_script
function: () => {
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('fieldset [contenteditable="true"]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return 'NOT_FOUND';
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, '질문 내용');
  return el.textContent.length;
}
```

uid는 불필요하다. `evaluate_script`로 DOM을 직접 조작한다.

### 전송
```
chrome-devtools - press_key (key: "Enter")
```

## 응답 대기

전송 후 claude.ai가 응답을 생성 완료할 때까지 기다려야 한다.

### 스트리밍 완료 감지 (preferred: async Promise)
단일 evaluate_script 호출로 응답 완료까지 대기한다. 내부에서 3초 간격 체크, 5분 타임아웃:
```
chrome-devtools - evaluate_script
function: async () => {
  return new Promise(resolve => {
    const check = setInterval(() => {
      // 탭 이동/크래시 감지
      if (!document.querySelector('[contenteditable="true"]')) {
        clearInterval(check);
        resolve('TAB_LOST');
        return;
      }
      const stopBtn = document.querySelector('button[aria-label="Stop response"], button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="응답 중지"]');
      const streaming = document.querySelector('[data-is-streaming="true"]');
      if (!stopBtn && !streaming) {
        clearInterval(check);
        resolve('DONE');
      }
    }, 3000);
    setTimeout(() => { clearInterval(check); resolve('TIMEOUT'); }, 300000);
  });
}
```
- 반환값: `'DONE'`(완료), `'TIMEOUT'`(5분 초과), `'TAB_LOST'`(탭 이동/크래시)
- 복잡한 프롬프트(web search, deep research)는 타임아웃을 `600000`(10분)으로 늘릴 것
- 에러 반환 시(탭 이동/크래시): 탭 재선택(`select_page`) 후 재시도
- `'DONE'` 후 추출 결과가 20자 미만이거나 "오류"/"went wrong" 포함 시: claude.ai 오류 → 질문 재전송

### 스트리밍 완료 감지 (fallback: 수동 polling)
위 async 방식이 에러를 반환하거나 MCP가 async를 지원하지 않는 경우 사용:
```
chrome-devtools - evaluate_script
function: () => {
  const stopBtn = document.querySelector('button[aria-label="Stop response"], button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="응답 중지"]');
  const streaming = document.querySelector('[data-is-streaming="true"]');
  return {
    isStreaming: !!(stopBtn || streaming),
    hasStopButton: !!stopBtn,
    hasStreamingAttr: !!streaming
  };
}
```
위 스크립트를 3~5초 간격으로 반복 실행한다. `isStreaming`이 `false`가 되면 응답 완료.

## 응답 텍스트 읽기

**스크린샷으로 읽지 마라.** 긴 응답은 화면에 다 안 들어온다.

### (권장) 추출 전 스크롤
응답 추출 전에 별도 evaluate_script로 스크롤을 맨 아래로 내린다. lazy rendering 대비 + 사용자 가시성 확보 목적. 추출과 반드시 별도 호출로 분리할 것 (동일 호출 내에서는 브라우저가 렌더링할 틈이 없음):
```
chrome-devtools - evaluate_script
function: () => {
  const msgs = document.querySelectorAll('[data-testid="user-message"]');
  if (msgs.length === 0) return 'NO_MESSAGES';
  let el = msgs[msgs.length - 1];
  for (let i = 0; i < 15; i++) {
    el = el.parentElement;
    if (!el) break;
    if (el.scrollHeight > el.clientHeight + 100) {
      el.scrollTop = el.scrollHeight;
      return 'SCROLLED';
    }
  }
  return 'NO_SCROLLABLE_FOUND';
}
```
현재 claude.ai는 가상 스크롤을 사용하지 않아 추출 자체는 스크롤 없이도 동작하지만, 향후 변경 대비 + 사용자가 응답을 직접 볼 수 있도록 권장.

### 마지막 어시스턴트 응답 추출
```
chrome-devtools - evaluate_script
function: () => {
  const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  if (!lastUserMsg) return 'NO_USER_MSG';

  let current = lastUserMsg;
  for (let depth = 0; depth < 10; depth++) {
    let parent = current.parentElement;
    if (!parent) break;
    let nextSib = parent.nextElementSibling;
    if (nextSib) {
      const text = nextSib.innerText;
      if (!text || text.trim().length === 0) { current = parent; continue; }
      if (text.includes('Claude is AI and can make mistakes')) { current = parent; continue; }
      const opacity = getComputedStyle(nextSib).opacity;
      if (opacity === '0') { current = parent; continue; }
      if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
      if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
      return text;
      }
    }
    current = parent;
  }
  return 'ASSISTANT_RESPONSE_NOT_FOUND';
}
```

## 토큰 절약 — 영어 대화 모드

한국어는 영어 대비 약 1.5~2배 토큰을 소모한다. 사용자가 직접 지켜보지 않는 자동 처리 상황에서는 영어로 주고받아 토큰을 절약한다.

### 적용 규칙
- **사용자가 직접 보고 있는 경우** (사용자가 "물어봐", "질문해" 등으로 지시하고 결과를 기다리는 경우): 한국어로 질문하고, 받은 응답도 한국어 그대로 사용자에게 전달
- **자동 처리인 경우** (Claude Code가 문제 해결을 위해 스스로 claude.ai에 질문하는 경우): 질문 끝에 `"Answer in English only."` 를 붙여서 영어 응답을 받고, Claude Code가 내부적으로 처리한 뒤 사용자에게는 한국어로 요약/보고

## 대화 탭 사용 규칙

**기본 동작: 현재 열린 claude.ai 채팅창을 그대로 사용한다. navigate_page로 이동하지 마라.**

1. 사용자가 미리 열어둔 페이지가 있으면 현재 창의 주소를 기억한다(웹 클로드의 주소 형식 `https://claude.ai/chat/{웹클로드채팅id}`)
2. 열린 탭 중에 `https://claude.ai/` 도메인이 없는 경우에는 1번에서 기억해둔 주소로 접속한다.(기억해둔 주소가 없으면 `https://claude.ai/`으로 접속해서 진행한다.)

페이지 로드 완료 후 위의 입력 → 전송 → 응답 읽기 절차 수행.

## 웹 클로드 대화 결론 저장 규칙

웹 클로드와 대화한 후 사용자에게 응답하기 전에 자문한다:

**"이 대화에서 나온 결정이나 발견 중, 파일에 기록되지 않고 내 컨텍스트에만 있는 것이 있는가?"**

있으면 세션 메모리에 저장한다. 없으면 저장하지 않는다.

저장 형식:
- keyword: 검색용 토픽 슬러그
- summary: 1줄 요약
- decisions: 결정/발견 목록 (근거 포함)
- 전체 대화 복사 금지 — 결론만 추출

## 다회전 대화

의논/검토/검증 요청 시에는 한 번 주고받고 끝내지 않는다. 응답을 읽고 결론이 나올 때까지 후속 메시지를 보낸다. 단순 질문은 1회로 충분. 메시지를 보낼 때는 현재 상황과 어떤 입력이 필요한지 (리뷰, 검증, 의견, 방향)를 반드시 포함하라.

## 트러블슈팅

### chrome-devtools MCP가 disconnected
→ `/mcp`에서 chrome-devtools 선택 후 재연결

### 입력 필드를 못 찾음
→ claude.ai UI가 업데이트됨. `evaluate_script`로 `[contenteditable="true"]` 탐색해서 새 셀렉터 확인

### 응답을 못 읽음
→ `[data-testid="user-message"]` 셀렉터가 변경됨. `evaluate_script`로 DOM 구조 재탐색

### "Server running at: starting…"
→ chrome-devtools MCP 클라이언트(Claude Code)가 도구를 호출해야 서버가 시작됨. 토글만 켜고 기다리면 안 됨.

---

## DOM 셀렉터 변경 감지 규칙

**claude.ai의 DOM 구조는 UI 업데이트로 언제든 바뀔 수 있다.**

스킬의 셀렉터(입력 필드, Stop 버튼, 응답 추출 등)가 작동하지 않는 것을 감지했을 때:
1. `evaluate_script`로 실제 DOM을 탐색하여 새로운 셀렉터/방법을 찾는다
2. 새 방법이 확인되면, **이전 방법을 삭제하지 말고** 아래 변경 이력에 버전으로 기록한다
3. 본문의 스크립트는 최신 버전으로 업데이트하되, 이전 셀렉터는 fallback으로 남겨둔다
4. 변경 이력에는 날짜, 변경 내용, 변경 이유를 기록한다

### 새 셀렉터 찾는 방법

UI 언어 변경이나 claude.ai UI 업데이트 시 아래 탐색 스크립트를 사용:

**페이지 내 모든 버튼의 aria-label 조회:**
```
() => {
  const btns = document.querySelectorAll('button[aria-label]');
  return [...new Set([...btns].map(b => b.getAttribute('aria-label')))].sort();
}
```

**스트리밍 중 Stop 버튼 찾기** (긴 질문을 보낸 뒤 3초 내 실행):
```
() => {
  const btns = document.querySelectorAll('button[aria-label]');
  return [...btns].map(b => b.getAttribute('aria-label'))
    .filter(l => l && (l.toLowerCase().includes('stop') || l.includes('중단') || l.includes('중지')));
}
```

**파일 첨부 시 Remove 버튼 찾기** (파일 첨부 후 실행):
```
() => {
  const fieldset = document.querySelector('fieldset');
  if (!fieldset) return 'NO_FIELDSET';
  return [...fieldset.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'));
}
```

---

## 검증된 셀렉터 및 방법

| 구성요소 | 셀렉터 / 값 | 언어 | 검증일 | 비고 |
|----------|------------|------|--------|------|
| Stop 버튼 | `"Stop response"` | EN | 2026-03-25 | Primary |
| Stop 버튼 | `"응답 중단"` | KO | 2026-03-25 | Primary |
| Stop 버튼 | `"Stop Response"`, `"응답 중지"` | EN/KO | 2026-03-22 | Fallback |
| 파일 삭제 | `"Remove"` | EN | 2026-03-25 | |
| 파일 삭제 | `"제거"` | KO | 2026-03-23 | |
| 스트리밍 대기 | async Promise + setInterval(3초) | — | 2026-03-24 | Preferred. TAB_LOST 감지 |
| 스트리밍 대기 | evaluate_script 반복 호출 (3~5초) | — | 2026-03-22 | Fallback (async 미지원 MCP) |
| 파일 확인 | DOM 텍스트 검색 (~100 토큰) | — | 2026-03-23 | |

### 파일 첨부 삭제 (입력창 비우기)

#### 현재 방법 (v1, 2026-03-23)
```
chrome-devtools - evaluate_script
function: () => {
  const fieldset = document.querySelector('fieldset');
  if (!fieldset) return { removed: 0, error: 'NO_FIELDSET' };
  const removeBtns = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]');
  const count = removeBtns.length;
  for (let i = count - 1; i >= 0; i--) {
    removeBtns[i].click();
  }
  return { removed: count };
}
```
- 역순으로 클릭 (DOM 변경 시 인덱스 안정성)
- 4개 파일 동시 제거 확인 완료

#### 셀렉터가 작동하지 않을 때 대체 탐색 방법
`aria-label="Remove"` / `"제거"`가 변경된 경우 아래 순서로 대체 셀렉터를 탐색:
1. **fieldset 내 버튼 전수 조사**: `fieldset.querySelectorAll('button')`로 모든 버튼의 aria-label, title, class, SVG 존재 여부를 출력. 파일명 버튼(텍스트에 .gd/.json 포함)과 **같은 부모를 공유하는 SVG 아이콘 버튼**이 삭제 버튼
2. **파일 카드 구조 탐색**: 파일명이 포함된 요소의 `parentElement`에서 형제 버튼(`nextElementSibling` 또는 `previousElementSibling`)을 탐색. 파일 카드는 [파일명 버튼 + 삭제 버튼] 쌍으로 구성됨
3. **aria-label 한/영 변형 시도**: `"Remove"`, `"remove"`, `"Delete"`, `"삭제"`, `"Close"`, `"제거"` 등으로 재시도
4. **최후 수단**: 파일명 버튼 옆의 SVG-only 버튼(텍스트 없고 SVG 자식만 있는 버튼)을 클릭 — 삭제 버튼은 보통 X 아이콘(SVG)만 가진 작은 버튼
