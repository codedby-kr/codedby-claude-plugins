---
name: ask-claude-web
argument-hint: "claude.ai와 [주제나 맥락] 의논해"
description: "'웹 클로드', '웹클로드', 'claude.ai', 'web Claude', '클로드 웹', '클로드 챗봇', 'Claude chatbot'이 통신 대상으로 언급되면 이 스킬을 로드할 것. claude.ai 웹 탭에 메시지를 보내고 응답을 받는 자동 통신 스킬. 의논, 검증, 리뷰, 질문, 인사, 전달, 공유, 상의 등 claude.ai와의 모든 상호작용에 해당. chrome-devtools MCP 기반. claude.ai 탭과의 실시간 대화 전용."
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
```
Bash - powershell -File "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files.ps1" "파일1.md" "파일2.md"
```

2. 입력창 포커스:
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
chrome-devtools - press_key (key: "Control+v")
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
- 인자로 파일 경로를 여러 개 넣으면 한 번의 Ctrl+V로 모두 첨부됨
- 존재하지 않는 파일은 `[SKIP]`으로 건너뜀
- **첨부된 파일명에는 타임스탬프 프리픽스가 붙는다** (예: `1774536904906_rule_violations.md`). 첨부 확인 시 원본 파일명이 아닌 프리픽스 포함 이름으로 검색해야 한다. 확인 스크립트의 `TARGET_FILENAME`에는 확장자를 제외한 원본 파일명(예: `rule_violations`)을 넣으면 부분 매칭으로 찾을 수 있다.

## 사전 조건
- Chrome이 실행 중이어야 함 — 꺼져 있으면 사용자에게 Chrome을 직접 실행해달라고 안내할 것. 시스템 명령으로 Chrome을 켜지 마라 — MCP 초기화 이후에 뜬 Chrome에는 연결할 수 없다.
- `chrome://inspect/#remote-debugging` 토글이 ON이어야 함
- chrome-devtools MCP 서버가 Claude Code에 연결되어 있어야 함 (`/mcp`에서 chrome-devtools · ✔ connected 확인)
- Chrome에 claude.ai 탭이 열려있어야 함 (로그인 상태)
- **세션 첫 연결 시**: Chrome에 원격 디버깅 허용 확인창이 뜬다 — 사용자가 **허용(Allow)**을 눌러야 한다. Claude Code 세션당 1회 발생.
- **연결 실패 시**: Chrome이 켜진 상태에서 `/mcp`로 chrome-devtools를 재연결(reconnect)하라고 안내할 것.

## claude.ai 탭 선택

claude.ai 탭을 선택하려면:
```
chrome-devtools - select_page (pageId: <claude.ai 탭 번호>, bringToFront: true)
```
탭 번호를 모르면 먼저 `list_pages`로 확인.

## 메시지 전송 — 2단계 흐름

### 1단계: 파일 첨부 (선택적 — 첨부할 파일이 있을 때만 실행)
```
Bash - powershell -File "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files.ps1" "파일1.md" "파일2.md"
chrome-devtools - press_key (key: "Control+v")
```
첨부 확인이 필요하면 "파일 첨부 절차"의 4번(DOM 확인) 스크립트를 사용한다.

### 2단계: 전송 (첨부 파일 게이트 내장)

이 단일 스크립트가 스트리밍 체크, 잔여 첨부 정리, 텍스트 입력, 전송을 전부 처리한다. **별도 준비 단계 불필요** — 정리가 전송 동작에 내장되어 있다.

스크립트 상단의 `expected` 값을 붙여넣은 파일 수로 설정한다 (텍스트만: 0, 파일 3개: 3). `args` 파라미터는 사용하지 않는다 — snapshot을 요구하며 실패한다.
```
chrome-devtools - evaluate_script
function: async () => {
  const expected = 0; // ← 여기 수정: 텍스트만 0, 파일 N개면 N
  const fieldset = document.querySelector('fieldset');

  // 스트리밍 체크
  const stopBtn = document.querySelector(
    'button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="Stop response"]'
  );
  if (stopBtn || document.querySelector('[data-is-streaming="true"]'))
    return { sent: false, error: 'STILL_STREAMING', message: '이전 응답이 아직 생성 중입니다. 완료 후 재시도하세요.' };

  // 파일명 추출 헬퍼 (진단 메시지용)
  const getFileNames = () => {
    const btns = fieldset ? fieldset.querySelectorAll('button') : [];
    const names = [];
    for (const btn of btns) {
      const t = btn.textContent.trim();
      if (t && /\.[a-z]{1,4}/i.test(t)) {
        const match = t.match(/_([^_]+\.[a-z]{1,4})/i);
        names.push(match ? match[1] : t.replace(/\d+줄.*$|\d+lines.*$/i, '').substring(0, 40));
      }
    }
    return names;
  };

  const beforeFiles = getFileNames();
  let attachBtns = fieldset
    ? fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]')
    : [];
  const actual = attachBtns.length;

  // 첨부 파일 게이트: 초과 시 앞쪽(잔여) 파일 제거
  if (actual > expected) {
    const staleFiles = beforeFiles.slice(0, actual - expected);
    const freshFiles = beforeFiles.slice(actual - expected);
    const excess = actual - expected;
    for (let i = 0; i < excess; i++) {
      const btns = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]');
      if (btns[0]) btns[0].click();
    }
    // 100ms 간격 polling, 최대 2초
    const ok = await new Promise(resolve => {
      const s = Date.now();
      const poll = setInterval(() => {
        const remain = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]').length;
        if (remain === expected) { clearInterval(poll); resolve(true); }
        else if (Date.now() - s > 2000) { clearInterval(poll); resolve(false); }
      }, 100);
    });
    if (!ok) {
      const remainFiles = getFileNames();
      return {
        sent: false, error: 'CLEANUP_FAILED',
        message: '이전 사이클의 잔여 첨부가 감지됨. 앞쪽 ' + excess + '개 [' + staleFiles.join(', ') + '] 제거 시도했으나 2초 내 완료되지 않음. 남은 파일: [' + remainFiles.join(', ') + ']. 이 스크립트를 재실행하세요.',
        remaining: remainFiles
      };
    }
  } else if (actual < expected) {
    return {
      sent: false, error: 'MISSING_ATTACHMENTS',
      message: expected + '개 파일을 기대했으나 ' + actual + '개만 발견: [' + beforeFiles.join(', ') + ']. ' + (expected - actual) + '개 부족. Ctrl+V 붙여넣기가 실패했거나 입력창에 포커스가 없었을 수 있음. 1단계(파일 첨부)를 다시 실행 후 재시도.',
      found: beforeFiles
    };
  }

  // 텍스트 입력 + 전송
  const sentWith = getFileNames();
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('fieldset [contenteditable="true"]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return { error: 'INPUT_NOT_FOUND' };
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, '메시지 내용');
  await new Promise(r => setTimeout(r, 300));
  const sendBtn = document.querySelector('button[aria-label="Send Message"], button[aria-label="메시지 보내기"]');
  if (!sendBtn) return { sent: false, error: 'SEND_BTN_NOT_FOUND' };
  sendBtn.click();

  const cleaned = actual > expected;
  return {
    sent: true,
    message: cleaned
      ? '앞쪽 잔여 ' + (actual - expected) + '개 제거 후 ' + expected + '개 파일로 전송: [' + sentWith.join(', ') + '].'
      : expected > 0
        ? expected + '개 파일 첨부 전송: [' + sentWith.join(', ') + ']. 정리 불필요.'
        : '파일 첨부 없이 전송.',
    sentWith
  };
}
```
**반환값:**
- `sent: true` → 전송 완료. `sentWith`에 첨부된 파일 목록. 반드시 아래 건강 체크로 실제 전송 여부를 확인한다.
- `STILL_STREAMING` → 이전 응답 생성 중. 스트리밍 대기 후 재시도.
- `CLEANUP_FAILED` → 잔여 첨부 제거 실패 (2초 초과). 스크립트 재실행.
- `MISSING_ATTACHMENTS` → 기대보다 파일 부족. 1단계(파일 첨부) 재실행 후 재시도.
- uid 불필요 — `evaluate_script`로 DOM을 직접 조작한다

### 건강 체크 (2단계 후, 1회 MCP 호출)
Enter 후 제대로 전송되었는지 확인한다. 2초 내부 대기 + 4가지 확인을 evaluate_script 1회 안에서 처리:
```
chrome-devtools - evaluate_script
function: async () => {
  await new Promise(r => setTimeout(r, 2000));
  const input = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('[contenteditable="true"]');
  const inputText = input ? input.textContent.trim() : '';
  const inputEmpty = inputText.length < 5;
  const stopBtn = document.querySelector(
    'button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="Stop response"]'
  );
  const isStreaming = !!stopBtn;
  const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  let responseLen = 0;
  if (lastUserMsg) {
    let current = lastUserMsg;
    for (let depth = 0; depth < 10; depth++) {
      let parent = current.parentElement;
      if (!parent) break;
      let nextSib = parent.nextElementSibling;
      if (nextSib) {
        const text = nextSib.innerText;
        if (!text || text.trim().length === 0) { current = parent; continue; }
        if (text.includes('Claude is AI')) { current = parent; continue; }
        if (getComputedStyle(nextSib).opacity === '0') { current = parent; continue; }
        if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
        if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
        responseLen = text.length;
        break;
      }
      current = parent;
    }
  }
  return { inputEmpty, inputTextLen: inputText.length, isStreaming, responseLen };
}
```
**판정:**
- 입력창 비었음 + 스트리밍 중 → **정상 전송됨.** 아래 스트리밍 대기로 진행.
- 입력창에 텍스트 남음 + 스트리밍 아님 → **전송 실패.** 재전송한다.
- 입력창 비었음 + 스트리밍 아님 → **애매함.** responseLen으로 추가 판단.

**재전송 절차** (전송 실패 시):
1. 전송 전 스트리밍 체크 실행
2. 스트리밍 아님 → Enter 재전송
3. 건강 체크 반복
4. 2회 재시도 후에도 실패하면 사용자에게 상황 보고

## 응답 대기

전송 후 claude.ai가 응답을 생성 완료할 때까지 기다려야 한다.

### 스트리밍 완료 감지 (preferred: async Promise)
단일 evaluate_script 호출로 응답 완료까지 대기한다. 내부에서 3초 간격 체크, 5분 타임아웃:
```
chrome-devtools - evaluate_script
function: async () => {
  return new Promise(resolve => {
    const check = setInterval(() => {
      const stopBtn = document.querySelector('button[aria-label="응답 중단"], button[aria-label="Stop Response"]');
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
- 반환값: `'DONE'`(완료) 또는 `'TIMEOUT'`(5분 초과)
- 복잡한 프롬프트(web search, deep research)는 타임아웃을 `600000`(10분)으로 늘릴 것
- 에러 반환 시(탭 이동/크래시): 탭 재선택(`select_page`) 후 재시도

### 안정성 체크 (1회 MCP 호출 — 응답 완료 오탐 방지)
스트리밍 대기가 끝난 후, 진짜 끝났는지 한 번 더 확인한다. 응답 텍스트 길이를 3초 간격으로 2번 측정해서 같으면 완료로 판단:
```
chrome-devtools - evaluate_script
function: async () => {
  const getLen = () => {
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
    const last = userMsgs[userMsgs.length - 1];
    if (!last) return 0;
    let current = last;
    for (let depth = 0; depth < 10; depth++) {
      let parent = current.parentElement;
      if (!parent) break;
      let nextSib = parent.nextElementSibling;
      if (nextSib) {
        const text = nextSib.innerText;
        if (!text || text.trim().length === 0) { current = parent; continue; }
        if (text.includes('Claude is AI')) { current = parent; continue; }
        if (getComputedStyle(nextSib).opacity === '0') { current = parent; continue; }
        if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
        if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
        return text.length;
      }
      current = parent;
    }
    return 0;
  };
  const len1 = getLen();
  await new Promise(r => setTimeout(r, 3000));
  const len2 = getLen();
  return { len1, len2, stable: len1 === len2 && len1 > 0 };
}
```
- `stable: true` → 응답 추출로 진행.
- `stable: false` → 아직 텍스트가 변하고 있음. 안정성 체크 반복. (최대 3회 반복 후 그래도 unstable이면 일단 추출 시도)

### 에러 대응 원칙
**응답을 읽어왔는데 뭔가 이상하면(너무 짧거나, 예상과 다른 내용), 예상만으로 판단하지 말고 스크린샷을 찍거나 DOM을 다시 읽어서 실제 상황을 확인한 후 대응하라.**

### 스트리밍 완료 감지 (fallback: 수동 polling)
위 async 방식이 에러를 반환하거나 MCP가 async를 지원하지 않는 경우 사용:
```
chrome-devtools - evaluate_script
function: () => {
  const stopBtn = document.querySelector('button[aria-label="응답 중단"], button[aria-label="Stop Response"], button[aria-label="Stop response"]');
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
    current = parent;
  }
  return 'ASSISTANT_RESPONSE_NOT_FOUND';
}
```

⚠️ **서버 불안정**
claude.ai가 서버 장애 중일 때 토스트 에러가 뜰 수 있다.
증상: 스피너 멈춤, 응답 영역 비어있음, 관련 없는 응답이 추출됨.
의심되면 바로 재시도하지 말고 잠시 기다린 후 판단할 것.

## 아티팩트(파일) 수신

웹 클로드가 아티팩트(코드 파일 등)를 생성했을 때, **컨텍스트 소모 0**으로 로컬 파일로 저장한다.

### 크롬 다운로드 경로 확인
아티팩트 수신 전 크롬의 다운로드 경로를 알아야 한다. Chrome Preferences에서 읽는다:
```
Bash - node -e "const p=require('path'),os=require('os'); const prefs=JSON.parse(require('fs').readFileSync(p.join(os.homedir(),'AppData/Local/Google/Chrome/User Data/Default/Preferences'),'utf8')); console.log(prefs.download?.default_directory || p.join(os.homedir(),'Downloads'))"
```
> macOS: `~/Library/Application Support/Google/Chrome/Default/Preferences`
> Linux: `~/.config/google-chrome/Default/Preferences`

### 아티팩트 목록 조회
응답에 아티팩트가 포함되었는지 확인:
```
chrome-devtools - evaluate_script
function: () => {
  const cards = document.querySelectorAll('[data-testid*="artifact"], [role="button"]');
  const artifacts = [];
  cards.forEach(c => {
    const text = c.textContent?.trim();
    if (text && (text.includes('Download') || text.includes('다운로드')) && !text.includes('all') && !text.includes('모두')) {
      const name = text.replace('Download', '').replace('다운로드', '').trim();
      artifacts.push(name);
    }
  });
  return { count: artifacts.length, artifacts: artifacts };
}
```

### 아티팩트 수신 절차 (다운로드 방식, 권장)

코드 파일은 "복사" 버튼이 안 먹을 수 있으므로 **다운로드 방식을 우선** 사용한다. OS 무관.

1. 아티팩트의 "다운로드" 버튼 클릭 (`artifactName`을 아티팩트 제목으로 교체):
```
chrome-devtools - evaluate_script
function: () => {
  const artifactName = 'Utils'; // ← 아티팩트 제목으로 교체
  const cards = document.querySelectorAll('[data-testid*="artifact"], [role="button"]');
  const card = Array.from(cards).find(c => c.textContent.includes(artifactName));
  if (!card) return 'CARD_NOT_FOUND';
  const dlBtn = Array.from(card.querySelectorAll('button')).find(btn => {
    const aria = btn.getAttribute('aria-label') || '';
    const text = btn.textContent?.trim() || '';
    return /download|다운로드/i.test(aria) || /download|다운로드/i.test(text);
  });
  if (dlBtn) { dlBtn.click(); return 'downloading ' + artifactName; }
  return 'DL_BTN_NOT_FOUND';
}
```

2. 다운로드 완료 대기 (1~2초):
```
Bash - sleep 2
```

3. 다운로드 폴더에서 최신 파일 찾기 (중복 시 `(N)` 붙으므로 glob+mtime):
```
Bash - ls -t "다운로드경로/파일명"* | head -1
```
예: `ls -t ~/Downloads/utils*.py | head -1` → 가장 최근 `utils.py` 또는 `utils (2).py`

4. 원하는 위치로 이동:
```
Bash - mv "다운로드된파일경로" "최종목적지경로"
```

5. 다음 아티팩트에 대해 1~4 반복.

### 주의사항
- 크롬이 같은 이름 파일을 중복 다운로드하면 `파일명 (N).확장자` 패턴이 됨 (OS 무관, Chrome 공통). `ls -t glob | head -1`로 최신 파일을 가져오면 해결
- 아티팩트가 없는 응답에서는 카드가 0개로 반환됨
- "다운로드" 버튼 텍스트는 UI 언어에 따라 다를 수 있음 (`다운로드`/`Download`)


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

웹 클로드에게 자료만 보내고 "어떻게 생각해?"라고 묻지 마라. 반드시 본인의 분석과 구체적 질문/반론을 함께 보내라. "여기 코드입니다, 리뷰해주세요"가 아니라 "여기 코드와 제 분석입니다. 특히 X는 Y라고 생각하는데, 이 판단에 동의하는지 반박이 있는지 알려주세요"로 구성하라.

## 검증 프로토콜 태그 (VERIFICATION_TAG)

반복 실행이 필요한 경우 웹 클로드에게 검증 요청을 보낼 때, 메시지 끝에 이 태그를 붙인다. 웹 클로드의 응답 형식을 강제하여 다음 행동(수정/완료)을 명확히 한다.

**태그 (검증 요청 메시지 끝에 그대로 붙여넣기):**
```
---
[VERIFICATION PROTOCOL]
After your review, end your response with exactly one of:
⚠️ CORRECTIONS: [N] — fix these and send back for re-verification.
✅ CONFIRMED — no issues found.
---
```

**사용 규칙:**
- 검증(VERIFY) 메시지에만 붙인다
- 지시 요청(INSTRUCT) 메시지에는 붙이지 않는다
- "Answer in English only."와 별도로 붙인다 (영어 지시는 모든 메시지에 독립 부착)

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

