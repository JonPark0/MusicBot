# Commands Reference

Complete list of all bot commands organized by feature.

## Table of Contents

- [Translation Commands](#translation-commands)
- [TTS Commands](#tts-commands)
- [Music Commands](#music-commands)
- [Permission Levels](#permission-levels)

## Permission Levels

- 🔧 **Admin Only**: Requires Administrator permission or server ownership
- 👤 **User**: Available to all server members

---

## Translation Commands

### 🔧 Admin Commands

#### `/translate-admin setup`
Set up automatic translation between two channels.

**Options:**
- `source-channel` (required): Source text channel
- `target-channel` (required): Target text channel
- `source-lang` (required): Source language code
- `target-lang` (required): Target language code
- `bidirectional` (optional): Enable bidirectional translation (default: true)

**Example:**
```
/translate-admin setup
  source-channel: #korean-chat
  target-channel: #english-chat
  source-lang: Korean
  target-lang: English
  bidirectional: true
```

**Result:** Messages in #korean-chat will be automatically translated to English and posted in #english-chat, and vice versa.

---

#### `/translate-admin remove`
Remove a translation channel pair.

**Options:**
- `pair-id` (required): Translation pair ID from `/translate-admin list`

**Example:**
```
/translate-admin remove pair-id: 1
```

---

#### `/translate-admin list`
List all configured translation pairs for the server.

**Example:**
```
/translate-admin list
```

**Output:**
```
ID 1 ✅
#korean-chat (ko) ↔ #english-chat (en)

ID 2 ✅
#japanese-chat (ja) → #english-chat (en)
```

---

#### `/translate-admin enable`
Enable a previously disabled translation pair.

**Options:**
- `pair-id` (required): Translation pair ID

---

#### `/translate-admin disable`
Disable a translation pair without deleting it.

**Options:**
- `pair-id` (required): Translation pair ID

---

### 👤 User Commands

#### `/translate status`
Check if the current channel has translation enabled.

**Example:**
```
/translate status
```

**Output:**
```
✅ Enabled
#korean-chat (ko) ↔ #english-chat (en)
```

---

## TTS Commands

### 🔧 Admin Commands

#### `/tts-admin enable-channel`
Enable TTS feature in a text channel.

**Options:**
- `channel` (required): Text channel to enable TTS
- `auto-join` (optional): Automatically join user's voice channel (default: true)

**Example:**
```
/tts-admin enable-channel channel: #tts-chat auto-join: true
```

**Usage:** When enabled, users who type in #tts-chat will have their messages read aloud in their current voice channel using their registered voice.

---

#### `/tts-admin disable-channel`
Disable TTS feature in a channel.

**Options:**
- `channel` (required): Text channel to disable TTS

---

#### `/tts-admin list-channels`
List all TTS-enabled channels.

**Example:**
```
/tts-admin list-channels
```

---

### 👤 User Commands

#### `/tts register`
Register a new voice model for TTS.

**Options:**
- `voice-name` (required): Name for this voice (e.g., "My Voice", "Casual")
- `audio-file` (required): Audio sample file (WAV/MP3/OGG, 6-12 seconds)
- `language` (optional): Voice language (default: English)

**Example:**
```
/tts register
  voice-name: "My English Voice"
  audio-file: [attach audio file]
  language: English
```

**Requirements:**
- Audio duration: 6-12 seconds
- Clear audio quality
- Consistent speaking voice
- Minimal background noise

**Tips:**
- Record in a quiet environment
- Speak naturally and clearly
- Use the language you want to synthesize in

---

#### `/tts select`
Select which voice to use for TTS.

**Options:**
- `voice-name` (required): Name of registered voice

**Example:**
```
/tts select voice-name: "My English Voice"
```

---

#### `/tts list`
List all your registered voices.

**Example:**
```
/tts list
```

**Output:**
```
⭐ My English Voice - 8.2s
   My Korean Voice - 7.5s
   Funny Voice - 6.8s
```

(⭐ indicates default voice)

---

#### `/tts delete`
Delete a registered voice.

**Options:**
- `voice-name` (required): Voice to delete

**Example:**
```
/tts delete voice-name: "Old Voice"
```

---

#### `/tts preview`
Preview a voice with custom text.

**Options:**
- `voice-name` (required): Voice to preview
- `text` (required): Text to speak (max 200 characters)

**Example:**
```
/tts preview
  voice-name: "My English Voice"
  text: "Hello! This is a preview of my voice."
```

**Result:** Bot will send an audio file with the generated speech.

---

#### `/tts set-default`
Set a voice as your default.

**Options:**
- `voice-name` (required): Voice to set as default

**Example:**
```
/tts set-default voice-name: "My English Voice"
```

---

## Music Commands

### 🔧 Admin Commands

#### `/music-admin enable-channel`
Enable music bot in a text channel.

**Options:**
- `channel` (required): Text channel for music commands
- `max-queue-size` (optional): Maximum queue size (default: 100)
- `max-duration` (optional): Maximum track duration in seconds (default: 3600)

**Example:**
```
/music-admin enable-channel
  channel: #music-requests
  max-queue-size: 50
  max-duration: 1800
```

---

#### `/music-admin disable-channel`
Disable music bot in a channel.

**Options:**
- `channel` (required): Text channel to disable

---

#### `/music-admin list-channels`
List all music-enabled channels and their settings.

**Example:**
```
/music-admin list-channels
```

**Output:**
```
#music-requests - ✅ Enabled
  Queue: 100 | Duration: 3600s | Volume: 100%
```

---

#### `/music-admin set-volume-limit`
Set maximum volume limit for the server.

**Options:**
- `max-volume` (required): Maximum volume (1-200%)

**Example:**
```
/music-admin set-volume-limit max-volume: 150
```

---

### 👤 User Commands

#### `/music play`
Play a track or playlist from YouTube, Spotify, or SoundCloud.

**Options:**
- `url` (required): URL or search query

**Supported URLs:**
- YouTube videos: `https://youtube.com/watch?v=...`
- YouTube playlists: `https://youtube.com/playlist?list=...`
- Spotify tracks: `https://open.spotify.com/track/...`
- Spotify playlists: `https://open.spotify.com/playlist/...`
- Spotify albums: `https://open.spotify.com/album/...`
- SoundCloud tracks: `https://soundcloud.com/...`
- SoundCloud playlists: `https://soundcloud.com/.../sets/...`

**Search:**
```
/music play url: lofi hip hop beats
```

**Examples:**
```
/music play url: https://youtube.com/watch?v=dQw4w9WgXcQ
/music play url: https://open.spotify.com/track/...
/music play url: chill jazz music
```

**Note:** You must be in a voice channel to use this command.

---

#### `/music pause`
Pause the current track.

**Example:**
```
/music pause
```

---

#### `/music resume`
Resume playback.

**Example:**
```
/music resume
```

---

#### `/music skip`
Skip to the next track in queue.

**Example:**
```
/music skip
```

---

#### `/music stop`
Stop playback and clear the queue. Bot will leave the voice channel.

**Example:**
```
/music stop
```

---

#### `/music queue`
Show the current music queue.

**Options:**
- `page` (optional): Page number for long queues

**Example:**
```
/music queue page: 1
```

**Output:**
```
🎵 Music Queue

1. Lofi Hip Hop Mix [1:30:00] - @User1
2. Chill Jazz Playlist [45:20] - @User2
3. Study Music [2:00:00] - @User1

Queue Info
Total tracks: 15
Total duration: 4h 25m
Loop: off

Page 1/2
```

---

#### `/music nowplaying`
Show information about the currently playing track.

**Example:**
```
/music nowplaying
```

**Output:**
```
🎵 Now Playing

Lofi Hip Hop Mix
Platform: YOUTUBE | Duration: 1:30:00
Requested by: @User1
Volume: 50%
```

---

#### `/music volume`
Set playback volume.

**Options:**
- `level` (required): Volume level (1-100)

**Example:**
```
/music volume level: 75
```

---

#### `/music shuffle`
Shuffle the current queue.

**Example:**
```
/music shuffle
```

---

#### `/music loop`
Set loop mode.

**Options:**
- `mode` (required): Loop mode
  - `Off`: No looping
  - `Track`: Loop current track
  - `Queue`: Loop entire queue

**Example:**
```
/music loop mode: Queue
```

**Loop Modes Explained:**
- **Off**: Normal playback, queue ends when all tracks are played
- **Track**: Current track repeats indefinitely
- **Queue**: When queue ends, it restarts from the beginning

---

#### `/music remove`
Remove a track from the queue.

**Options:**
- `position` (required): Track position in queue (1-based)

**Example:**
```
/music remove position: 3
```

---

## Supported Languages

### Translation
- **English** (en)
- **Korean** (ko)
- **Japanese** (ja)
- **Chinese** (zh)
- **Spanish** (es)
- **French** (fr)
- **German** (de)
- **Russian** (ru)
- **Portuguese** (pt)
- **Italian** (it)

### TTS
- **English** (en)
- **Korean** (ko)
- **Japanese** (ja)
- **Chinese** (zh-cn)
- **Spanish** (es)
- **French** (fr)
- **German** (de)
- **Portuguese** (pt)
- **Italian** (it)
- **Polish** (pl)
- **Turkish** (tr)
- **Russian** (ru)
- **Dutch** (nl)
- **Czech** (cs)
- **Arabic** (ar)
- **Hungarian** (hu)

---

## Tips and Best Practices

### Translation
- Set up bidirectional pairs for active conversations
- Use one-way translation for announcement channels
- Translation works best with complete sentences
- Discord formatting (mentions, emojis) is preserved

### TTS
- Record voice samples in a quiet environment
- Use clear, natural speech in your recordings
- 8-10 seconds is optimal length for voice samples
- Register multiple voices for different moods/styles
- Set a default voice to avoid selecting each time

### Music
- Create playlists for common use cases
- Use loop mode for background music
- Moderate volume to avoid distortion
- Use shuffle for variety in long playlists
- Spotify tracks are automatically converted to YouTube

---

## Command Cooldowns and Limits

- **Translation**: No cooldown (automatic)
- **TTS Register**: 1 per minute per user
- **TTS Playback**: Queue-based, no cooldown
- **Music Play**: 1 per 3 seconds per user
- **Music Queue**: Max 100 tracks (configurable by admin)
- **Music Track Duration**: Max 1 hour (configurable by admin)

---

## Error Messages

Common error messages and their solutions:

| Error | Solution |
|-------|----------|
| "Permission Denied" | You need admin permissions for this command |
| "Not in Voice Channel" | Join a voice channel first |
| "Voice not found" | Register a voice with `/tts register` |
| "Translation pair not found" | Check pair ID with `/translate-admin list` |
| "Track not found" | Check URL or try a different search query |
| "Queue is full" | Wait for tracks to finish or ask admin to increase limit |
| "Invalid audio format" | Use WAV, MP3, or OGG format |
| "Audio too short/long" | TTS samples must be 6-12 seconds |

---

## Examples and Use Cases

### Example 1: International Server

**Setup:**
```
/translate-admin setup
  source-channel: #korean
  target-channel: #english
  source-lang: Korean
  target-lang: English
  bidirectional: true

/translate-admin setup
  source-channel: #japanese
  target-channel: #english
  source-lang: Japanese
  target-lang: English
  bidirectional: true
```

**Result:** Korean, Japanese, and English speakers can all communicate in their native languages.

---

### Example 2: Voice Reading Room

**Setup:**
```
/tts-admin enable-channel channel: #reading-room auto-join: true
```

**Usage:**
1. Users register their voices with `/tts register`
2. Users join a voice channel
3. Users type messages in #reading-room
4. Bot reads messages aloud in users' voices

---

### Example 3: 24/7 Music Channel

**Setup:**
```
/music-admin enable-channel
  channel: #lofi-radio
  max-queue-size: 200
  max-duration: 7200
```

**Usage:**
```
/music play url: [long lofi playlist]
/music loop mode: Queue
/music volume level: 30
```

**Result:** Continuous background music in voice channel.

---

## Additional Resources

- [Setup Guide](./SETUP.md) - Installation and configuration
- [README](../README.md) - Project overview
- [GitHub Issues](https://github.com/yourusername/discord_bot/issues) - Bug reports and feature requests
