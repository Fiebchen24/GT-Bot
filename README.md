# GT Role Bot V4.2

Discord.js v14 bot for GT role utilities, earnings roles, Twitch signup checks and stream proof checks.

## Commands

- `/giverolefromchannel` - gives a role to everyone mentioned in a channel and checks who already had it.
- `/takerolefromchannel` - removes a role from everyone mentioned in a channel and checks who did not have it.
- `/earningsroles` - updates earnings roles from mentions + numbers.
- `/checksignup` - before the cup: compares sign-ins with Twitch registrations.
- `/checkstreamproof` - after the cup: checks Twitch registrations for live status or recent VODs.

## Important Twitch signup format

For reliable matching, the Twitch link channel should use this format:

```txt
@Player https://twitch.tv/twitchname
```

The bot matches by Discord User ID, not by Twitch name or display name.

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

Build Command:
```txt
npm install
```

Start Command:
```txt
npm start
```
