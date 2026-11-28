# Euphie Music website

Standalone website for the Euphie Music Discord bot crew, styled after jockiemusic.com. It has its own Node.js server and package file; running the bot with `npm start` in the project root is unaffected.

## Run locally

From this directory:

```sh
npm start
```

Then open `http://localhost:4173`. To use another port, set the `PORT` environment variable.

## The lineup

Six Euphie bots are listed, each with its own Discord OAuth2 invite link (client IDs derived from the bot tokens in the project's `.env`). Avatars live in `public/bots/`:

- `euphie.jpg` — Euphie (primary)
- `euphie-1.png` — Euphie (1)
- `euphie-2.png` — Euphie (2) and Euphie (3) *(placeholder — drop a unique pfp in and update `avatar` in `data/bots.json`)*
- `euphie-4.jpg` — Euphie (4)
- `euphie-1.png` — Euphie (5) *(placeholder)*

## Add or update bot invites

Edit `data/bots.json` (gitignored). Each entry:

```json
{
  "name": "Euphie (1)",
  "tagline": "Another room, same rhythm.",
  "description": "A music bot for your Discord server.",
  "inviteUrl": "https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID",
  "avatar": "/bots/euphie-1.png",
  "status": "Crew member",
  "commands": ["Music", "Queue", "Controls"]
}
```

Buttons stay disabled until `inviteUrl` is a valid Discord OAuth2 authorize URL. The public directory API is at `/api/bots`; `/api/health` reports whether the server is running.
