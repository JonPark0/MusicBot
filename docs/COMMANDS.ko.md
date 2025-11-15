# 명령어 레퍼런스

기능별로 정리된 모든 봇 명령어 목록입니다.

## 목차

- [번역 명령어](#번역-명령어)
- [TTS 명령어](#tts-명령어)
- [음악 명령어](#음악-명령어)
- [권한 수준](#권한-수준)

## 권한 수준

- 관리자: Administrator 권한 또는 서버 소유자 필요
- 사용자: 모든 서버 멤버 사용 가능

---

## 번역 명령어

### 관리자 명령어

#### `/translate-admin setup`
두 채널 간 자동 번역을 설정합니다.

**옵션:**
- `source-channel` (필수): 소스 텍스트 채널
- `target-channel` (필수): 대상 텍스트 채널
- `source-lang` (필수): 소스 언어 코드
- `target-lang` (필수): 대상 언어 코드
- `bidirectional` (선택): 양방향 번역 활성화 (기본값: true)

**예제:**
```
/translate-admin setup
  source-channel: #한국어-채팅
  target-channel: #english-chat
  source-lang: Korean
  target-lang: English
  bidirectional: true
```

**결과:** #한국어-채팅의 메시지가 자동으로 영어로 번역되어 #english-chat에 게시되며, 그 반대도 마찬가지입니다.

#### `/translate-admin remove`
번역 채널 쌍을 제거합니다.

**옵션:**
- `pair-id` (필수): `/translate-admin list`에서 확인한 번역 쌍 ID

#### `/translate-admin list`
서버의 모든 구성된 번역 쌍을 나열합니다.

#### `/translate-admin enable`
이전에 비활성화된 번역 쌍을 활성화합니다.

**옵션:**
- `pair-id` (필수): 번역 쌍 ID

#### `/translate-admin disable`
번역 쌍을 삭제하지 않고 비활성화합니다.

**옵션:**
- `pair-id` (필수): 번역 쌍 ID

### 사용자 명령어

#### `/translate status`
현재 채널의 번역 활성화 여부를 확인합니다.

---

## TTS 명령어

### 관리자 명령어

#### `/tts-admin enable-channel`
텍스트 채널에서 TTS 기능을 활성화합니다.

**옵션:**
- `channel` (필수): TTS를 활성화할 텍스트 채널
- `auto-join` (선택): 사용자의 음성 채널에 자동 입장 (기본값: true)

**예제:**
```
/tts-admin enable-channel channel: #tts-채팅 auto-join: true
```

**사용법:** 활성화되면 #tts-채팅에 입력하는 사용자의 메시지가 등록된 음성을 사용하여 현재 음성 채널에서 읽혀집니다.

#### `/tts-admin disable-channel`
채널에서 TTS 기능을 비활성화합니다.

**옵션:**
- `channel` (필수): TTS를 비활성화할 텍스트 채널

#### `/tts-admin list-channels`
모든 TTS 활성화 채널을 나열합니다.

### 사용자 명령어

#### `/tts register`
TTS용 새 음성 모델을 등록합니다.

**옵션:**
- `voice-name` (필수): 이 음성의 이름 (예: "내 음성", "캐주얼")
- `audio-file` (필수): 오디오 샘플 파일 (WAV/MP3/OGG, 6-12초)
- `language` (선택): 음성 언어 (기본값: English)

**예제:**
```
/tts register
  voice-name: "내 한국어 음성"
  audio-file: [오디오 파일 첨부]
  language: Korean
```

**요구 사항:**
- 오디오 길이: 6-12초
- 깨끗한 오디오 품질
- 일관된 말하기 음성
- 배경 소음 최소화

**팁:**
- 조용한 환경에서 녹음
- 자연스럽고 명확하게 말하기
- 합성하려는 언어를 사용

#### `/tts select`
TTS에 사용할 음성을 선택합니다.

**옵션:**
- `voice-name` (필수): 등록된 음성 이름

#### `/tts list`
등록된 모든 음성을 나열합니다.

#### `/tts delete`
등록된 음성을 삭제합니다.

**옵션:**
- `voice-name` (필수): 삭제할 음성

#### `/tts preview`
사용자 지정 텍스트로 음성을 미리 듣습니다.

**옵션:**
- `voice-name` (필수): 미리 들을 음성
- `text` (필수): 읽을 텍스트 (최대 200자)

**예제:**
```
/tts preview
  voice-name: "내 한국어 음성"
  text: "안녕하세요! 이것은 제 음성의 미리듣기입니다."
```

#### `/tts set-default`
음성을 기본값으로 설정합니다.

**옵션:**
- `voice-name` (필수): 기본값으로 설정할 음성

---

## 음악 명령어

### 관리자 명령어

#### `/music-admin enable-channel`
텍스트 채널에서 음악 봇을 활성화합니다.

**옵션:**
- `channel` (필수): 음악 명령어를 위한 텍스트 채널
- `max-queue-size` (선택): 최대 큐 크기 (기본값: 100)
- `max-duration` (선택): 최대 트랙 길이(초) (기본값: 3600)

**예제:**
```
/music-admin enable-channel
  channel: #음악-요청
  max-queue-size: 50
  max-duration: 1800
```

#### `/music-admin disable-channel`
채널에서 음악 봇을 비활성화합니다.

**옵션:**
- `channel` (필수): 비활성화할 텍스트 채널

#### `/music-admin list-channels`
모든 음악 활성화 채널과 설정을 나열합니다.

#### `/music-admin set-volume-limit`
서버의 최대 볼륨 제한을 설정합니다.

**옵션:**
- `max-volume` (필수): 최대 볼륨 (1-200%)

### 사용자 명령어

#### `/music play`
YouTube, Spotify 또는 SoundCloud에서 트랙 또는 플레이리스트를 재생합니다.

**옵션:**
- `url` (필수): URL 또는 검색 쿼리

**지원되는 URL:**
- YouTube 비디오: `https://youtube.com/watch?v=...`
- YouTube 플레이리스트: `https://youtube.com/playlist?list=...`
- Spotify 트랙: `https://open.spotify.com/track/...`
- Spotify 플레이리스트: `https://open.spotify.com/playlist/...`
- Spotify 앨범: `https://open.spotify.com/album/...`
- SoundCloud 트랙: `https://soundcloud.com/...`
- SoundCloud 플레이리스트: `https://soundcloud.com/.../sets/...`

**검색:**
```
/music play url: 로파이 힙합 비트
```

**예제:**
```
/music play url: https://youtube.com/watch?v=dQw4w9WgXcQ
/music play url: https://open.spotify.com/track/...
/music play url: 잔잔한 재즈 음악
```

**참고:** 이 명령어를 사용하려면 음성 채널에 있어야 합니다.

#### `/music pause`
현재 트랙을 일시 중지합니다.

#### `/music resume`
재생을 재개합니다.

#### `/music skip`
큐의 다음 트랙으로 건너뜁니다.

#### `/music stop`
재생을 중지하고 큐를 지웁니다. 봇이 음성 채널에서 나갑니다.

#### `/music queue`
현재 음악 큐를 표시합니다.

**옵션:**
- `page` (선택): 긴 큐의 페이지 번호

**예제:**
```
/music queue page: 1
```

#### `/music nowplaying`
현재 재생 중인 트랙에 대한 정보를 표시합니다.

#### `/music volume`
재생 볼륨을 설정합니다.

**옵션:**
- `level` (필수): 볼륨 레벨 (1-100)

**예제:**
```
/music volume level: 75
```

#### `/music shuffle`
현재 큐를 섞습니다.

#### `/music loop`
반복 모드를 설정합니다.

**옵션:**
- `mode` (필수): 반복 모드
  - `Off`: 반복 없음
  - `Track`: 현재 트랙 반복
  - `Queue`: 전체 큐 반복

**예제:**
```
/music loop mode: Queue
```

**반복 모드 설명:**
- **Off**: 일반 재생, 모든 트랙이 재생되면 큐 종료
- **Track**: 현재 트랙 무한 반복
- **Queue**: 큐가 끝나면 처음부터 다시 시작

#### `/music remove`
큐에서 트랙을 제거합니다.

**옵션:**
- `position` (필수): 큐에서의 트랙 위치 (1부터 시작)

**예제:**
```
/music remove position: 3
```

---

## 지원 언어

### 번역
- **한국어** (ko)
- **영어** (en)
- **일본어** (ja)
- **중국어** (zh)
- **스페인어** (es)
- **프랑스어** (fr)
- **독일어** (de)
- **러시아어** (ru)
- **포르투갈어** (pt)
- **이탈리아어** (it)

### TTS
- **한국어** (ko)
- **영어** (en)
- **일본어** (ja)
- **중국어** (zh-cn)
- **스페인어** (es)
- **프랑스어** (fr)
- **독일어** (de)
- **포르투갈어** (pt)
- **이탈리아어** (it)
- **폴란드어** (pl)
- **터키어** (tr)
- **러시아어** (ru)
- **네덜란드어** (nl)
- **체코어** (cs)
- **아랍어** (ar)
- **헝가리어** (hu)

---

## 팁 및 모범 사례

### 번역
- 활발한 대화를 위해 양방향 쌍 설정
- 공지 채널에는 단방향 번역 사용
- 번역은 완전한 문장에서 가장 잘 작동
- Discord 포맷(멘션, 이모지)이 보존됨

### TTS
- 조용한 환경에서 음성 샘플 녹음
- 녹음에서 명확하고 자연스러운 말하기 사용
- 8-10초가 최적의 음성 샘플 길이
- 다양한 분위기/스타일을 위해 여러 음성 등록
- 매번 선택하지 않으려면 기본 음성 설정

### 음악
- 일반적인 사용 사례를 위한 플레이리스트 생성
- 배경 음악에는 반복 모드 사용
- 왜곡 방지를 위해 적절한 볼륨 사용
- 긴 플레이리스트에는 셔플 사용
- Spotify 트랙은 자동으로 YouTube로 변환됨

---

## 명령어 쿨다운 및 제한

- **번역**: 쿨다운 없음 (자동)
- **TTS 등록**: 사용자당 분당 1회
- **TTS 재생**: 큐 기반, 쿨다운 없음
- **음악 재생**: 사용자당 3초당 1회
- **음악 큐**: 최대 100개 트랙 (관리자가 구성 가능)
- **음악 트랙 길이**: 최대 1시간 (관리자가 구성 가능)

---

## 오류 메시지

일반적인 오류 메시지 및 해결 방법:

| 오류 | 해결 방법 |
|------|----------|
| "Permission Denied" | 이 명령어에는 관리자 권한이 필요합니다 |
| "Not in Voice Channel" | 먼저 음성 채널에 입장하세요 |
| "Voice not found" | `/tts register`로 음성 등록 |
| "Translation pair not found" | `/translate-admin list`로 쌍 ID 확인 |
| "Track not found" | URL 확인 또는 다른 검색어 시도 |
| "Queue is full" | 트랙이 끝날 때까지 대기하거나 관리자에게 제한 증가 요청 |
| "Invalid audio format" | WAV, MP3 또는 OGG 형식 사용 |
| "Audio too short/long" | TTS 샘플은 6-12초여야 함 |

---

## 사용 예제

### 예제 1: 국제 서버

**설정:**
```
/translate-admin setup
  source-channel: #한국어
  target-channel: #english
  source-lang: Korean
  target-lang: English
  bidirectional: true

/translate-admin setup
  source-channel: #日本語
  target-channel: #english
  source-lang: Japanese
  target-lang: English
  bidirectional: true
```

**결과:** 한국어, 일본어, 영어 사용자 모두 모국어로 소통 가능.

### 예제 2: 음성 독서실

**설정:**
```
/tts-admin enable-channel channel: #독서실 auto-join: true
```

**사용법:**
1. 사용자가 `/tts register`로 음성 등록
2. 사용자가 음성 채널 입장
3. 사용자가 #독서실에 메시지 입력
4. 봇이 사용자의 음성으로 메시지를 읽음

### 예제 3: 24/7 음악 채널

**설정:**
```
/music-admin enable-channel
  channel: #로파이-라디오
  max-queue-size: 200
  max-duration: 7200
```

**사용법:**
```
/music play url: [긴 로파이 플레이리스트]
/music loop mode: Queue
/music volume level: 30
```

**결과:** 음성 채널에서 연속 배경 음악.

---

## 추가 리소스

- [설치 가이드](./SETUP.ko.md) - 설치 및 구성
- [README](../README.ko.md) - 프로젝트 개요
- [GitHub Issues](https://github.com/yourusername/discord_bot/issues) - 버그 리포트 및 기능 요청
