# He'story → OurStory OS 업그레이드 플랜

> 작성: 2026-06 · 상태: **계획 확정 전 (코딩 착수 대기)**
> 관련 리서치 상세: [`docs/research/on-device-voice-2026.md`](docs/research/on-device-voice-2026.md)

---

## 0. 한 줄 요약

기존 **12세션 자서전 인터뷰(He'story)** 의 기능/DB를 **베이스로 유지**하면서,
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

## 2. 디자인 적용 매핑 (OurStory OS → He'story)

| OurStory OS 화면 | He'story 대응 | 비고 |
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
인터뷰 UI ── VoiceEngine 인터페이스 ──┬─ GeminiLiveEngine   (클라우드, 기본)
                                     ├─ TwilioPhoneEngine  (전화 채널)
                                     └─ LocalWebGPUEngine  (Tier2, 데스크톱 프라이버시 모드 / 선택)
```
한 번 만들고 엔진만 교체. UI/DB는 엔진에 비의존.

### 3.2 기본 엔진: Gemini Live API
- WebSocket 단일 연결, 네이티브 오디오(한국어 포함 24개국어, 30 HD voice), **ephemeral token + v1alpha** 인증(보안 수정 포함).
- 기존 `getSessionPrompt()`(극존칭 인터뷰 프롬프트) 재사용.

### 3.3 전화(콜) 인터뷰 — Twilio 브릿지
```
[사용자 휴대폰] ─PSTN─ [Twilio Programmable Voice]
                          │ Media Streams (양방향 WS, G.711 μ-law 8kHz)
                          ▼
                [브릿지 서버 (상시 가동 Node WS, Railway 별도 서비스)]
                  · 오디오 트랜스코딩: μ-law 8k ⇄ PCM 16k(in)/24k(out)
                  · 끼어들기(interruption) 처리
                          │ WebSocket
                          ▼
                [Gemini Live + 세션 프롬프트]
```
- **통화 방식**: 앱 "지금 전화 받기" → 사용자 번호로 발신(명시적 동의). 예약 발신도 후속.
- **제약**: 한국 outbound는 발신번호(CID) 사전등록·검증·자동발신 규제 → 본인 동의 콜이면 리스크 낮음. Twilio KR Voice 가이드/요금 확인. 국내 SIP 트렁크 대안 비교.
- **인프라**: Railway에 상시 WS 브릿지 서비스 추가(서버리스 라우트로는 미디어 WS 유지 곤란). 환경변수 `TWILIO_*` 필요(외부 계정 전제 → 코드는 mock으로 선행 가능).
- **비용**: Twilio 분당 통화료 + Gemini 토큰. 브라우저(WebRTC/WS) 모드는 Twilio 비용 0 → 두 채널 병행.

### 3.4 온디바이스 (티어별, **로드맵 레벨 결정 보류**)
| Tier | 형태 | 추천 스택 | 비용/난이도 |
|---|---|---|---|
| 2 | 브라우저(WebGPU) | Moonshine-tiny-ko(STT) + Qwen3/SmolLM(LLM) + Supertonic3(TTS), transformers.js+ORT Web | 저~중 (웹 스택 유지). **단 iOS Safari 메모리 한계 → 데스크톱 전용 실험** |
| 3 | 모바일 네이티브 | react-native-executorch (Whisper/Gemma4 + Supertonic3) | **고** — 이유는 모델이 아니라 **RN/Expo 앱 전환**(UI 재작성·스토어 심사·기기 QA). 백엔드는 재사용. 별도 제품 트랙 |
| 4 | IoT(라즈베리파이) | whisper.cpp + 소형 LLM + Piper/Supertonic | 별도 HW 트랙. 종단 지연 8~25s → 비동기 "기억 기기"용 |

> **결정 ✅ (단계적 하이브리드)**: 동기는 **비용(클라우드 OPEX 누적) + 프라이버시(노인 생애사의 민감성)**.
> 1) 지금은 Gemini Live 기본 + **클라우드 프라이버시 1차 강화(무보존/암호화)**, 2) 엔진 추상화 도입(엔진 교체 가능), 3) 온디바이스는 "프라이버시 모드" 옵션 트랙으로 병행 → 품질이 충분해지면 기본 승격.
> **삼각 트레이드오프 유의**: 비용↓·프라이버시↑(온디바이스) vs 대화 품질↑·접근성↑(클라우드). 소형 모델은 Gemini 수준의 공감·꼬리질문을 아직 못 따라오고, 노인 사용자 구형폰은 온디바이스를 못 돌릴 수 있음 → 그래서 클라우드를 품질·접근성 베이스라인으로 유지.
> **라이선스 함정**: 한국어 최강 소형 LLM인 EXAONE 1.2B·Kakao Kanana 2.1B는 **비상업 라이선스 → 상업 출시 불가**. 상업 가능: Gemma4(Apache, 네이티브 오디오), Qwen3(Apache), HyperCLOVA X SEED 1.5B(조건부 MAU≤1천만).

### 3.5 자서전 오디오북 (Phase 4, 선택)
- **VoxCPM2**(Apache-2.0, 한국어 CER 0.95%, 음성 클로닝) — 지연 비민감 **배치** 작업이라 GPU 서버/호스티드 추론에 적합. 완성 자서전을 따뜻한(또는 본인 클론) 목소리로 낭독 → "손주에게 남기는 오디오북" 감성 기능.

---

## 4. 데이터 모델 변경

기존 `User / Session / Conversation / Autobiography` 유지 + 추가:
- `PhoneNumber` — 사용자 전화번호, 검증 상태, 동의 시각.
- `CallSession` — 통화 로그(시작/종료/길이/상태), `Conversation` 연결, 녹취/받아쓰기 참조.
- `ScheduledCall` — 예약 발신(시각, 반복, 세션 번호).
- (선택) `Person` / `Theme` — Explore 화면용 사람·주제 태깅 (자서전 재료 구조화).
- (선택) `AudiobookRender` — VoxCPM2 낭독 산출물.

---

## 5. 단계별 실행 (PR 단위, 모두 draft PR)

- **Phase 0 — 디자인 파운데이션**: 폰트 로드, `globals.css` 토큰(CSS 변수 + Tailwind v4 `@theme`), 공용 컴포넌트 라이브러리(`Button/Chip/Card/Icon/Waveform/Avatar/Toggle/PrivacyRibbon` 등 핸드오프 1:1 포팅), 죽은 컴포넌트·라우트 정리.
- **Phase 1 — 핵심 화면 리스킨**: 로그인/회원가입 → 세션목록(Timeline) → 인터뷰(Capture+Reflect). 다크 테마 전면.
- **Phase 2 — 자서전/내 이야기**: Explore·Timeline 미감(기억 카드·사람·주제).
- **Phase 3a — 브라우저 음성 정식화**: ephemeral token(보안 수정) + Gemini Live 안정화, 인터뷰 컴포넌트 단일화, VoiceEngine 추상화 도입. **+ 클라우드 프라이버시 1차 강화**: 무보존(no-retention) 설정, 저장 데이터 암호화, 정직한 프라이버시 카피.
- **Phase 3b — 전화 인터뷰**: Twilio 브릿지 서버(별도 Railway 서비스) + 발신/통화 흐름 + DB(통화/예약). (Twilio 계정 준비 전까지 mock.)
- **Phase 4 (선택) — VoxCPM2 오디오북**.
- **별도 트랙 — 온디바이스**: Tier2 데스크톱 PoC / Tier3 RN 앱(의사결정 후).

---

## 6. 결정 대기 항목 (Open Decisions)

1. ~~**온디바이스 로드맵 레벨**~~ — ✅ **결정: 단계적 하이브리드** (클라우드 기본+프라이버시 강화 → 엔진 추상화 → 온디바이스 옵션 트랙 병행). 동기: 비용·프라이버시.
2. **전화 채널 우선순위** — Phase 3b를 언제 착수할지, Twilio vs 국내 SIP 트렁크.
3. **카피/네이밍** — 서비스명 "He'story" 유지 vs "OurStory" 채택, 대상 호칭("아버님" 고정 vs 일반화).
4. **자서전 오디오북(Phase 4)** 포함 여부.

---

## 7. 다음 행동

→ 본 `PLAN.md` 및 리서치 문서 커밋(draft PR). 이후 **Phase 0** 착수 예정.
