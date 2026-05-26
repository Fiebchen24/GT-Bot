# GT Role Bot V4.1

Commands:

- `/giverolefromchannel`
- `/takerolefromchannel`
- `/earningsroles`
- `/checksignup`
- `/checkstreamproof`

## V4.1 Fix

`/checksignup` now checks sign-ins per Discord mention/message and detects whether a Twitch link is included in the same sign-in message. It no longer expects Discord names and Twitch names to match.

The bot also splits long output into multiple Discord messages.


## V4.3
/checksignup now matches Twitch links by @User when available and also tries a safe name fallback, e.g. @HoldOn can match twitch.tv/holdon52.
