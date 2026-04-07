# feedhub

Unified feed reader that aggregates Gmail, KakaoTalk, Telegram, RSS, and Slack into a single web UI.

<img src="web/public/favicon.svg" alt="feedhub" width="64">

## Features

- **Unified timeline** — all sources in one chronological feed
- **Source filtering** — filter by Gmail, KakaoTalk, Telegram, Slack, RSS
- **Search** — full-text search across all sources
- **Expand/collapse** — click Gmail or chat messages to read inline
- **Gmail integration** — read full email body, trash from feed
- **KakaoTalk** — chat messages with photos, link previews, sender names
- **Telegram** — channel/group messages with link previews, OG fallback, polls, video, reply threads
- **RSS** — subscribe to any RSS/Atom feed
- **Link previews** — OG meta cards for shared URLs (with shimmer loading)
- **Image lightbox** — click photos to view full size with arrow key navigation
- **Video playback** — inline video player for Telegram media
- **Polls** — Telegram poll results with voter counts and percentages
- **Reply threads** — expandable comment/reply threads for Telegram messages
- **Dismiss** — hide any item from feed (soft delete, survives re-sync)
- **Settings page** — manage RSS feeds, KakaoTalk chats, Telegram channels from the web UI
- **Auto-refresh** — frontend polls every 60s, backend syncs every 5min

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Fastify |
| Frontend | React, Vite |
| Database | MongoDB |
| Gmail | Google Gmail API (OAuth2) |
| KakaoTalk | [kakaocli](../kakaocli) (macOS) |
| Telegram | GramJS (MTProto user API) |
| RSS | rss-parser |
| Scheduling | node-cron |

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- macOS (for KakaoTalk via kakaocli)

### Install

```bash
git clone <repo-url>
cd feedhub
npm install
cd web && npm install && cd ..
```

### Configure

Create a `.env` file:

```env
MONGODB_URI=mongodb+srv://...

# Gmail (optional)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
GMAIL_REFRESH_TOKEN=

# KakaoTalk (optional, macOS only)
KAKAOCLI_PATH=/path/to/kakaocli
ENABLE_KAKAOTALK=true
KAKAO_CHATS=chatId1:name1,chatId2:name2

# Telegram (optional)
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_CHATS=

# Slack (optional)
SLACK_BOT_TOKEN=

# RSS (initial seed, managed via settings page after first run)
RSS_FEEDS=https://example.com/feed.xml,https://other.com/rss

PORT=3000
SYNC_INTERVAL=5
```

### Gmail Setup

1. Create a Google Cloud project and enable Gmail API
2. Create OAuth2 credentials (Web application)
3. Add `http://localhost:3000/api/auth/gmail/callback` as redirect URI
4. Run the auth script to get a refresh token:
   ```bash
   npx tsx scripts/gmail-auth.ts
   ```
5. Set the app to Production in Google Cloud Console → OAuth consent screen → Audience

### Telegram Setup

1. Get `api_id` and `api_hash` from https://my.telegram.org/apps
2. Run the auth script:
   ```bash
   npx tsx scripts/telegram-auth.ts
   ```
3. Add channels via the Settings page in the web UI

### KakaoTalk Setup

Requires [kakaocli](../kakaocli) installed on macOS. Set `KAKAOCLI_PATH` and `ENABLE_KAKAOTALK=true`. Add chats via the Settings page or `KAKAO_CHATS` env var.

## Run

### Development (two terminals)

```bash
# Terminal 1: backend
npm run dev

# Terminal 2: frontend
npm run dev:web
```

Open http://localhost:5173

### Production

```bash
npm run build
npm start
```

Open http://localhost:3000

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feed` | Unified feed (cursor pagination, source filter) |
| GET | `/api/feed/search?q=` | Full-text search |
| POST | `/api/sync` | Trigger sync for all sources |
| POST | `/api/sync/:source` | Trigger sync for one source |
| GET | `/api/sources` | List connected sources with sync status |
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings (RSS feeds, chats) |
| DELETE | `/api/feed/dismiss?source=&id=` | Dismiss a feed item |
| GET | `/api/gmail/:id/body` | Fetch full Gmail body |
| GET | `/api/kakao/chats` | List KakaoTalk chats |
| GET | `/api/telegram/chats` | List Telegram dialogs |
| GET | `/api/og?url=` | Fetch OG meta for a URL |
| GET | `/api/settings/rss-title?url=` | Fetch RSS feed title |
| GET | `/api/telegram/photo/:chatId/:msgId` | Fetch Telegram photo |
| GET | `/api/telegram/video/:chatId/:msgId` | Fetch Telegram video |
| GET | `/api/telegram/poll/:chatId/:msgId` | Fetch Telegram poll results |
| GET | `/api/telegram/replies/:chatId/:msgId` | Fetch Telegram reply thread |

## Project Structure

```
feedhub/
├── src/
│   ├── connectors/        # Source adapters (gmail, kakaotalk, telegram, rss, slack)
│   │   ├── types.ts       # FeedItem, Connector interface
│   │   └── registry.ts    # Builds connectors from settings
│   ├── db/                # MongoDB layer
│   │   ├── client.ts      # Connection singleton
│   │   ├── feed-repo.ts   # Feed CRUD with soft delete
│   │   ├── settings-repo.ts
│   │   └── indexes.ts     # MongoDB index definitions
│   ├── server/
│   │   ├── app.ts         # Fastify app factory
│   │   └── routes/        # API route handlers
│   ├── scheduler.ts       # node-cron periodic sync
│   ├── config.ts          # Environment config
│   └── main.ts            # Entry point
├── web/                   # React + Vite SPA
│   └── src/
│       ├── components/    # FeedCard, FeedList, SettingsPage, etc.
│       ├── hooks/         # useFeed
│       └── api.ts         # API client
└── tests/                 # Vitest unit tests
```

## Testing

```bash
npm test
```

## License

Private
