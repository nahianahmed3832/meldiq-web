# Community identity system

The member list should help someone find community leaders, recognise other members and identify automated accounts quickly. The design uses the current appearance palette and explicit membership labels, with original vector emblems for community identity.

## Visual language

PLUS is a compact wordmark plaque with the selected theme's accent, readable on-accent ink, a fine edge and a restrained inset highlight. GO is its quieter outlined counterpart. Neither renders a check, rosette or verification symbol. The API's legacy `check` flag does not change the artwork or label.

Owner, role, artist and bug-hunter marks share a 24-unit shield silhouette, faceted surface, inset detail and consistent stroke weight. Owners use a crown; roles a diamond; artists a pen nib; bug hunters an insect. The bot emblem uses the same line treatment with an unmistakable machine face. Community tags use a geometric M crest. All inherit theme ink, including light themes. Existing community-issued pin images and earned entitlements remain authoritative.

BOT stays visible beside every known bot's name, including compact conversation rows and headers, messages, profiles, friends and member lists. It is independent of optional badge visibility. Names truncate before identity marks.

## Member hierarchy

Active includes online, idle and do-not-disturb presence. An active community owner appears first, under the highest assigned custom role marked “Show members separately”, or under Admin when no such role is assigned. The owner's group leads even if another role is positioned higher, and owners lead the members within that group. Other admins without a separately shown role share Admin. Other active human groups preserve role order, followed by Online.

Bots have one separate Bots group regardless of presence, role assignment or alphabetical position. Their presence mark reflects actual availability. Offline human owners join Offline rather than being presented as active. Empty groups are omitted and no member is duplicated. Existing role editing controls customise the owner's heading, and saving roles refreshes cached member directories immediately.

## Research and decisions

- [Discord roles and permissions](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions) documents ordered roles, inherited role colours and separately displayed role groups. Meldiq preserves those controls while adding the owner's explicitly requested priority.
- [Discord's guide to apps](https://discord.com/blog/how-to-use-discord-apps) identifies automated accounts by their Bot tag in the member list. Meldiq keeps the explicit BOT label in every name presentation.
- [Atlassian's compact label guidance](https://atlassian.design/components/lozenge/code) uses short labels to communicate meaningful attributes. PLUS and GO state membership directly rather than suggesting verification.

Recognisable identities and an easy-to-find community team are the intended engagement benefits. This release makes no measured retention or conversion claim; those require product analytics and an actual experiment.

## Verification

Grouping regressions cover default Admin, owners ahead of other admins, custom owner groups below other roles, owner priority within a shared group, offline owners and bots regardless of role/presence. Browser workflows cover role edits, palette changes, persistent bot labels, long names and a 390px phone layout. Production exports use Webpack to remain compatible with the existing Content Security Policy.
