# Quiz background music

The host quiz session page (`/admin/quiz/session/[code]`) plays looping
background music that changes with the game state. The file paths are
referenced by `src/lib/quiz-audio.ts`.

Drop in three MP3 files with **exactly these names** and the music
layer will come to life. If any file is missing, the music layer
simply stays silent — sound effects (tap/correct/wrong/fanfare) still
work because they're synthesised in the browser.

| File | Used when | Suggested length |
|---|---|---|
| `lobby.mp3` | Session is `WAITING` or `SHOWING_RESULTS` (leaderboard) | 2–3 min (will loop) |
| `question.mp3` | Session is `ACTIVE` (question on screen) | 30–90 sec (will loop) |
| `victory.mp3` | Session is `COMPLETED` | Length doesn't matter; loops |

## Picking tracks

**Keep the total size under 5 MB.** 128 kbps MP3 is plenty for
background music.

### Royalty-free sources (in order of ease)

1. **Pixabay Music** — https://pixabay.com/music/
   - Search "quiz", "game show", "trivia", "bollywood instrumental"
   - No account needed, no attribution required, direct MP3 download
   - Recommended for the Bollywood quiz: search **"bollywood background"** or **"indian instrumental"**

2. **YouTube Audio Library** — https://studio.youtube.com/ → Audio Library
   - Free to download, most tracks are attribution-free
   - Search "quiz", "game show"

3. **Uppbeat.io** — https://uppbeat.io/
   - Free tier: a few tracks per month with a watermark-free credit link
   - Higher-quality curation than Pixabay

4. **Incompetech (Kevin MacLeod)** — https://incompetech.com/music/royalty-free/
   - Classic CC-BY tracks; attribution required. Rich "game" and
     "adventure" libraries.

### Suggested picks for the Bollywood quiz

- **Lobby:** something chilled and recognizably Indian. Search Pixabay
  for "bollywood chill" or "indian background".
- **Question:** pacey with clock-tick energy. Search Pixabay for
  "quiz tense" or "suspense game show".
- **Victory:** short celebratory fanfare. Search Pixabay for "fanfare"
  or "victory indian".

### After downloading

1. Rename each file to `lobby.mp3`, `question.mp3`, or `victory.mp3`
2. Drop them into this folder (`public/audio/quiz/`)
3. Commit and push — they're public static assets served directly by
   Next.js, no code changes needed
4. If any file came with an attribution requirement, add a line below

## Attribution

_(Add credits here when you drop in files that require attribution.)_

-
