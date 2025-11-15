# 설치 가이드

Discord 다기능 봇 설치를 위한 완벽한 가이드입니다.

## 목차

1. [요구 사항](#요구-사항)
2. [Discord Bot 설정](#discord-bot-설정)
3. [API 키 설정](#api-키-설정)
4. [설치](#설치)
5. [구성](#구성)
6. [봇 시작하기](#봇-시작하기)
7. [문제 해결](#문제-해결)

## 요구 사항

### 필수

- **Docker** (v20.10 이상) & **Docker Compose** (v2.0 이상)
- **Discord Bot 토큰**
- **Google Gemini API Key** (무료 사용 가능)
- 최소 **8GB RAM** (TTS 사용 시 16GB 권장)
- **10GB 여유 디스크 공간**

### 선택

- **NVIDIA GPU** CUDA 지원 (더 빠른 TTS를 위함)
- **Spotify Client ID & Secret** (Spotify 음악 지원)
- **YouTube API Key** (더 나은 검색 결과)

## Discord Bot 설정

### 1. Discord Application 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속
2. "New Application" 클릭
3. 이름 입력 (예: "Multi-Function Bot")
4. "Create" 클릭

### 2. Bot 사용자 생성

1. "Bot" 탭으로 이동
2. "Add Bot" 클릭
3. "Privileged Gateway Intents" 아래에서 다음 항목 활성화:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
4. "Reset Token"을 클릭하여 토큰 복사 (안전하게 보관)

### 3. Bot 권한 설정

"Bot" > "Bot Permissions"에서 다음 권한 선택:
- Read Messages/View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Connect (Voice)
- Speak (Voice)
- Use Voice Activity

### 4. Slash Commands 활성화

1. "OAuth2" > "General"로 이동
2. "Client ID"를 메모

### 5. 서버에 Bot 초대

다음 URL 사용 (CLIENT_ID를 실제 Client ID로 교체):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=36768832&scope=bot%20applications.commands
```

## API 키 설정

### Google Gemini API Key

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "Create API Key" 클릭
3. "Create API key in new project" 선택 또는 기존 프로젝트 선택
4. API 키 복사

**참고**: Gemini 2.0 Flash는 무료 등급 제공 (일일 1500 요청).

### Spotify API (선택)

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 접속
2. "Create an App" 클릭
3. 앱 이름과 설명 입력
4. 약관 동의 후 "Create" 클릭
5. "Client ID"와 "Client Secret" 메모

### YouTube API (선택)

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성
3. "YouTube Data API v3" 활성화
4. 자격 증명 생성 (API Key)
5. API 키 복사

## 설치

### 1. 저장소 클론

```bash
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot
```

### 2. 환경 파일 생성

```bash
cp .env.example .env
```

### 3. 환경 변수 편집

`.env` 파일을 편집기로 열기:

```bash
nano .env
# 또는
vim .env
```

필수 값 입력:

```env
# Discord (필수)
DISCORD_TOKEN=여기에_디스코드_봇_토큰_입력
DISCORD_CLIENT_ID=여기에_클라이언트_ID_입력

# Google Gemini (필수)
GEMINI_API_KEY=여기에_제미나이_API_키_입력

# Database (필수 - 강력한 비밀번호 사용)
POSTGRES_PASSWORD=안전한_비밀번호_입력
REDIS_PASSWORD=레디스_비밀번호_입력

# Spotify (선택)
SPOTIFY_CLIENT_ID=스포티파이_클라이언트_ID
SPOTIFY_CLIENT_SECRET=스포티파이_시크릿

# YouTube (선택)
YOUTUBE_API_KEY=유튜브_API_키
```

## 봇 시작하기

### 1. 서비스 빌드 및 시작

```bash
docker-compose up -d
```

다음 작업이 수행됩니다:
- 필요한 Docker 이미지 다운로드
- Bot 및 TTS 서비스 컨테이너 빌드
- PostgreSQL 및 Redis 시작
- 데이터베이스 초기화
- 모든 서비스 시작

**참고**: 첫 빌드는 10-15분 소요될 수 있습니다.

### 2. 서비스 상태 확인

```bash
docker-compose ps
```

모든 서비스가 "Up" 상태여야 합니다.

### 3. 로그 확인

```bash
# 모든 서비스
docker-compose logs -f

# 특정 서비스
docker-compose logs -f discord-bot
docker-compose logs -f tts-service
```

### 4. Slash 명령어 배포

```bash
docker-compose exec discord-bot npm run deploy-commands
```

"Successfully reloaded X application (/) commands." 메시지가 표시되어야 합니다.

### 5. 봇 온라인 확인

Discord 서버에서 봇이 온라인 상태인지 확인하세요.

## GPU 지원 (선택)

TTS를 위한 GPU 가속 활성화:

### 1. NVIDIA Container Toolkit 설치

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### 2. GPU 액세스 확인

```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### 3. GPU 설정 활성화

`docker-compose.yml`에서 `tts-service`의 GPU 섹션 주석 해제:

```yaml
tts-service:
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### 4. 서비스 재시작

```bash
docker-compose down
docker-compose up -d
```

## 채널 설정

### 번역

1. Discord 서버에서 실행:
   ```
   /translate-admin setup
   ```
2. 소스 및 대상 채널 선택
3. 언어 선택
4. 양방향 번역 활성화

### TTS

1. 텍스트 채널에서 TTS 활성화:
   ```
   /tts-admin enable-channel channel:#tts-chat
   ```
2. 음성 등록:
   ```
   /tts register voice-name:"내 음성" audio-file:[6-10초 오디오 업로드]
   ```

### 음악

1. 텍스트 채널에서 음악 활성화:
   ```
   /music-admin enable-channel channel:#music-requests
   ```
2. 음악 재생:
   ```
   /music play url:https://youtube.com/watch?v=...
   ```

## 문제 해결

### 봇이 시작되지 않음

**로그 확인:**
```bash
docker-compose logs discord-bot
```

**일반적인 문제:**
- Discord 토큰이 잘못됨 → `.env` 확인
- 데이터베이스 연결 실패 → PostgreSQL 실행 확인
- 포트 충돌 → 포트 5432, 6379, 5000, 8000이 사용 가능한지 확인

### 번역이 작동하지 않음

**확인 사항:**
- Gemini API 키가 유효한지
- LibreTranslate가 실행 중인지: `docker-compose logs libretranslate`
- 번역 쌍이 올바르게 구성되었는지
- 채널이 활성화되어 있는지

**Gemini API 테스트:**
```bash
docker-compose exec discord-bot node -e "console.log(process.env.GEMINI_API_KEY)"
```

### TTS 서비스 오류

**로그 확인:**
```bash
docker-compose logs tts-service
```

**일반적인 문제:**
- 메모리 부족 → Docker 메모리 제한 증가 (4GB+ 필요)
- 모델 다운로드 실패 → 인터넷 연결 확인, 서비스 재시작
- 오디오 파일 형식 오류 → WAV/MP3 형식, 6-12초 길이 사용

**TTS 서비스 재시작:**
```bash
docker-compose restart tts-service
```

### 음악 재생 문제

**확인 사항:**
- 사용자가 음성 채널에 있는지
- 음악 채널이 활성화되어 있는지
- FFmpeg가 설치되어 있는지 (Docker 이미지에 포함됨)
- discord-player v7이 URL에 접근할 수 있는지

### 데이터베이스 연결 문제

**데이터베이스 재설정:**
```bash
docker-compose down -v
docker-compose up -d
```

**경고**: 모든 데이터가 삭제됩니다!

### 일반 디버그 모드

`.env`에서 디버그 로깅 활성화:
```env
LOG_LEVEL=debug
```

서비스 재시작:
```bash
docker-compose restart
```

## 봇 업데이트

```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose exec discord-bot npm run deploy-commands
```

## 백업 및 복원

### 백업

```bash
# 데이터베이스 백업
docker-compose exec postgres pg_dump -U postgres discord_bot > backup.sql

# 음성 파일 백업
tar -czf voices_backup.tar.gz data/voices/
```

### 복원

```bash
# 데이터베이스 복원
docker-compose exec -T postgres psql -U postgres discord_bot < backup.sql

# 음성 파일 복원
tar -xzf voices_backup.tar.gz
```

## 성능 튜닝

### 메모리가 부족한 시스템 (<8GB RAM)

`docker-compose.yml`에서:

```yaml
tts-service:
  environment:
    - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
  mem_limit: 2g
```

### 고성능 시스템

`.env`에서 워커 스레드 증가:
```env
TTS_QUEUE_SIZE=20
MUSIC_MAX_QUEUE_SIZE=200
```

## 보안 권장사항

1. `.env`를 절대 버전 관리에 커밋하지 마세요
2. 강력한 PostgreSQL 비밀번호 사용
3. Docker 이미지를 정기적으로 업데이트
4. 서버에서 방화벽 활성화
5. Discord 봇 권한을 최소 필요 권한으로 제한
6. 의심스러운 활동을 로그에서 모니터링

## 도움 받기

- [일반적인 문제](#문제-해결) 확인
- 로그 검토: `docker-compose logs`
- GitHub에서 이슈 열기

## 다음 단계

- 번역 채널 구성
- TTS 음성 등록
- 음악 채널 설정
- 모든 사용 가능한 명령어는 [COMMANDS.ko.md](./COMMANDS.ko.md) 참조
