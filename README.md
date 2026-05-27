# GT Role Bot V5.5

Discord.js v14 bot for GT role utilities, earnings roles, signup checks and post-cup Twitch proof checks.

## Commands

- `/giverolefromchannel`
- `/takerolefromchannel`
- `/earningsroles`
- `/checksignup`
- `/checkstreamproof`

## Pre-cup signup check

Use `/checksignup` with:
- `signin_channel`: channel where sign-ins contain Discord mentions like `@Player`
- `twitch_channel`: channel where registrations contain `DiscordName twitch.tv/twitchname` or `@Player twitch.tv/twitchname`

The full report is posted in the command channel. Short notices are posted into the sign-in and Twitch channels.

## Post-cup stream proof check

Use `/checkstreamproof` with:
- `twitch_channel`: channel where Twitch registrations contain `DiscordName twitch.tv/twitchname` or `@Player twitch.tv/twitchname`
- `hours`: VOD lookback window, default 24 hours

The post-cup check does **not** compare sign-ins. It only checks the Twitch links in the selected Twitch channel and reports:
- live now
- recent Twitch VOD found
- no stream proof found
- Twitch user not found

## Required Render environment variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## Render

Use a Background Worker:

```bash
npm install
npm start
```

After deploy the logs should show:

```txt
GT ROLE BOT V5.5 LOADED
```
