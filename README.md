# GT Role Bot V5.1

Discord.js v14 bot for GT role and Twitch signup checks.

## Fixes in V5.1

- Fixes Discord `Unknown interaction` by deferring immediately at command start.
- Fixes `Cannot read properties of null (reading messages)` with text-channel validation.
- Keeps the V5 signup logic with up to 1000 messages scanned by default.
- Uses `@User twitch.tv/name` as the most reliable Twitch registration format.

## Render Environment Variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## Render

Use a Background Worker.

Build command:
```bash
npm install
```

Start command:
```bash
npm start
```
