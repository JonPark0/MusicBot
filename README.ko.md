# Discord 음악 스트리밍 봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

한국어 | [English](./README.md)

Lavalink를 지원하는 강력한 셀프 호스팅 Discord 음악 봇입니다. 개인 홈서버에 배포할 수 있도록 설계되었습니다.

## 주요 기능

### 음악 스트리밍

- 멀티 플랫폼 지원: YouTube, Spotify, SoundCloud, Bandcamp, Twitch
- Lavalink v4를 사용한 실시간 스트리밍 (다운로드 불필요)
- 모든 플랫폼의 플레이리스트 지원
- 고급 큐 관리 (셔플, 반복 모드, 건너뛰기, 제거)
- 볼륨 제어 및 재생 컨트롤
- 길드별 플레이어 관리
- 음악 재생 기록 추적

## 아키텍처

```
Docker Compose 스택
├── Discord Bot (Node.js 22 / TypeScript 5.9)
├── Lavalink v4 오디오 서버
├── PostgreSQL 17 데이터베이스
└── Redis 7 캐시
```

## 기술 스택

- **Discord Bot**: Node.js 22, TypeScript 5.9, discord.js v14.24
- **음악**: Lavalink v4, lavalink-client v2.5, @discordjs/voice 0.19
- **데이터베이스**: PostgreSQL 17
- **캐시**: Redis 7
- **배포**: Docker, Docker Compose

## 요구 사항

- Docker & Docker Compose
- Discord Bot 토큰 ([여기서 생성](https://discord.com/developers/applications))
- (선택) Spotify 지원 강화를 위한 Client ID & Secret
- (선택) 더 높은 속도 제한을 위한 YouTube API Key
- 최소 4GB RAM (8GB 권장)
- 5GB 여유 디스크 공간

## 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot

# 2. 환경 파일 복사
cp .env.example .env

# 3. .env 파일 편집 후 토큰 입력
nano .env

# 4. Discord Developer Portal 설정
# https://discord.com/developers/applications 접속
# 봇 선택 → Bot → "MESSAGE CONTENT INTENT"와 "SERVER MEMBERS INTENT" 활성화

# 5. 서비스 시작
docker compose up -d

# 6. 슬래시 명령어 배포
docker compose exec discord-bot npm run deploy-commands
```

## 설정

`.env` 파일에 인증 정보를 입력하세요:

```env
# 필수
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password

# 선택 - 음악 플랫폼 (API 키 없이도 작동)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_COOKIE=your_youtube_cookie

# Lavalink 설정
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

### Discord Developer Portal 설정

**중요**: 봇 설정에서 다음 Privileged Gateway Intent를 활성화해야 합니다:
1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. 애플리케이션 선택 → **Bot** 섹션
3. 다음 항목 활성화:
   - ✅ **MESSAGE CONTENT INTENT**
   - ✅ **SERVER MEMBERS INTENT**
4. 변경사항 저장

## 명령어

### 음악 명령어 (사용자)

- `/music play <검색어>` - 노래 재생 또는 대기열에 추가
- `/music pause` - 현재 재생 일시정지
- `/music resume` - 재생 재개
- `/music skip` - 현재 곡 건너뛰기
- `/music stop` - 재생 중지 및 대기열 삭제
- `/music queue` - 현재 대기열 보기
- `/music nowplaying` - 현재 재생 중인 트랙 표시
- `/music volume <레벨>` - 볼륨 설정 (0-100)
- `/music shuffle` - 대기열 셔플
- `/music loop <모드>` - 반복 모드 설정 (off, track, queue)
- `/music remove <위치>` - 대기열에서 트랙 제거

### 음악 명령어 (관리자)

- `/music-admin enable` - 현재 채널에서 음악 활성화
- `/music-admin disable` - 현재 채널에서 음악 비활성화
- `/music-admin config` - 음악 설정 보기

## 보안 기능

- 서비스 간 내부 네트워크 전용 통신
- 호스트 네트워크에 노출되는 포트 없음
- Redis 인증 필수
- 환경 기반 인증 정보 관리
- 자동 리소스 정리

## 성능

- 음악: Lavalink 스트리밍으로 거의 즉시 재생
- 리소스 사용량:
  - Bot: ~200MB RAM
  - Lavalink: ~500MB RAM
  - PostgreSQL: ~100MB RAM
  - Redis: ~50MB RAM

## 문제 해결

### 음악이 재생되지 않음

1. Lavalink가 실행 중인지 확인: `docker compose logs lavalink`
2. 봇이 서버에서 음성 권한을 가지고 있는지 확인
3. 음악을 재생하기 전에 음성 채널에 있는지 확인

### 봇이 응답하지 않음

1. 봇 로그 확인: `docker compose logs discord-bot`
2. Developer Portal에서 Discord Intent가 활성화되었는지 확인
3. 슬래시 명령어가 배포되었는지 확인: `docker compose exec discord-bot npm run deploy-commands`

## 개발

```bash
# 로그 보기
docker compose logs -f discord-bot

# 봇 재시작
docker compose restart discord-bot

# 코드 변경 후 재빌드
docker compose up -d --build discord-bot

# 모든 서비스 중지
docker compose down
```

## 기여

기여는 언제나 환영합니다! Pull Request를 자유롭게 제출해주세요.

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 감사의 말

- [discord.js](https://discord.js.org/) - Discord API 라이브러리
- [Lavalink](https://github.com/lavalink-devs/Lavalink) - 오디오 스트리밍 서버
- [lavalink-client](https://github.com/Tomato6966/lavalink-client) - Lavalink 클라이언트 라이브러리

## 지원

이슈 및 질문:
- GitHub에 이슈 등록
- 문제 해결은 문서 참조
