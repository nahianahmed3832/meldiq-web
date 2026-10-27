# Stage 3 setup: what to create, and what to send

Each item below needs an account or a decision that only the owner can make. None of the keys or secrets go into chat,
into this repository, or into anything Claude types. When the apps exist, Claude puts a small script on the server
(like `/root/set-discord.sh`) that asks for each value with hidden input and writes it to the API's `.env`; then the API
restarts and checks each one.

The return addresses below are the ones Meldiq Web will use. Register them exactly as written.

## 1. Linked accounts (Connections on My Profile)

### Steam (name, games and achievements)

1. Sign in at <https://steamcommunity.com/dev/apikey> with the Steam account that will own the key. Steam only issues
   keys to accounts that have spent at least US$5 in the Steam store.
2. **Domain name**: `web.meldiq.app`. Agree to the Steam Web API terms and register.
3. Keep the **Web API key** for the script (`STEAM_WEB_API_KEY`).

Steam sign-in itself uses OpenID, which needs no secret: Meldiq sends people to Steam's own page and gets back only their
Steam ID. Return address: `https://web.meldiq.app/connections/steam/callback`.

### AniList (favourite anime, what you're watching)

1. Sign in at <https://anilist.co/settings/developer> and choose **Create New Client**.
2. **Name**: `Meldiq`. **Redirect URL**: `https://web.meldiq.app/connections/anilist/callback`.
3. Keep the **Client ID** and **Client Secret** (`ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET`).

### Last.fm (top artists, tracks and what's playing)

1. Sign in at <https://www.last.fm/api/account/create>.
2. **Application name**: `Meldiq`. **Callback URL**: `https://web.meldiq.app/connections/lastfm/callback`.
   **Application homepage**: `https://web.meldiq.app`.
3. Keep the **API key** and **Shared secret** (`LASTFM_API_KEY`, `LASTFM_SHARED_SECRET`).

### Trakt (movies and shows you watch and rate)

1. Sign in at <https://trakt.tv/oauth/applications/new>.
2. **Name**: `Meldiq`. **Redirect URI**: `https://web.meldiq.app/connections/trakt/callback`. Leave the extra permissions
   (check-in, scrobble) off: Meldiq only reads.
3. Keep the **Client ID** and **Client Secret** (`TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`).

When all four are made (or any of them: each can go live on its own), send "the connection apps are ready".

## 2. Meldiq Pro (paid plan) and gifting

### Choose a payment provider

Stripe doesn't accept businesses in Bangladesh, so it's out. Options:

| Provider | What it handles | Check before choosing |
|---|---|---|
| **Paddle** | Merchant of record: it sells to the buyer and handles VAT/sales tax and refunds; you get payouts | Approval of your business and website, payout method to Bangladesh |
| **Lemon Squeezy** | Also merchant of record, simpler setup | That it can pay you out in Bangladesh |
| **Google Play Billing** | Subscriptions inside the Android app only (Google takes its fee) | Needs Android app changes, which are outside this round |

Merchant-of-record providers matter here: they take on the tax filing for sales in other countries.

### Decide the business details

- **Price and currency**: monthly and yearly price (for example US$4.99 a month), and whether there's a local price.
- **What Pro adds**: things that cost Meldiq money (bigger uploads, longer message length, higher screen-share quality,
  more storage), plus a badge. Everything that's free today stays free.
- **Gifting**: which lengths (1 month, 3 months, 1 year), and whether the person receiving it is told who it's from.
- **Refunds and cancelling**: when someone can get money back, and that cancelling stops the next charge while Pro lasts
  until the end of the period paid for.
- **Who sells it**: the legal name and address that appear on receipts and in the terms.

Send the provider you picked and these answers. After the provider approves the account, the same hidden-input script
takes its API key and webhook secret.

## 3. Still open from before

### Point `meldiq.app` at the server

Old invitation links (`https://meldiq.app/invite/…`) and the Android app's links use `meldiq.app`, which today points
at 2.57.91.91, where nothing answers. The server is ready (its nginx site already redirects to `web.meldiq.app` and
serves the Android app-links file). What's needed, in Hostinger DNS for `meldiq.app`:

- Change the **A** record for `@` from `2.57.91.91` to `72.60.107.88`. Leave the MX and TXT (email) records alone.

Reply "yes, change the meldiq.app DNS" and Claude makes that one change and then adds the HTTPS certificate. Or change it
yourself in Hostinger and say so.

### GIF search

Pick **Tenor** (Google Cloud console, enable the Tenor API, create an API key) or **GIPHY**
(<https://developers.giphy.com>, create an API app). Then the same hidden-input script sets `GIF_PROVIDER` and
`GIF_API_KEY`. Steps in meldiq `docs/GIFS.md`.
