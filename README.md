# GT Role Bot V5

## Commands

- `/giverolefromchannel` - gives a role to all mentioned users in a channel
- `/takerolefromchannel` - removes a role from all mentioned users in a channel
- `/earningsroles` - updates earnings roles from `@User 12345`
- `/checksignup` - before cup: compares sign-ins with Twitch registrations
- `/checkstreamproof` - after cup: checks Twitch links for live status or recent VODs

## Important for `/checksignup`

Best format in Twitch channel:

```txt
@Player twitch.tv/twitchname
```

V5 compares by Discord User ID when an `@User` is included.
If the Twitch link has no `@User`, V5 tries a name fallback, e.g. `@HoldOn` can match `twitch.tv/holdon52`.

## Render Environment Variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## Render

Use a **Background Worker**.

Build Command:

```txt
npm install
```

Start Command:

```txt
npm start
```
