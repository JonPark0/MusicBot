# Discord 다기능 봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

한국어 | [English](./README.md)

번역, TTS(Text-to-Speech), 음악 스트리밍 기능을 갖춘 강력한 셀프 호스팅 Discord 봇입니다. 개인 홈서버에 배포할 수 있도록 설계되었습니다.

## 주요 기능

### 번역 기능

- Google Gemini AI API를 사용한 채널 간 자동 번역
- LibreTranslate를 이용한 오프라인/백업 번역 지원
- Discord 포맷을 보존하는 문맥 인식 번역
- 양방향 번역 지원
- 다국어 지원: 한국어, 영어, 일본어, 중국어, 스페인어, 프랑스어, 독일어, 러시아어, 포르투갈어, 이탈리아어

### TTS (음성 합성)

- Coqui XTTS-v2 모델을 사용한 커스텀 음성 복제
- 사용자별 음성 등록 (6-12초 오디오 샘플)
- 사용자당 여러 음성 모델 등록 및 전환 가능
- 음성 채널에서 자동 재생
- 다국어 TTS 합성 지원

### 음악 스트리밍

- 멀티 플랫폼 지원: YouTube, Spotify, SoundCloud
- 실시간 스트리밍 (다운로드 불필요)
- 모든 플랫폼의 플레이리스트 지원
- 고급 큐 관리 (셔플, 반복, 제거)
- 볼륨 제어 및 재생 컨트롤

## 아키텍처

```
Docker Compose 스택
├── Discord Bot (Node.js/TypeScript)
├── TTS 서비스 (Python/FastAPI)
├── LibreTranslate (백업 번역)
├── PostgreSQL 데이터베이스
└── Redis 캐시 & 큐
```

## 기술 스택

- **Discord Bot**: Node.js, TypeScript, discord.js v14
- **TTS 서비스**: Python, FastAPI, Coqui XTTS-v2, PyTorch
- **번역**: Google Gemini 2.0 Flash, LibreTranslate
- **음악**: discord-player v7, FFmpeg, @discordjs/voice
- **데이터베이스**: PostgreSQL 15
- **캐시**: Redis 7
- **배포**: Docker, Docker Compose

## 요구 사항

- Docker & Docker Compose
- Discord Bot 토큰 ([여기서 생성](https://discord.com/developers/applications))
- Google Gemini API Key ([여기서 발급](https://aistudio.google.com/app/apikey))
- (선택) Spotify 지원을 위한 Client ID & Secret
- (선택) 더 빠른 TTS를 위한 NVIDIA GPU
- 최소 8GB RAM (TTS 사용 시 16GB 권장)
- 10GB 여유 디스크 공간

## 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot

# 2. 환경 파일 복사
cp .env.example .env

# 3. .env 파일 편집 후 토큰 입력
nano .env

# 4. 서비스 시작
docker-compose up -d

# 5. 슬래시 명령어 배포
docker-compose exec discord-bot npm run deploy-commands
```

## 설정

`.env` 파일에 자격 증명을 입력하세요:

```env
# 필수
DISCORD_TOKEN=디스코드_봇_토큰
DISCORD_CLIENT_ID=클라이언트_ID
GEMINI_API_KEY=제미나이_API_키
POSTGRES_PASSWORD=안전한_비밀번호
REDIS_PASSWORD=레디스_비밀번호

# 선택
SPOTIFY_CLIENT_ID=스포티파이_클라이언트_ID
SPOTIFY_CLIENT_SECRET=스포티파이_시크릿
```

## 문서

- [설치 가이드](./docs/SETUP.ko.md) - 상세한 설치 방법
- [명령어 레퍼런스](./docs/COMMANDS.ko.md) - 전체 명령어 목록
- [Setup Guide](./docs/SETUP.md) - English installation guide
- [Commands Reference](./docs/COMMANDS.md) - English commands list

## 보안 기능

- 서비스 간 내부 네트워크 통신만 허용
- 호스트 네트워크에 포트 노출 없음
- Redis 인증 필수
- 환경 변수 기반 자격 증명 관리
- 자동 리소스 정리

## 성능

- 번역: 메시지당 약 1-2초 (Gemini) 또는 0.5초 (캐시됨)
- TTS: 음성 생성 약 2-5초 (CPU), 1-2초 (GPU)
- 음악: 스트리밍을 통한 즉시 재생
- 리소스 사용량:
  - 봇: 약 200MB RAM
  - TTS 서비스: 약 2-4GB RAM (모델 로드 시)
  - LibreTranslate: 약 1GB RAM
  - PostgreSQL: 약 100MB RAM
  - Redis: 약 50MB RAM

## 기여

기여는 언제나 환영합니다! Pull Request를 자유롭게 제출해 주세요.

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

## 감사의 말

- [discord.js](https://discord.js.org/) - Discord API 라이브러리
- [Coqui TTS](https://github.com/coqui-ai/TTS) - XTTS-v2 모델
- [Google Gemini](https://ai.google.dev/) - AI 기반 번역
- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) - 오픈소스 번역
- [discord-player v7](https://github.com/discord-player v7/discord-player v7) - 음악 스트리밍 라이브러리

## 지원

문제가 있거나 질문이 있으시면:
- GitHub에서 이슈를 열어주세요
- 문제 해결은 [SETUP.ko.md](./docs/SETUP.ko.md)를 확인하세요
