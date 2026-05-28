# GT Role Bot V5.9

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
GT ROLE BOT V5.9 LOADED
```


## V5.9 Important

Use `/postcupcheck` for the post-cup Twitch proof check. It only asks for `twitch_channel`, `hours`, and `limit`. It does not use a sign-in channel.

`/checksignup` remains the pre-cup command and still needs both the sign-in channel and the Twitch channel.


## V5.9 Signup Matching
`/checksignup` now matches sign-ins by Discord mentions in the sign-in channel against the Twitch username after `twitch.tv/name` in the Twitch channel. Example: `@HoldOn` can match `twitch.tv/holdon52`. Only missing sign-ins are listed in the main report.


## V5.9 update

`/checksignup` now also counts Discord screenshare entries in the Twitch channel. Supported examples:

```txt
@Player DC ss
PlayerName DC ss
PlayerName discord screenshare
```

`/postcupcheck` also lists DC SS as manual proof and does not try to check those entries through the Twitch API.


## V5.9 Voice Channel Commands

### /voicechannelcreate
Creates a voice channel inside any selected category.

Options:
- `category` - category where the voice channel should be created
- `name` - name of the new voice channel
- `user_limit` - optional, 0 means no limit

### /voicechanneldelete
Deletes a selected voice channel.

Required Discord permission:
- Manage Channels

Important:
The bot role must also have Manage Channels permission and must be high enough in the role hierarchy.
