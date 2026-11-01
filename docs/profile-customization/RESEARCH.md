# Yapin public profile decoration research

Date: 1 November 2026. Source: https://www.yapin.gg/ (public community profiles viewed through the existing browser session). No messages, purchases, follows, profile edits or submissions were made. No proprietary assets were downloaded or reused.

## Fresh observations before implementation

Two public profiles were opened from the public general channel: Piku and Sweeter. The mobile viewport was approximately 412 px wide. Profile cards fill nearly the viewport width, use a rounded outer border and stack content vertically. Piku's visible banner measured about 402 × 134 CSS px, the avatar 96 × 96 and an image decoration 144 × 144. These are measurements of this viewport, not fixed source dimensions. The decoration overlaps the banner/avatar boundary; action buttons sit beside the avatar and identity text sits below. Presence remains legible above the artwork.

Piku's profile exposed an Artist badge, Bug Hunter badge, community tag, about text, links, roles, creation collection, Wearing section and interest widget. Creation tiles showed a thumbnail, name and either Free or a gem price (one visible item cost 300). Sweeter's profile showed a pink theme, photographic banner, layered illustrated avatar decoration, styled display name, Artist/Gifter/Plus badges and role chips. Publicly rendered image URLs included WebP, PNG and GIF extensions; extensions alone do not prove animation codecs. Visual layering is confirmed; exact easing, animation duration and desktop breakpoints were not measured in this fresh pass.

## Existing saved evidence, not re-tested transactions

The earlier same-date investigation in `Meldiq-Yapin-Research/CUSTOMIZATION-INVENTORY.md` and evidence 03, 122–129, 170 records:

- Included avatar pictures/effects, community catalog, All/Favorites/Owned/seasonal filters, Moving/Still filters, search by name/artist.
- Before/after try-on and profile/message/member previews, followed by explicit Apply.
- Custom two-color profile themes, name fonts/gradients/effects, banner uploads, shown badges and community tags.
- Creator submission with transparent center, PNG/WebP/GIF, recommended 512 square, originality attestation and moderation.
- Paid community items, purchase disabled when balance is insufficient, age/Plus selling eligibility and creator revenue share described by UI. No payment enforcement or payout was verified.

That evidence is historical observation, not a claim that today's account owns those items or that purchases work. Public widgets do not establish a general user-editable widget framework. We did not establish separate public catalogs for profile backgrounds, card corners, particles or seasonal badges, nor Android/desktop parity on Yapin. Those are Meldiq product requirements, not verified Yapin features.

## Meldiq implementation direction

Preserve Meldiq's existing profile editor, avatar/media pipeline, names, themes, badges and realtime profile events. Extend them with one collectible catalog and private inventory backed by the existing database abstraction. Keep preview local until explicit equip; ownership, availability and prices remain server decisions. Use original navy/cyan/violet recipes and generated artwork. Supply static fallback assets and avoid loading animations throughout catalog grids. No purchase endpoint may simulate payment success.
