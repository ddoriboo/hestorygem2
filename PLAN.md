# OurStory 업그레이드 플랜 (구 He'story)

> 서비스명 **OurStory**(He'story에서 변경) · 작성: 2026-06 · 상태: **주요 결정 확정 — Phase 0 착수 대기**
> 관련 리서치 상세: [`docs/research/on-device-voice-2026.md`](docs/research/on-device-voice-2026.md)

---

## 0. 한 줄 요약

기존 **12세션 자서전 인터뷰(구 He'story → OurStory)** 의 기능/DB를 **베이스로 유지**하면서,
디자인 핸드오프 **OurStory OS** 의 "황혼의 기억" 다크 에디토리얼 디자인 시스템을 입히고,
실시간 음성을 **Gemini Live API** 로 정식화하며 **전화(콜) 인터뷰** 채널을 추가한다.
음성은 **엔진 추상화 레이어**로 설계해 클라우드/전화/온디바이스 엔진을 교체 가능하게 한다.

---

## 1. 현재 상태 진단

- **스택**: Next.js 15 (App Router) + Prisma/PostgreSQL + JWT(HTTP-only 쿠키) + Tailwind v4, Railway 배포.
- **실사용 코드**: `app/page.tsx`(세션목록), `app/interview/[id]/page.tsx`, `my-story`, `autobiography`, `login`/`register`.
  - 인터뷰 화면은 `GeminiLiveWrapper`(→ `GeminiRealtimeVoiceInterview`) + `GeminiTextInterview` 만 연결됨.
- **죽은 코드(미import)**: `OpenAIRealtimeVoiceInterview`, `RealtimeVoiceInterview`, `VoiceInterview`, `TextInterview` + 중복 API 라우트 다수(`/api/interview/realtime*`, `/api/gemini/live-*`).
- **보안 결함(필수 수정)**: `/api/interview/realtime-token` 이 `GOOGLE_API_KEY` **원본을 클라이언트로 전달** → ephemeral token으로 교체.
- **디자인 갭**: 현재 흰 배경 + 기본 Tailwind 색. 목표는 다크 "memory at dusk" (Pretendard + Noto Serif KR, ember/sage/rose).

---

## 2. 디자인 적용 매핑 (OurStory OS → OurStory 앱)

| OurStory OS 화면 | OurStory 앱 대응 | 비고 |
|---|---|---|
| Capture (대기/녹음/저장) | 인터뷰 음성 모드 | 숨쉬는 ember 마이크, 실시간 파형, 받아쓰기 표시 |
| Reflect (회고 채팅) | 인터뷰 텍스트 모드 | AI/사용자 말풍선, citation 카드, thinking dots |
| Timeline | 세션 목록(`page.tsx`) | 12세션을 "하루의 책" 카드 + 진행 타임라인 |
| Explore | `my-story` / 자서전 | 사람·주제 칩, 기억 카드 그리드 |
| Settings | 설정/내보내기 | ⚠️ 프라이버시 카피 각색 필요(아래) |

### 디자인 토큰 (핸드오프 기준)
- **색**: ground `#0E1116`/`#141821`/`#1B2029`/`#242A35`, ink(파치먼트) `#ECE1CD`(+72/48/28% α), accent ember `#E9A86B`(주요 행동), sage `#9BB9A8`(회고/AI), rose `#D99B98`(기억), danger `#E08D7E`.
- **폰트**: display = Noto Serif KR, body = Pretendard, mono = JetBrains Mono. `word-break: keep-all`, 한글 이탤릭 미사용.
- **타입 스케일**: displayXL40 / displayL32 / displayM26 / titleL20 / titleM17 / body15 / bodyRead17(serif) / caption13 / micro11(대문자) / mono12.
- **간격(4dp)**: 4·8·12·16·20·24·32·40·56·72. **라운드**: xs6/sm10/md14/lg20/xl28/pill999.
- **모션**: `cubic-bezier(0.2,0.8,0.2,1)` · fast160 / base280 / slow520 / breath3200ms.

> ⚠️ **카피 정직성**: 디자인 원본은 "기기 안에서·계정 없음·오프라인"을 신뢰 메시지로 쓰지만, 본 앱은 **클라우드 AI + 계정 기반**이므로 그대로 쓰면 거짓 표기. → "안전하게 암호화 보관" 등 사실에 맞게 각색. (온디바이스 모드를 실제 구현하는 범위에서만 해당 카피 사용.)

---

## 3. 실시간 음성 아키텍처

### 3.1 엔진 추상화 (핵심 설계 원칙)
```
인터뷰 UI ── VoiceEngine 인터페이스 ──┬─ GeminiLiveEngine   (클라우드, 기본 / 앱 내 "전화처럼" WebRTC)
                                     ├─ TwilioPhoneEngine  (진짜 전화 PSTN, 후속 Phase 3c)
                                     └─ LocalWebGPUEngine  (Tier2, 데스크톱 프라이버시 모드 / 선택)
```
한 번 만들고 엔진만 교체. UI/DB는 엔진에 비의존.

### 3.2 기본 엔진: Gemini Live API
- WebSocket 단일 연결, 네이티브 오디오(한국어 포함 24개국어, 30 HD voice), **ephemeral token + v1alpha** 인증(보안 수정 포함).
- 기존 `getSessionPrompt()`(극존칭 인터뷰 프롬프트) 재사용.

### 3.3 "전화처럼" 인터뷰 (콜 UX) — **결정 ✅: 앱 내 WebRTC 우선**

> **카카오 보이스톡은 불가**: 공개 API/SDK 없음(앱 내 사람↔사람 P2P 폐쇄 기능) → 외부 서버 중계 불가. 카카오로 음성을 하려면 사실상 **Kakao i Connect Center(센터플로우, AICC)** 인데 B2B 엔터프라이즈 계약·어댑터 서버 필요 → *나중 옵션*으로 보류.

**(A) 앱 내 WebRTC "전화처럼" — 1순위 (지금)**
```
[사용자] 앱의 큰 "전화 받기" 버튼 ──WebRTC/WS── [Gemini Live + 세션 프롬프트]
```
- 보이스톡 느낌(풀스크린 통화 UI·발신음·통화시간)을 **앱 안에서 재현**. 기존 `GeminiLiveWrapper` 자산 재사용.
- **통신비 0원**, 외부 계정 불필요, 즉시 구현 가능. 카카오톡 채널/알림톡은 **진입·예약·리마인드** 보조 레이어로 활용("오늘 3시, 아버님 이야기 들려주세요 📞").

**(B) 진짜 전화(PSTN) — 후속 (접근성 수요 확인 후)**
```
[사용자 휴대폰] ─PSTN─ [Twilio Voice] ─Media Streams(μ-law 8k)─ [트랜스코딩 브릿지(상시 Node WS, Railway 별도)] ─WS─ [Gemini Live]
```
- 장점: **앱·스마트폰 리터러시 불필요(폴더폰 OK) → 노인 접근성 최강.**
- 제약: 한국 outbound CID 사전등록·자동발신 규제(본인 동의 콜이면 리스크↓), 분당 통신비. 국내 SIP 트렁크 대안 비교. `TWILIO_*` 외부 계정 전제 → 코드는 mock 선행 가능.

### 3.4 온디바이스 (티어별, **결정 ✅ 단계적 하이브리드** — 아래 참조)
| Tier | 형태 | 추천 스택 | 비용/난이도 |
|---|---|---|---|
| 2 | 브라우저(WebGPU) | Moonshine-tiny-ko(STT) + Qwen3/SmolLM(LLM) + Supertonic3(TTS), transformers.js+ORT Web | 저~중 (웹 스택 유지). **단 iOS Safari 메모리 한계 → 데스크톱 전용 실험** |
| 3 | 모바일 네이티브 | react-native-executorch (Whisper/Gemma4 + Supertonic3) | **고** — 이유는 모델이 아니라 **RN/Expo 앱 전환**(UI 재작성·스토어 심사·기기 QA). 백엔드는 재사용. 별도 제품 트랙 |
| 4 | IoT(라즈베리파이) | whisper.cpp + 소형 LLM + Piper/Supertonic | 별도 HW 트랙. 종단 지연 8~25s → 비동기 "기억 기기"용 |

> **결정 ✅ (단계적 하이브리드)**: 동기는 **비용(클라우드 OPEX 누적) + 프라이버시(노인 생애사의 민감성)**.
> 1) 지금은 Gemini Live 기본 + **클라우드 프라이버시 1차 강화(무보존/암호화)**, 2) 엔진 추상화 도입(엔진 교체 가능), 3) 온디바이스는 "프라이버시 모드" 옵션 트랙으로 병행 → 품질이 충분해지면 기본 승격.
> **삼각 트레이드오프 유의**: 비용↓·프라이버시↑(온디바이스) vs 대화 품질↑·접근성↑(클라우드). 소형 모델은 Gemini 수준의 공감·꼬리질문을 아직 못 따라오고, 노인 사용자 구형폰은 온디바이스를 못 돌릴 수 있음 → 그래서 클라우드를 품질·접근성 베이스라인으로 유지.
> **라이선스 함정**: 한국어 최강 소형 LLM인 EXAONE 1.2B·Kakao Kanana 2.1B는 **비상업 라이선스 → 상업 출시 불가**. 상업 가능: Gemma4(Apache, 네이티브 오디오), Qwen3(Apache), HyperCLOVA X SEED 1.5B(조건부 MAU≤1천만).

### 3.5 자서전 오디오북 — ❌ **제외 (결정)**
- VoxCPM2 낭독 기능은 현 범위에서 제외. (향후 필요 시 리서치 문서 참고해 재검토 가능.)

---

## 4. 데이터 모델 변경

기존 `User / Session / Conversation / Autobiography` 유지 + **Phase별 점진 추가**:

- **Phase 1 (호칭 맞춤화)**: `User`에 `honorific` 필드 — 사용자별 호칭 맞춤(아버님/어머님/부모님/어르신/직접 입력). `getSessionPrompt()`·UI 카피에 주입.
- **Phase 3b (앱 내 통화/예약)**: `ScheduledCall` — 예약·리마인드(시각, 반복, 세션 번호, 카카오 알림 발송 여부).
- **Phase 3c (진짜 전화 PSTN)**: `PhoneNumber`(번호·검증·동의 시각), `CallSession`(통화 로그: 시작/종료/길이/상태, `Conversation` 연결, 녹취/받아쓰기 참조).
- **(선택) Explore**: `Person` / `Theme` — 사람·주제 태깅(자서전 재료 구조화).

---

## 5. 단계별 실행 (PR 단위, 모두 draft PR)

- **Phase 0 — 디자인 파운데이션 + 보안 핫픽스** ✅: 폰트 로드(Pretendard/Noto Serif KR/JetBrains Mono), `globals.css` 토큰(CSS 변수 + Tailwind v4 `@theme`) + `.os-*` 컴포넌트 클래스, `Brand` 워드마크, 죽은 컴포넌트 4종 정리. **🔴 보안 핫픽스**: ephemeral token 교체는 **PR #2(별도)** 에서 완료.
- **Phase 1 — 핵심 화면 리스킨** ✅: 로그인/회원가입 → 세션목록(Timeline·진행바·CHAPTER 카드) → 인터뷰(Capture=숨쉬는 ember 마이크 / Reflect=다크 채팅) → 내 이야기/자서전. 다크 "memory at dusk" 전면. 하드코딩 "아버님" 호칭 중립화(맞춤 호칭은 후속 `User.honorific` 연동).
- **Phase 2 — 자서전/내 이야기**: Explore·Timeline 미감(기억 카드·사람·주제).
- **Phase 3a — 브라우저 음성 정식화**: Gemini Live 안정화(보안 핫픽스는 Phase 0에서 선행), 인터뷰 컴포넌트 단일화, VoiceEngine 추상화 도입. **+ 클라우드 프라이버시 1차 강화**: 무보존(no-retention) 설정, 저장 데이터 암호화, 정직한 프라이버시 카피.
- **Phase 3b — "전화처럼" 인터뷰(앱 내 WebRTC)**: 풀스크린 통화 UI(발신음·통화시간·종료) + Gemini Live 연결 + 카카오톡 채널/알림톡 예약·리마인드 보조. 통신비 0.
- **Phase 3c (후속) — 진짜 전화(PSTN)**: Twilio 브릿지 서버(별도 Railway 서비스) + 발신/통화 흐름 + DB(통화/예약). (Twilio 계정 준비 전까지 mock.) 접근성 수요 확인 후 착수.
- ~~**Phase 4 — VoxCPM2 오디오북**~~: ❌ 제외.
- **별도 트랙 — 온디바이스**: Tier2 데스크톱 PoC / Tier3 RN 앱(의사결정 후).

---

## 6. 결정 대기 항목 (Open Decisions)

1. ~~**온디바이스 로드맵 레벨**~~ — ✅ **결정: 단계적 하이브리드** (클라우드 기본+프라이버시 강화 → 엔진 추상화 → 온디바이스 옵션 트랙 병행). 동기: 비용·프라이버시.
2. ~~**전화 채널**~~ — ✅ **결정: 앱 내 WebRTC "전화처럼" 우선**(통신비 0, 기존 자산), 카카오톡=예약/알림 보조. PSTN(Twilio/국내 SIP)은 접근성 수요 확인 후 후속(Phase 3c). 보이스톡 직접 연동 불가(공개 API 없음).
3. ~~**호칭**~~ — ✅ **결정: 사용자별 맞춤 호칭**(고정 X). 아버님/어머님/부모님/어르신/직접 입력 → `User.honorific`로 저장, 프롬프트·UI에 주입. / ~~서비스명~~ ✅ **OurStory** 채택.
4. ~~**자서전 오디오북(Phase 4)**~~ — ✅ **결정: 제외**.

---

## 7. 다음 행동

→ 본 `PLAN.md` 및 리서치 문서 커밋(draft PR). 이후 **Phase 0** 착수 예정.
