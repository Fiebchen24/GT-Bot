# GT Role Bot V5.3

## Commands

### /giverolefromchannel
Gives a selected role to every Discord user mentioned in a selected channel.

### /takerolefromchannel
Removes a selected role from every Discord user mentioned in a selected channel.

### /earningsroles
Updates earnings roles based on `@User 12500` style entries.

### /checksignup
Before the cup. Compares a sign-in channel against a Twitch link channel.

Sign-in channel format:
```txt
@Player
@Player2
```

Twitch channel supported formats:
```txt
DiscordName twitch.tv/twitchname
@DiscordName twitch.tv/twitchname
```

The command response is public in the command channel and only lists missing/problem entries. It also posts a short summary in the sign-in channel and Twitch channel.

### /checkstreamproof
After the cup. Checks Twitch links for live status or recent VODs.

## Render Environment Variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```
