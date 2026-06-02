# 온디바이스 한국어 실시간 음성 — 심층 리서치 (2026-06)

> 용도: 노인 대상 자서전 인터뷰(극존칭 한국어, 공감/꼬리질문 중요).
> 방법: 5개 각도 병렬 웹 검색 + 출처 교차검증. "claimed(주장)" vs "demonstrated(실증)" 구분.

## 한 줄 결론
2026년 현재, **노인 폰에서 고품질 한국어 실시간 대화 = 클라우드(Gemini Live)가 현실적 정답.**
온디바이스는 (a) 브라우저=데스크톱 한정 실험(iOS Safari 메모리 장벽), (b) 모바일 네이티브=가능하나 RN/Expo 앱 전환 필요. 폰에서 도는 **한국어 풀듀플렉스 S2S는 아직 없음** → 온디바이스는 파이프라인(STT+LLM+TTS)이 우세.

---

## 1. STT (음성인식)

| 후보 | 한국어 | 크기 | 라이선스 | 브라우저/폰 실증 |
|---|---|---|---|---|
| **Moonshine-tiny-ko** 🥇 | 전용 KO, Whisper-small 능가(CER) | 27M | 퍼미시브(상업OK) | ✅ onnxruntime-web / sherpa-onnx Android APK |
| Whisper(+KO 파인튜닝) | 양호(파인튜닝 CER 18%→6.5%) | tiny~large | MIT | ✅ transformers.js v3 WebGPU / whisper.cpp |
| Cohere Transcribe 03-2026 | 14개국어 KO 포함, 영어 SOTA | 2B | Apache-2.0 | 2B라 폰엔 무거움 |
| ENERZAi 저비트 KO Whisper | KO 재학습, NPU 타깃 | ~484MB | 벤더/상업(불명확) | 폰/NPU 타깃(주장) |
| Vosk(Kaldi) | KO 모델 있으나 구형·약함 | ~50MB | Apache-2.0 | Android |
| Apple SpeechAnalyzer | iOS26+ KO 온디바이스 | OS 내장 | Apple 한정 | iOS 전용 |
| ~~Parakeet/Canary/Kyutai STT~~ | ❌ **한국어 미지원** | — | — | 탈락 |

- **브라우저 추천**: Moonshine-tiny-ko (onnxruntime-web) > Whisper base/small KO 파인튜닝.
- **모바일 추천**: Moonshine-tiny-ko (sherpa-onnx) > whisper.cpp KO 파인튜닝 > (iOS 전용) Apple SpeechAnalyzer.

## 2. 소형 대화 LLM (~1–4B)

| 모델 | 크기 | 한국어 | 상업사용 | 온디바이스 | 오디오 입력 |
|---|---|---|---|---|---|
| **Gemma 4 E2B/E4B** 🥇 | 2/4B | 다국어급 | ✅ **Apache-2.0** | GGUF/AI Edge/MediaPipe | ✅ 네이티브 |
| **Qwen3 4B** | 4B | 다국어급 | ✅ Apache-2.0 | ✅ 공식 MLC/WebLLM 빌드 | ❌ |
| Qwen3 1.7B | 1.7B | 약함 | ✅ Apache-2.0 | ✅ | ❌ |
| **HyperCLOVA X SEED 1.5B** | 1.5B | **KO 네이티브 최강(소형)** | ⚠️ MAU≤1천만 + 비경쟁 | GGUF/Ollama | ❌ |
| **EXAONE 4.0 1.2B** | 1.2B | KO 네이티브 SOTA | 🚫 **비상업(NC)** | GGUF | ❌ |
| **Kakao Kanana 2.1B** | 2.1B | KO 네이티브 | 🚫 **비상업(CC-BY-NC)** | GGUF | ❌ |
| Phi-4-mini | 3.8B | 부수적 | ✅ MIT | ✅ WebLLM/GGUF | ❌ |
| Llama 3.2 1B/3B | 1/3B | ❌ 공식 미지원 | ⚠️ 700M MAU | ✅ ExecuTorch | ❌ |

> 🚫 **함정**: 한국어 최강 소형 모델 EXAONE·Kanana = **상업 출시 불가**.
> ✅ 상업 깨끗: Gemma 4(Apache+오디오), Qwen3(Apache), Phi-4-mini(MIT).
> ⚠️ HyperCLOVA SEED = 한국어 네이티브 최강이나 MAU 1천만↓·비경쟁 조건.
> 🎙️ 이 사이즈대에서 **오디오 입력 네이티브는 Gemma 3n/4 뿐** (별도 STT 불필요 가능).

## 3. TTS (음성합성)

| 후보 | 한국어 | 크기 | 라이선스 | 실증 |
|---|---|---|---|---|
| **Supertonic 3** 🥇 | CER 3.26(VoxCPM2 4.70 능가), 한국 Supertone | ~99M, 44.1kHz | OpenRAIL-M(상업OK, 제한확인) | ✅ onnxruntime-web + iOS/Android/Flutter SDK |
| Kokoro 82M(kokoro.js) | ⚠️ 비공식·thin(자체 문서 경고) | 82M | Apache-2.0 | ✅ 브라우저 성숙, KO 품질 약점 |
| sherpa-onnx VITS(kss)/Piper | 구형 단일화자, 견고/명료 | 30–50MB | Apache/MIT | ✅ 폰 CPU 실시간 |
| MeloTTS-Korean | 전용 KO VITS, 무난 | 수십MB | MIT | 브라우저 턴키 아님(ONNX 직접) |
| **VoxCPM2** | **최고 품질+클로닝(CER 0.95%, 48kHz)** | 2B | **Apache-2.0** | ❌ 엣지 부적합 → **오디오북 배치 최적** |
| ~~Kitten / NeuTTS~~ | ❌ 한국어 미지원 | — | — | 탈락 |

- **브라우저/모바일 추천**: Supertonic 3 (최선) > sherpa-onnx/Piper(견고·경량) > Kokoro(KO 품질 확인 필요).
- **오디오북(배치)**: VoxCPM2 — "Ultimate Cloning"(1–5분 레퍼런스)로 챕터 간 음색 일관. 비결정적 → 1–3회 생성 후 선택하는 QA 단계 필요. ~8GB VRAM, GPU RTF 0.13–0.3.

## 4. 풀듀플렉스 / 통합 S2S

| 모델 | 아키텍처 | 크기 | 라이선스 | 한국어 음성 | 온디바이스 |
|---|---|---|---|---|---|
| **KRAFTON Raon-SpeechChat** | 풀듀플렉스 S2S | 9B | Apache-2.0 | ✅ 문서화(≤10B KO 최강), TTFT 617ms | ❌ 단일 GPU |
| HyperCLOVA X Omni 8B | any-to-any | 8B | open(확인) | ✅ KO 우선 | GPU/클라우드(온디바이스는 주장) |
| Qwen3-Omni-30B-A3B | Thinker-Talker | 30B MoE | Apache-2.0 | ✅ 문서화 | ❌ 69–145GB VRAM |
| Moshi | 풀듀플렉스 | 7B(+1B) | 퍼미시브 | ❌ 영어 전용(다국어 로드맵) | ✅ iPhone(영어만) |
| Gemma 3n/4 | **음성in→텍스트out** | E2B/E4B | Gemma/Apache | ✅ KO ASR | ✅ 폰 |
| Step-Audio2 / GLM-4-Voice / mini-omni / Spirit LM | S2S | 다양 | 다양 | ❌ KO 미문서 | GPU |

- **폰 네이티브 한국어 풀듀플렉스 = 없음.** 가장 근접한 온디바이스 = Gemma 3n/4(음성in→텍스트out, S2S 아님).
- **클라우드 GPU 가능시**: Raon-SpeechChat 9B(Apache, 단일 GPU, 한국어 최강) / HyperCLOVA X Omni 8B / Qwen3-Omni.
- **판정**: 온디바이스에선 파이프라인이 통합 S2S를 이긴다(한국어, 2026). 클라우드 GPU 허용시엔 통합 S2S가 자연스러운 턴테이킹+저지연으로 우세.

## 5. 런타임 / 배포 현실

### Tier 2 — 브라우저
- 스택: `transformers.js v3 + ONNX Runtime Web` + WebLLM. 레퍼런스: HF `webml-community/conversational-webgpu`(VAD+Whisper/Moonshine+SmolLM2-1.7B+Kokoro, 전부 브라우저).
- **결정적 한계**: WebGPU는 데스크톱 기본 + iOS 26/Safari26에서만 모바일 지원. iOS Safari Metal 버퍼(~256MB~1GB) + 탭 RAM 한도 → 장시간 음성 루프 OOM/크래시. transformers.js Whisper-WebGPU 메모리 누수 이슈 존재. 브라우저 RAM 실용 한계 ~4–6GB.
- **결론**: 데스크톱 전용 실험으로 안전. 노인 폰(특히 iOS)엔 프로덕션 부적합.

### Tier 3 — 모바일 네이티브
- 🥇 **react-native-executorch**(Software Mansion / Meta ExecuTorch): `useLLM` 훅, Whisper STT + LLM + Kokoro TTS를 한 라이브러리로, Expo 지원. iPhone15서 Llama-3.2-1B(Q4) 20–40 tok/s.
- 대안: **llama.rn + whisper.rn**(PocketPal AI 검증). 오디오 단일모델 필요시 **MediaPipe/Gemma 3n·4**(52–56 tok/s decode).
- 폰에서 자연스러운 지연(~700ms/턴) 달성 가능.

### Next.js 팀 관점 비용
- **(a) Tier2 브라우저 추가 = 저~중 비용**: 순수 클라이언트 JS(npm + web worker), 백엔드 무변경. 단 데스크톱급·메모리 취약.
- **(b) Tier3 네이티브 전환 = 고비용**: React DOM→RN UI 재작성, 인증/라우팅/SSR 재구현, dev build/스토어 심사, 모델 다운로드(600MB~2GB), 기기별 QA. **백엔드(Prisma·API)는 재사용**. 멀티위크.
- **중간 경로**: 웹앱 + Gemini Live(클라우드) 기본 유지 + Tier2 데스크톱 프라이버시 폴백 + Tier3는 별도 트랙.

---

## 6. 권장 스택 (요약)

| 채널 | 스택 | 위상 |
|---|---|---|
| 기본(웹/폰) | **Gemini Live**(클라우드) | 출시 기본 |
| 전화 | Twilio Media Streams 브릿지 → Gemini Live | Phase 3b |
| 온디바이스(데스크톱 프라이버시) | Moonshine-ko + Qwen3/SmolLM + Supertonic3 (transformers.js) | 선택 PoC |
| 진짜 온디바이스(폰) | react-native-executorch + Gemma4/Supertonic3 | 별도 RN 트랙 |
| 자서전 오디오북 | VoxCPM2 배치(서버 GPU, 클로닝) | Phase 4 |

---

## 7. 주요 출처

**STT**: [Moonshine 논문](https://arxiv.org/pdf/2509.02523) · [Moonshine-tiny-ko](https://huggingface.co/UsefulSensors/moonshine-tiny-ko) · [Cohere Transcribe 03-2026](https://huggingface.co/blog/CohereLabs/cohere-transcribe-03-2026-release) · [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) · [transformers.js v3](https://huggingface.co/blog/transformersjs-v3) · [Apple SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/)

**LLM**: [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4) · [Gemma 3n](https://huggingface.co/blog/gemma3n) · [EXAONE 4.0 (NC)](https://github.com/LG-AI-EXAONE/EXAONE-4.0) · [Kanana (NC)](https://github.com/kakao/kanana) · [HyperCLOVA X SEED 1.5B](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B) · [Qwen3](https://qwenlm.github.io/blog/qwen3/) · [Phi-4-mini](https://huggingface.co/microsoft/Phi-4-mini-instruct)

**TTS**: [Supertonic 3](https://github.com/supertone-inc/supertonic) · [Supertonic CER 비교](https://www.supertone.ai/en/work/faster-and-more-accurate-across-31-languages----introducing-supertonic-3) · [Kokoro VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) · [VoxCPM2](https://huggingface.co/openbmb/VoxCPM2) · [kokoro.js](https://www.npmjs.com/package/kokoro-js) · [MeloTTS-Korean](https://huggingface.co/myshell-ai/MeloTTS-Korean)

**S2S**: [Raon-Speech (KRAFTON)](https://huggingface.co/KRAFTON/Raon-Speech-9B) · [HyperCLOVA X Omni 8B](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Omni-8B) · [Qwen3-Omni](https://github.com/QwenLM/Qwen3-Omni) · [Moshi](https://github.com/kyutai-labs/moshi) · [Gemma 3n audio](https://ai.google.dev/gemma/docs/capabilities/audio) · [Korean SpeechLM 서베이](https://arxiv.org/html/2605.27984)

**런타임**: [conversational-webgpu](https://huggingface.co/posts/Xenova/927328273503233) · [WebLLM](https://github.com/mlc-ai/web-llm) · [react-native-executorch](https://docs.swmansion.com/react-native-executorch/) · [ExecuTorch beta](https://pytorch.org/blog/executorch-beta/) · [MediaPipe LLM (Android)](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/android) · [iOS Safari WebGPU 한계](https://lapcatsoftware.com/articles/2026/1/7.html) · [WebGPU 브라우저 현황](https://web.dev/blog/webgpu-supported-major-browsers)

**전화/Gemini Live**: [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api?hl=ko) · [ZackAkil/gemini-live-twilio](https://github.com/ZackAkil/gemini-live-api-twilio-phone) · [Twilio×Gemini ConversationRelay](https://www.twilio.com/en-us/blog/developers/tutorials/product/integrate-google-gemini-twilio-voice-conversationrelay) · [Twilio KR Voice 가이드](https://www.twilio.com/en-us/guidelines/kr/south-korea-voice-guidelines---twilio)

> ⚠️ 일부 HuggingFace 모델 카드는 자동 fetch 403 → 라이선스/벤치마크는 GitHub·arXiv·검색 스니펫 기반. **상업 출시 전 EXAONE/Kanana/SEED 라이선스 원문과 Supertonic3/VoxCPM2/Kokoro 한국어 샘플을 직접 확인할 것.**
