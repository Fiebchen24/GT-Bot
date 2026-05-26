# GT Role Bot V3

Discord role utility bot for GT.

## Commands

### /giverolefromchannel
Gives a selected role to all users mentioned in a selected channel. Checks who already has the role.

### /takerolefromchannel
Removes a selected role from all users mentioned in a selected channel. Checks who does not have the role.

### /earningsroles
Reads messages like:

```txt
@Player 12500
@Player2 $20,000
@Player3 12.5k
```

It removes old configured earnings roles and applies the correct one.

### /checktwitchsignins
Compares Twitch links from one channel with Twitch links in a sign-ins channel.

It reports:

- Twitch links found
- Who is missing from sign-ins
- Who is live now
- Who has a recent Twitch archive/VOD in the selected hour window
- Who has no current live stream or recent VOD

Example supported Twitch link formats:

```txt
https://www.twitch.tv/fieb
www.twitch.tv/fieb
twitch.tv/fieb
```

## Render Environment Variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## Twitch API setup

1. Go to Twitch Developer Console.
2. Create an application.
3. Set OAuth Redirect URL to `http://localhost`.
4. Category: Application Integration.
5. Copy Client ID and create/copy Client Secret.
6. Add both to Render Environment Variables.

## Render

Use a Background Worker.

Build command:

```txt
npm install
```

Start command:

```txt
npm start
```

## Important

The Twitch check can verify current live status and recent VOD/archive status. Twitch does not always keep VODs if streamers disabled archives, so a player can have streamed but still appear as no recent VOD.
