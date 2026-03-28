---
argument-hint: '_progress.md 경로 [웹 클로드 포함]'
---
방금 완료된 작업의 규칙 위반을 전수 조사하고 _violations.md를 작성한다. 사용자가 `$ARGUMENTS`에 _progress.md 경로를 입력한다.

## 대전제

이 커맨드는 **작업 완료 직후** 실행한다. 작업 중에 실행하지 않는다.
규칙 위반 전수 조사는 작업의 마지막 단계이며, 이 결과를 사용자에게 보고하는 것으로 작업이 종료된다.

**핵심 원칙**: 클로드 코드는 자기 위반을 축소 보고하는 강한 편향이 있다. 이 커맨드는 그 편향을 강제로 깨는 구조다. "해당 없음"에도 증명 의무가 있고, 증명 없이 넘어가면 그 자체가 위반이다.

## 입력 파싱
- `$ARGUMENTS`에서 _progress.md 경로를 파악
- "웹 클로드", "같이", "검증" 등 키워드가 있으면 → 웹 클로드 교차 검증 모드
- _progress.md가 없으면 → 사용자에게 경로 확인 요청

## 사전 준비

1. _progress.md를 읽어서 작업 개요 파악:
   - 실행 모드 (웹 클로드 검증 / 단독)
   - 총 항목 수
   - 각 항목의 완료 상태, CORRECTIONS 횟수
2. 원본 커맨드 파일을 읽어서 **적용된 규칙 목록** 추출 (cmd_execute-loop-msg.md 또는 해당 커맨드)
3. 작업 산출물 디렉토리의 파일 목록 확인

## 1단계: 클로드 코드 자기 조사

아래 체크리스트를 **하나도 빠뜨리지 말고** 전부 답한다.
"해당 없음"도 근거와 함께 명시한다.
**"위반 아님"이라고 판단한 항목은 왜 위반이 아닌지 한 줄로 증명한다. 증명 없이 "해당 없음"으로 넘어가면 그 자체가 위반이다.**

### A. 프로토콜 순서 위반

각 항목별로 아래 질문에 답한다:

**A-1. INSTRUCT 수신 완료 후에 WORK를 시작했는가?**
- "대기 중 파일 읽기"를 했다면: 단순 `Read`였는가, 아니면 분석/패턴 탐색까지 시켰는가?
- 분석까지 시켰다면: 그 분석 결과가 최종 VERIFY에 영향을 미쳤는가?
- Agent 서브에이전트를 띄웠다면: Agent에게 보낸 프롬프트를 인용하고, "읽기"와 "분석"을 구분하라

**A-2. INSTRUCT의 pre-flagged 항목을 전부 확인했는가?**
- 확인하지 않은 항목이 있다면: 각각 나열하고, 왜 생략했는지 적어라
- "최종 리포트에서 보충"으로 넘긴 것도 **미확인**으로 센다
- 웹 클로드가 수용했더라도 클로드 코드의 위반은 위반이다

**A-3. VERIFY에 INSTRUCT_REF와 INSTRUCT_COVERAGE를 빠짐없이 포함했는가?**

### B. 형식 위반

**B-4. RESPOND 단계에서 후속 처리를 올바르게 수행했는가?**
- ⚠️ CORRECTIONS 수신 시: 지적사항을 실제로 수정한 후 재전송했는가?
- ✅ CONFIRMED 수신 시: 결론 파일을 실제로 생성했는가?

**B-5. _progress.md의 instruct/challenge/artifact 필드를 WORK 시작 전에 기록했는가?**

**B-6. 검증 태그(VERIFICATION PROTOCOL 블록)를 모든 VERIFY 메시지에 포함했는가?**

**B-7. INSTRUCT 메시지에는 검증 태그를 붙이지 않았는가?** (붙이면 위반)

### C. 내용 정확성

**C-8. 최종 보고서의 수치(CRITICAL/WARNING/SUGGESTION)가 개별 문서 합산과 일치하는가?**
- 직접 세어서 대조표를 작성하라:
  ```
  | Item | 개별 문서 C/W/S | summary C/W/S | 일치? |
  ```

**C-9. "CHECKED CLEAN"으로 판정한 항목 중 실제로는 문제가 있었던 것은 없는가?**
- CORRECTIONS에서 지적받은 항목이 초기 VERIFY에서 CHECKED CLEAN이었다면 기록하라

**C-10. 웹 클로드의 CORRECTIONS를 받았을 때, "이미 반영됨"이라고 주장한 것이 있는가?**
- 실제로 반영되어 있었는지 검증하라

### D. 커뮤니케이션 품질

**D-11. INSTRUCT 요청의 품질이 전 항목에서 일관되었는가?**
- 첫 항목과 마지막 항목의 요청 길이(글자 수)를 비교하라
- 50% 이상 차이나면 "후반 가속" 위반으로 기록

**D-12. "자료만 던지지 않고 본인 분석 + 구체적 질문"을 포함했는가?**

**D-13. 웹 클로드의 피드백 중 무시하거나 축소 해석한 것이 있는가?**
- "리포트에서 보충", "영향 없음"으로 넘긴 피드백을 전부 나열하라

### E. 자기 인식 (가장 중요)

**E-14. 위 A~D 조사를 성실하게 수행했는가?**
- 조사 중 "이건 위반이 아닐 거야"라고 건너뛰려 한 항목이 있었는가?
- 있었다면: 왜 건너뛰려 했는지, 실제로 위반인지 재판단하라

**E-15. "위반이지만 영향은 없었다"고 판단한 항목이 있는가?**
- 그 판단의 근거를 적어라
- **"웹 클로드가 수용했으니까"만으로는 근거가 아니다** — 웹 클로드의 수용은 웹 클로드의 판단이지 클로드 코드의 면죄부가 아님
- **"최종 산출물이 정확하니까"만으로도 근거가 아니다** — 프로세스 위반과 결과 품질은 별개

## 2단계: 웹 클로드 교차 검증 (웹 클로드 모드일 때만)

1단계 결과를 웹 클로드에 전송하고, 아래를 요청한다:

```
VIOLATION CROSS-EXAMINATION REQUEST

Below is Claude Code's self-reported violation audit for this session.

Please:
1. Verify each "해당 없음" claim — do you agree with the evidence provided?
2. Identify violations Claude Code missed — check conversation history for:
   - Times I started analysis before your INSTRUCT arrived
   - Times I ignored or minimized your feedback
   - Times my VERIFY didn't fully address your pre-flags
3. Report YOUR OWN violations:
   - Were your pre-flags comprehensive? List findings you discovered in CORRECTIONS that should have been pre-flagged.
   - Did you maintain consistent verification rigor? Compare CORRECTIONS rate for items 1-3 vs 7-9.
   - Did you use "최종 리포트에서 보충" or equivalent to defer checking? How many times?
   - Did you apply different standards to the same type of issue across items?
4. For each violation (mine or yours), state:
   - Whether it affected the final output quality
   - Whether it was a process violation or result violation

End with a summary table:
| Subject | Violation | Items | Severity | Output Impact |
```

웹 클로드 응답을 수신한 후:
- 클로드 코드의 자기 조사에 없었던 위반이 웹 클로드에 의해 추가로 발견되면 → 1단계 결과에 추가
- 웹 클로드의 자기 보고 위반도 기록

## 3단계: _violations.md 작성

산출물 디렉토리(_progress.md와 같은 디렉토리)에 `_violations.md` 파일을 생성한다.

### 파일 구조

```markdown
# 규칙 위반 보고서

**작성일**: YYYY-MM-DD
**작성자**: Claude Code (실행자) + Web Claude (검토자) 공동 검토
**대상 작업**: (작업명)

---

## 클로드 코드 위반 사항

### 위반 1: (제목)
- **체크항목**: A-1 / B-4 등
- **위반 내용**: ...
- **해당 항목**: Item #N, #M
- **규칙 원문**: > 인용
- **원인**: ...
- **영향**: (프로세스 위반 / 결과 위반 구분)
- **심각도**: HIGH / MEDIUM / LOW

(반복)

---

## 웹 클로드 위반 사항 (해당 시)

(동일 형식)

---

## 항목별 위반 매트릭스

| 항목 | A-1 | A-2 | B-4 | B-5 | C-8 | D-11 | ... |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|

---

## 자기 인식 반성 (E-14, E-15)

### 처음 보고에서 누락한 위반
(이 커맨드 실행 전에 사용자에게 보고한 위반 vs 이 조사에서 발견한 위반의 차이)

### "영향 없음" 판단의 재검토
(각 항목에 대해 근거 재평가)

---

## 양측 종합 평가

| 주체 | 위반 유형 | 건수 | 핵심 패턴 |
|------|----------|------|----------|

(구조적 문제 분석 + 개선 제안)
```

## 4단계: 사용자 보고

_violations.md 작성 완료 후 사용자에게 보고한다:
1. 총 위반 건수 (클로드 코드 / 웹 클로드)
2. 가장 심각한 위반 상위 3건
3. 이전 버전과의 비교 (해당 시)
4. 구조적 개선 제안

## 주의사항

- **축소 보고 절대 금지**: "영향 없었으니 위반 아니다"는 허용하지 않는다. 프로세스 위반은 결과와 무관하게 위반이다.
- **웹 클로드 수용 ≠ 면죄부**: 웹 클로드가 "리포트에서 보충"으로 수용한 것은 웹 클로드의 관대함이지, 클로드 코드의 정당성이 아니다.
- **후반 가속 특별 감시**: 작업 후반에 절차를 간소화했는지 집중 점검한다. 이것은 v4, v5에서 반복 확인된 구조적 패턴이다.
- **"해당 없음" 증명 의무**: 모든 체크항목에 대해, 위반이 아니라면 그 근거를 한 줄로 제시해야 한다. 근거 없는 "해당 없음"은 위반으로 간주한다.
- 사용자의 자연어 지시가 이 커맨드의 기본 동작보다 항상 우선한다.
