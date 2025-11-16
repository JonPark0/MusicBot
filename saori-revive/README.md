# Saori Music Bot

Discord 음악 봇 사오리입니다. Lavalink v4를 사용하여 고품질 음악 스트리밍을 제공합니다.

## 주요 기능

- **음악 재생**: YouTube 검색 및 URL 지원
- **큐 관리**: 재생목록 추가, 건너뛰기, 정지
- **실시간 UI**: 현재 재생 중인 곡 정보 및 진행률
- **음성 제어**: 볼륨 조절, 일시정지, 재개
- **Seek 기능**: 특정 시간으로 이동
- **길드별 설정**: 타임아웃, 최대 큐 크기 설정

## 설치 요구사항

### Python 패키지
```bash
pip install -r requirements.txt
```

### Lavalink 서버
1. [Lavalink v4](https://github.com/freyacodes/Lavalink/releases) 다운로드
2. Java 17+ 설치
3. Lavalink 서버 실행:
```bash
java -jar Lavalink.jar
```

## 설정

### 설정 파일 생성
1. `config.example.json`을 `config.json`으로 복사:
```bash
cp config.example.json config.json
```

2. `config.json`에서 설정을 수정하세요:

```json
{
  "bot_token": "YOUR_BOT_TOKEN_HERE",
  "lavalink": {
    "host": "localhost",
    "port": 2333,
    "password": "youshallnotpass",
    "region": "us",
    "name": "default-node"
  }
}
```

### 보안 주의사항
- `config.json`은 `.gitignore`에 포함되어 Git에 업로드되지 않습니다
- 봇 토큰과 Lavalink 비밀번호를 안전하게 보관하세요

## 사용 가능한 명령어

- `/join` - 음성 채널 입장
- `/play <곡명/URL>` - 음악 재생
- `/pause` - 재생 일시정지
- `/resume` - 재생 재개
- `/stop` - 재생 중지 및 큐 초기화
- `/skip` - 현재 곡 건너뛰기
- `/queue` - 재생목록 표시
- `/np` - 현재 재생 중인 곡 정보
- `/volume <0-100>` - 볼륨 조절
- `/seek <시간>` - 특정 시간으로 이동 (MM:SS 또는 HH:MM:SS)
- `/set_timeout <초>` - 자동 퇴장 시간 설정
- `/set_max_queue <크기>` - 최대 큐 크기 설정
- `/help` - 명령어 도움말

## 실행

```bash
python main.py
```

## 주의사항

1. **Lavalink 서버가 먼저 실행되어야 합니다**
2. 봇과 Lavalink 서버가 같은 네트워크에 있어야 합니다
3. 공개 서버 사용 시 방화벽 설정을 확인하세요

## 변경사항

- ytdl + ffmpeg → Lavalink v4 마이그레이션
- 성능 및 안정성 개선
- Seek 기능 활성화
- Pause/Resume 기능 추가