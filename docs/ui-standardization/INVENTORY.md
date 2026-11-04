# UI standardization inventory

Recorded before refactoring on 2026-11-04. Existing uncommitted changes are retained. No backend, database, or billing contract changes are planned.

## Route coverage

The single Next.js client page mounts the History API router in `src/application/router.ts`; every existing URL remains supported.

| Surface                     | Routes / states                                                                                                                         | Authoritative implementation                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Main app                    | home, dms, friends, activity, later, discover, lobby                                                                                    | Shell, Sidebar, Rail, TabBar; existing view components          |
| Personal settings           | you, account, profile, security, devices, notifications, calls, appearance, storage, about, advanced, shortcuts                         | SettingsView and existing cards                                 |
| Commerce                    | mojo, spark, billing, checkout                                                                                                          | MojoPage, SparkPage, BillingPage, CheckoutPage; PayPal retained |
| Programs and administration | leaderboards, points, creators, developer, health, usage                                                                                | Existing feature / administrator gated pages                    |
| Community identity          | overview, theme, pins, lobby, guide, rules, onboarding                                                                                  | WorkspaceView and communityRail                                 |
| Community administration    | people, invitations, channels, roles, audit, usage, meetings, applications, reports, security, bans, expressions, bots, sparks, promote | WorkspaceView; server permission checks retained                |
| Conversations               | every section /c/:id; details, members, search, pinned, threads, thread/:root                                                           | ConversationView, SidePanel, DetailsTabs, ChannelDetails        |
| Channel configuration       | overview, permissions, webhooks, delete; create channel/category                                                                        | EditChannelDialog, PermissionsBody, WebhooksTab                 |
| Calls                       | incoming, ringing, connected, voice room, screen sharing, device selection                                                              | CallLayer and shared call components                            |
| Identity                    | sign in/up, recovery, reauthentication, device linking, saved accounts, OAuth consent                                                   | Existing auth screens and AccountActions                        |

## Findings and consolidation plan

- Language is edited in Account, Appearance, and a profile-menu dialog. Move personal editing to Language; signed-out authentication keeps its language picker.
- Theme choices are independently implemented in the profile menu and Appearance. Keep Appearance; the menu links there.
- Profile name and username have independent modal editors in AccountOverview and the full Profile editor. Account links to Profile.
- Account authentication, sessions, and provider connections crowd My Account. Put authentication under Privacy & Security; put sessions, device keys, provider connections, and authorized apps under Devices & Connections. Device revocation and session termination remain distinct operations with explanations.
- Storage and About routes silently render Profile despite existing implementations. Restore their real pages.
- Accessibility and language are buried in Appearance. Give them visible categories and keep one editor per preference.
- Workspace settings have separate mobile, legacy, and community navigation definitions. Reuse a filtered catalog and shared navigation component; apply the same availability rules to direct routes.
- Community Overview mixes identity, discovery, access, safety, and ticket configuration. Move discovery/access and moderation/integrations to their own categories while preserving existing forms.
- Notification level choices differ in names and inheritance behavior between menu and details. Share labels, inheritance/reset behavior, and contextual navigation.
- Profile menu, top bar, rail, and account panel repeat navigation actions. Keep daily destinations in primary navigation and personal configuration in Settings.
- Existing design tokens, Dialog, Menu, Toggle, Card, ErrorLine, and status banners already cover most screens. Standardize their shared foundation and responsive sizing rather than replacing working feature screens.

## Component and overlay inventory

Every TSX surface is listed below. Dialog/menu counts include the shared wrappers; controls and feature gates inside each file were inspected by source search before refactoring.

| File                                                      | Exported components                                                                                                    | Dialogs | Menus |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------: | ----: |
| `src/ui/App.tsx`                                          | App                                                                                                                    |       0 |     0 |
| `src/ui/LinkScreen.tsx`                                   | LinkScreen                                                                                                             |       0 |     0 |
| `src/ui/StatusScreens.tsx`                                | LoadingScreen, UnsupportedScreen, ConfigError, ElsewhereScreen, RevokedScreen                                          |       0 |     0 |
| `src/ui/UpdateNotice.tsx`                                 | UpdateNotice                                                                                                           |       0 |     0 |
| `src/ui/auth/AccountForms.tsx`                            | Field, Back, SignInForm, ChoiceButton, SignUpForm, VerifyEmailForm, ForgotPasswordForm, ResetPasswordForm              |       0 |     0 |
| `src/ui/auth/AuthFrame.tsx`                               | AuthFrame, AuthHeading, FormError, FormNotice, LinkButton                                                              |       0 |     0 |
| `src/ui/auth/AuthScreen.tsx`                              | AuthScreen                                                                                                             |       0 |     0 |
| `src/ui/auth/DeviceSetupViews.tsx`                        | CreateIdentityView, RecoveryKeyReveal, AddDeviceView                                                                   |       0 |     0 |
| `src/ui/auth/ReauthScreen.tsx`                            | ReauthScreen                                                                                                           |       0 |     0 |
| `src/ui/auth/RecoverForms.tsx`                            | RecoverStartForm, RecoverCompleteForm                                                                                  |       0 |     0 |
| `src/ui/auth/SocialSignIn.tsx`                            | SocialSignIn                                                                                                           |       0 |     0 |
| `src/ui/billing/AddonCheckoutPage.tsx`                    | AddonCheckoutPage                                                                                                      |       0 |     0 |
| `src/ui/billing/BillingPage.tsx`                          | BillingPage                                                                                                            |       1 |     0 |
| `src/ui/billing/CheckoutPage.tsx`                         | CheckoutPage                                                                                                           |       0 |     0 |
| `src/ui/billing/PayPalButton.tsx`                         | PayPalButton                                                                                                           |       0 |     0 |
| `src/ui/call/CallAvatar.tsx`                              | CallAvatar, CallTargetAvatar                                                                                           |       0 |     0 |
| `src/ui/call/CallConnection.tsx`                          | CallConnection                                                                                                         |       0 |     0 |
| `src/ui/call/CallLayer.tsx`                               | CallLayer                                                                                                              |       0 |     0 |
| `src/ui/call/CallStage.tsx`                               | CallStage                                                                                                              |       0 |     1 |
| `src/ui/call/ConnectedCallPanel.tsx`                      | ConnectedCallPanel                                                                                                     |       0 |     0 |
| `src/ui/call/RoomControls.tsx`                            | HandButton, PeopleButton, roomRows, RoomPeople                                                                         |       0 |     1 |
| `src/ui/call/ShareViews.tsx`                              | ScreenView, StreamTray, SharePill, ShareDialog                                                                         |       2 |     1 |
| `src/ui/call/voiceModeration.tsx`                         | useVoiceModeration                                                                                                     |       0 |     0 |
| `src/ui/chat/AnimojiView.tsx`                             | AnimojiView                                                                                                            |       0 |     0 |
| `src/ui/chat/AttachmentDrafts.tsx`                        | AttachmentDrafts                                                                                                       |       0 |     0 |
| `src/ui/chat/Attachments.tsx`                             | Attachments, MediaAttachment, ImageAttachment, FileAttachment                                                          |       0 |     0 |
| `src/ui/chat/BulkSaveBar.tsx`                             | useBulkSave, BulkSaveBar                                                                                               |       0 |     0 |
| `src/ui/chat/ChannelBell.tsx`                             | ChannelBell                                                                                                            |       0 |     1 |
| `src/ui/chat/ChannelDetails.tsx`                          | ChannelDetails                                                                                                         |       0 |     0 |
| `src/ui/chat/Composer.tsx`                                | Composer, useFileDrop                                                                                                  |       0 |     1 |
| `src/ui/chat/ComposerGates.tsx`                           | useComposerGates, ComposerHoldBar, ComposerNoteLine                                                                    |       0 |     0 |
| `src/ui/chat/ConversationDetails.tsx`                     | useMembers, useShared, useSenderName, DetailsPanel, AboutCards, MembersList                                            |       0 |     0 |
| `src/ui/chat/ConversationManage.tsx`                      | EditConversationButton, AddMembersButton, AddMembersDialog, BlockToggle                                                |       2 |     0 |
| `src/ui/chat/ConversationMenu.tsx`                        | ConversationMenu                                                                                                       |       0 |     1 |
| `src/ui/chat/ConversationSettings.tsx`                    | ConversationSettings                                                                                                   |       0 |     0 |
| `src/ui/chat/ConversationView.tsx`                        | ConversationView, MessagesSkeleton                                                                                     |       0 |     0 |
| `src/ui/chat/DetailsTabs.tsx`                             | DetailsTabBar, MediaTab, FilesTab, PinsTab, LinksTab, DetailsHero, DetailsActions                                      |       0 |     0 |
| `src/ui/chat/EmojiPicker.tsx`                             | EmojiPicker                                                                                                            |       0 |     0 |
| `src/ui/chat/ExpressionLibrary.tsx`                       | ExpressionLibrary                                                                                                      |       0 |     0 |
| `src/ui/chat/ExpressionPicker.tsx`                        | ExpressionPicker                                                                                                       |       0 |     0 |
| `src/ui/chat/ForumView.tsx`                               | ForumView                                                                                                              |       1 |     0 |
| `src/ui/chat/GalleryMediaViewer.tsx`                      | GalleryMediaViewer                                                                                                     |       0 |     0 |
| `src/ui/chat/GifView.tsx`                                 | GifView                                                                                                                |       0 |     0 |
| `src/ui/chat/GiveawayStatus.tsx`                          | GiveawayStatus                                                                                                         |       0 |     0 |
| `src/ui/chat/Markdown.tsx`                                | Markdown, MarkdownLine                                                                                                 |       0 |     0 |
| `src/ui/chat/MediaGalleryDialog.tsx`                      | MediaGalleryDialog                                                                                                     |       1 |     0 |
| `src/ui/chat/MediaLinkCard.tsx`                           | MediaLinkCard                                                                                                          |       0 |     0 |
| `src/ui/chat/MediaViewer.tsx`                             | MediaViewer, VideoPlayer                                                                                               |       0 |     1 |
| `src/ui/chat/MessageInfo.tsx`                             | MessageInfoDialog                                                                                                      |       1 |     0 |
| `src/ui/chat/MessageItem.tsx`                             | internal                                                                                                               |       1 |     2 |
| `src/ui/chat/MessageList.tsx`                             | MessageList, ConversationStart                                                                                         |       0 |     0 |
| `src/ui/chat/PanelHead.tsx`                               | PanelHead                                                                                                              |       0 |     0 |
| `src/ui/chat/PeoplePanels.tsx`                            | useWideLayout, usePeopleShown, MemberListPanel, ProfilePanel, PeoplePanel, DockedPeoplePanel, PeopleToggle             |       0 |     1 |
| `src/ui/chat/PinnedPanel.tsx`                             | usePinned, PinnedPanel                                                                                                 |       0 |     0 |
| `src/ui/chat/PollDialog.tsx`                              | PollDialog                                                                                                             |       1 |     0 |
| `src/ui/chat/PollResultsDialog.tsx`                       | PollResultsDialog                                                                                                      |       1 |     0 |
| `src/ui/chat/PollView.tsx`                                | PollView                                                                                                               |       1 |     0 |
| `src/ui/chat/PostedContent.tsx`                           | PostedContent, EmbedBox                                                                                                |       0 |     0 |
| `src/ui/chat/ProfileCards.tsx`                            | ProfileShareDialog, ProfileCardView                                                                                    |       1 |     0 |
| `src/ui/chat/Reactions.tsx`                               | ReactionList, ReactionsDialog                                                                                          |       1 |     0 |
| `src/ui/chat/ReportDialog.tsx`                            | ReportDialog                                                                                                           |       2 |     0 |
| `src/ui/chat/RichDialogs.tsx`                             | LocationDialog                                                                                                         |       1 |     0 |
| `src/ui/chat/RichText.tsx`                                | RichText, isEmojiOnly                                                                                                  |       0 |     0 |
| `src/ui/chat/SafeLink.tsx`                                | SafeLink                                                                                                               |       1 |     0 |
| `src/ui/chat/SearchPanel.tsx`                             | SearchPanel                                                                                                            |       0 |     0 |
| `src/ui/chat/SecuritySheet.tsx`                           | SecuritySheet                                                                                                          |       1 |     0 |
| `src/ui/chat/SidePanel.tsx`                               | SidePanel                                                                                                              |       0 |     0 |
| `src/ui/chat/SlashCommands.tsx`                           | useSlashCommands, SlashCommandList, BotReplies                                                                         |       0 |     0 |
| `src/ui/chat/StickerView.tsx`                             | StickerView, StickerArt                                                                                                |       0 |     0 |
| `src/ui/chat/ThreadsPanel.tsx`                            | ThreadsPanel, ThreadList                                                                                               |       0 |     0 |
| `src/ui/chat/TransferList.tsx`                            | TransferList                                                                                                           |       0 |     0 |
| `src/ui/chat/Translate.tsx`                               | TranslateDialog, TranslationView                                                                                       |       2 |     0 |
| `src/ui/chat/TypingIndicator.tsx`                         | TypingIndicator, typingNames                                                                                           |       0 |     0 |
| `src/ui/chat/VoiceBar.tsx`                                | VoiceBar                                                                                                               |       0 |     0 |
| `src/ui/chat/VoiceRoomView.tsx`                           | VoiceRoomView                                                                                                          |       0 |     0 |
| `src/ui/chat/WebhookSender.tsx`                           | WebhookAvatar, WebhookName                                                                                             |       0 |     0 |
| `src/ui/chat/WordyGameDialog.tsx`                         | WordyGameDialog                                                                                                        |       1 |     0 |
| `src/ui/chat/WordyHeaderAction.tsx`                       | WordyHeaderAction                                                                                                      |       0 |     0 |
| `src/ui/chat/ZoomableImage.tsx`                           | ZoomableImage                                                                                                          |       0 |     0 |
| `src/ui/chat/contextTarget.tsx`                           | contextTarget, downloadUrl, contextEntries                                                                             |       0 |     0 |
| `src/ui/chat/useMessageCollection.tsx`                    | useMessageCollection, CollectionControls                                                                               |       0 |     0 |
| `src/ui/community/CategoryDialogs.tsx`                    | CategoryNameDialog, DeleteCategoryDialog, MuteForDialog                                                                |       3 |     0 |
| `src/ui/community/ChannelDialogs.tsx`                     | ChannelGlyph, EditChannelDialog, DeleteChannelDialog, MoveChannelDialog                                                |       3 |     0 |
| `src/ui/community/ChannelOptionsFields.tsx`               | useRoleChoices, RoleChips, ChannelOptionsFields                                                                        |       0 |     0 |
| `src/ui/community/CommunityHeader.tsx`                    | CommunityHeader                                                                                                        |       0 |     1 |
| `src/ui/community/CommunityPanel.tsx`                     | CommunityPanel                                                                                                         |       0 |     2 |
| `src/ui/community/CommunityPreviewDialog.tsx`             | CommunityPreviewDialog                                                                                                 |       1 |     0 |
| `src/ui/community/CreateChannelDialog.tsx`                | CreateChannelDialog                                                                                                    |       1 |     0 |
| `src/ui/community/CreateCommunityDialog.tsx`              | CreateCommunityDialog                                                                                                  |       2 |     0 |
| `src/ui/community/CustomEmoji.tsx`                        | useExpressions, CustomEmojiImage, ReactionEmoji                                                                        |       0 |     0 |
| `src/ui/community/DeleteCommunityDialog.tsx`              | DeleteCommunityDialog                                                                                                  |       1 |     0 |
| `src/ui/community/DiscordImport.tsx`                      | DiscordImport                                                                                                          |       0 |     0 |
| `src/ui/community/GuideOnboarding.tsx`                    | GuideCard, OnboardingBanner, OnboardingDialog                                                                          |       1 |     0 |
| `src/ui/community/LeaveDialog.tsx`                        | LeaveDialog                                                                                                            |       1 |     0 |
| `src/ui/community/LockedBanner.tsx`                       | LockedBanner                                                                                                           |       0 |     0 |
| `src/ui/community/NicknameDialog.tsx`                     | NicknameDialog                                                                                                         |       1 |     0 |
| `src/ui/community/NotifyDialogs.tsx`                      | CommunityNotificationsDialog, CategoryLevelDialog, HiddenChannelsDialog, ArrangeRailDialog                             |       4 |     0 |
| `src/ui/community/OnboardingFinish.tsx`                   | OnboardingFlow                                                                                                         |       0 |     0 |
| `src/ui/community/PermissionPreview.tsx`                  | PermissionPreview                                                                                                      |       0 |     0 |
| `src/ui/community/PermissionsDialog.tsx`                  | PermissionsDialog, PermissionsBody                                                                                     |       1 |     0 |
| `src/ui/community/RulesViews.tsx`                         | useRulesSummary, RulesList, RulesDialog, RulesAgreeBar, RulesChannelStart                                              |       1 |     0 |
| `src/ui/community/TemplatePreviewDialog.tsx`              | TemplatePreviewDialog                                                                                                  |       1 |     0 |
| `src/ui/community/communityMenu.tsx`                      | useCommunityMenu                                                                                                       |       0 |     0 |
| `src/ui/community/lockMenu.tsx`                           | lockEntry                                                                                                              |       0 |     0 |
| `src/ui/community/menuLabels.tsx`                         | internal                                                                                                               |       0 |     0 |
| `src/ui/community/reactionRoles/ReactionRolesDialog.tsx`  | ReactionRolesDialog                                                                                                    |       1 |     1 |
| `src/ui/community/reactionRoles/useReactionRolesItem.tsx` | useReactionRolesItem                                                                                                   |       0 |     0 |
| `src/ui/community/tickets/OpenTicketsList.tsx`            | OpenTicketsList                                                                                                        |       0 |     0 |
| `src/ui/community/tickets/PanelEditor.tsx`                | PanelEditor                                                                                                            |       0 |     0 |
| `src/ui/community/tickets/TicketDialogs.tsx`              | OpenTicketDialog, CloseTicketDialog                                                                                    |       2 |     0 |
| `src/ui/community/tickets/TicketHeaderActions.tsx`        | TicketHeaderActions                                                                                                    |       0 |     0 |
| `src/ui/community/tickets/TicketsCard.tsx`                | TicketsSection, TicketsCard                                                                                            |       0 |     0 |
| `src/ui/community/webhooks/BoxEditor.tsx`                 | BoxEditor                                                                                                              |       0 |     0 |
| `src/ui/community/webhooks/ButtonsEditor.tsx`             | ButtonsEditor                                                                                                          |       0 |     0 |
| `src/ui/community/webhooks/ChannelDialogTabs.tsx`         | ChannelDialogTabs                                                                                                      |       0 |     0 |
| `src/ui/community/webhooks/ImportJsonDialog.tsx`          | ImportJsonDialog                                                                                                       |       1 |     0 |
| `src/ui/community/webhooks/PostBuilder.tsx`               | PostBuilder                                                                                                            |       1 |     1 |
| `src/ui/community/webhooks/PostPreview.tsx`               | PostPreview                                                                                                            |       0 |     0 |
| `src/ui/community/webhooks/WebhookRow.tsx`                | WebhookRow                                                                                                             |       1 |     0 |
| `src/ui/community/webhooks/WebhooksTab.tsx`               | WebhooksTab                                                                                                            |       0 |     0 |
| `src/ui/components/Avatar.tsx`                            | toneOf, nameTone, initialsOf, colorIndexOf, PresenceMark, Avatar                                                       |       0 |     0 |
| `src/ui/components/BadgeMark.tsx`                         | BadgeMark                                                                                                              |       0 |     0 |
| `src/ui/components/BotTag.tsx`                            | BotTag                                                                                                                 |       0 |     0 |
| `src/ui/components/BrandMark.tsx`                         | BrandMark                                                                                                              |       0 |     0 |
| `src/ui/components/CommunityOwnerBadge.tsx`               | CommunityOwnerBadge                                                                                                    |       0 |     0 |
| `src/ui/components/CopyButton.tsx`                        | CopyButton, SecretBox                                                                                                  |       0 |     0 |
| `src/ui/components/EmberIcon.tsx`                         | EmberIcon                                                                                                              |       0 |     0 |
| `src/ui/components/IdentityGlyph.tsx`                     | IdentityGlyph                                                                                                          |       0 |     0 |
| `src/ui/components/LanguagePicker.tsx`                    | matchingLanguages, LanguagePicker, LanguageDialog, LanguagePreferenceCard                                              |       1 |     0 |
| `src/ui/components/LiveCallBadge.tsx`                     | LiveCallBadge                                                                                                          |       0 |     0 |
| `src/ui/components/MeldlingArt.tsx`                       | MeldlingArt                                                                                                            |       0 |     0 |
| `src/ui/components/MotionImage.tsx`                       | MotionImage                                                                                                            |       0 |     0 |
| `src/ui/components/OrgAvatar.tsx`                         | OrgAvatar, UserAvatar, GroupAvatar                                                                                     |       0 |     0 |
| `src/ui/components/Overlay.tsx`                           | useFocusTrap, Dialog, Menu, useMenu, keepsNativeMenu, quietContextMenu, contextMenuProps                               |       0 |     0 |
| `src/ui/components/QrCode.tsx`                            | QrCode                                                                                                                 |       0 |     0 |
| `src/ui/components/SettingsIcon.tsx`                      | SettingsIcon, RankMedal                                                                                                |       0 |     0 |
| `src/ui/components/Toggle.tsx`                            | Toggle                                                                                                                 |       0 |     0 |
| `src/ui/components/UnreadBadge.tsx`                       | UnreadBadge                                                                                                            |       0 |     0 |
| `src/ui/creators/CreatorsPage.tsx`                        | CreatorsPage                                                                                                           |       0 |     0 |
| `src/ui/developer/AppsSection.tsx`                        | AppsSection                                                                                                            |       0 |     0 |
| `src/ui/developer/BotListingCard.tsx`                     | BotListingCard                                                                                                         |       0 |     0 |
| `src/ui/developer/BotsSection.tsx`                        | botLimitText, BotsSection                                                                                              |       0 |     0 |
| `src/ui/developer/DeveloperPage.tsx`                      | DeveloperPage                                                                                                          |       0 |     0 |
| `src/ui/dialogs/ChannelBrowser.tsx`                       | ChannelBrowser                                                                                                         |       1 |     0 |
| `src/ui/dialogs/ForwardDialog.tsx`                        | ForwardDialog                                                                                                          |       1 |     0 |
| `src/ui/dialogs/IdentityReview.tsx`                       | IdentityReview                                                                                                         |       1 |     0 |
| `src/ui/dialogs/NewGroupDialog.tsx`                       | NewGroupDialog                                                                                                         |       1 |     0 |
| `src/ui/dialogs/NewMessageDialog.tsx`                     | NewMessageDialog                                                                                                       |       1 |     0 |
| `src/ui/dialogs/SearchDialog.tsx`                         | forgetRecentSearches, SearchDialog                                                                                     |       0 |     0 |
| `src/ui/dialogs/ShortcutsDialog.tsx`                      | ShortcutsDialog                                                                                                        |       1 |     0 |
| `src/ui/dialogs/StatusDialogs.tsx`                        | StatusDialog, PauseDialog, PresenceDialog                                                                              |       3 |     0 |
| `src/ui/dialogs/WorkspaceDialogs.tsx`                     | CreateWorkspaceDialog, JoinWorkspaceDialog                                                                             |       2 |     0 |
| `src/ui/later/LaterView.tsx`                              | LaterView                                                                                                              |       0 |     0 |
| `src/ui/later/RemindMeDialog.tsx`                         | RemindMeDialog                                                                                                         |       1 |     0 |
| `src/ui/later/ReminderEditor.tsx`                         | ReminderEditor                                                                                                         |       1 |     0 |
| `src/ui/later/RemindersList.tsx`                          | RemindersList                                                                                                          |       0 |     2 |
| `src/ui/later/SavedList.tsx`                              | SavedList                                                                                                              |       0 |     0 |
| `src/ui/leaderboards/LeaderboardsPage.tsx`                | LeaderboardsPage                                                                                                       |       0 |     0 |
| `src/ui/lobby/CardEditor.tsx`                             | CardEditor                                                                                                             |       0 |     0 |
| `src/ui/lobby/EditorLook.tsx`                             | EditorLook                                                                                                             |       0 |     0 |
| `src/ui/lobby/EditorSections.tsx`                         | EditorSections                                                                                                         |       0 |     0 |
| `src/ui/lobby/EditorTemplates.tsx`                        | EditorTemplates                                                                                                        |       0 |     0 |
| `src/ui/lobby/FeedUrl.tsx`                                | FeedUrl                                                                                                                |       0 |     0 |
| `src/ui/lobby/LobbyCard.tsx`                              | LobbyCard, EditableCard                                                                                                |       0 |     0 |
| `src/ui/lobby/LobbyEditorPanel.tsx`                       | LobbyEditorPanel                                                                                                       |       0 |     0 |
| `src/ui/lobby/LobbyHeader.tsx`                            | LobbyHeader                                                                                                            |       0 |     0 |
| `src/ui/lobby/LobbyPage.tsx`                              | LobbyPage                                                                                                              |       0 |     0 |
| `src/ui/lobby/LobbyRow.tsx`                               | LobbyRow                                                                                                               |       0 |     0 |
| `src/ui/lobby/LobbySurface.tsx`                           | LobbySurface                                                                                                           |       0 |     0 |
| `src/ui/lobby/Markdown.tsx`                               | Markdown                                                                                                               |       0 |     0 |
| `src/ui/lobby/PickRolesCard.tsx`                          | PickRolesCard                                                                                                          |       0 |     0 |
| `src/ui/lobby/cardsChannels.tsx`                          | TopCard, MainChannelsCard, LiveNowCard, RulesCard                                                                      |       0 |     0 |
| `src/ui/lobby/cardsInfo.tsx`                              | AboutCard, FaqCard, LinksCard, FeedCard, GiveawaysCard                                                                 |       0 |     0 |
| `src/ui/lobby/cardsPeople.tsx`                            | WhoRunsItCard, LeaderboardCard                                                                                         |       0 |     0 |
| `src/ui/lobby/fieldEditors.tsx`                           | ChannelPicker, FaqEditor, ButtonsEditor                                                                                |       0 |     0 |
| `src/ui/mojo/CharLimit.tsx`                               | overCharLimit, CharLimitNote                                                                                           |       0 |     0 |
| `src/ui/mojo/MojoBadge.tsx`                               | MojoBadgeMark                                                                                                          |       0 |     0 |
| `src/ui/mojo/MojoBanner.tsx`                              | MojoBanner                                                                                                             |       0 |     0 |
| `src/ui/mojo/MojoGifts.tsx`                               | GiftDialog, GiftsReceived                                                                                              |       1 |     0 |
| `src/ui/mojo/MojoPage.tsx`                                | MojoPage                                                                                                               |       0 |     0 |
| `src/ui/mojo/MojoPlans.tsx`                               | PlanCards, PlusPerks, CompareTable                                                                                     |       0 |     0 |
| `src/ui/mojo/PlusPromotion.tsx`                           | PlusPromotion                                                                                                          |       1 |     0 |
| `src/ui/mojo/PlusRenewalNotice.tsx`                       | PlusRenewalNotice                                                                                                      |       0 |     0 |
| `src/ui/mojo/PlusSupportNotice.tsx`                       | PlusSupportNotice                                                                                                      |       0 |     0 |
| `src/ui/mojo/SparkDialog.tsx`                             | SparkDialog                                                                                                            |       1 |     0 |
| `src/ui/mojo/SparkGoal.tsx`                               | SparkGoal                                                                                                              |       0 |     0 |
| `src/ui/mojo/SparkPage.tsx`                               | SparkPage                                                                                                              |       0 |     0 |
| `src/ui/mojo/SparkSection.tsx`                            | SparkSection                                                                                                           |       0 |     0 |
| `src/ui/mojo/SparkTrack.tsx`                              | SparkTrack, SparkLevelCards                                                                                            |       0 |     0 |
| `src/ui/oauth/ConsentPage.tsx`                            | redirectHost, ConsentPage                                                                                              |       0 |     0 |
| `src/ui/people/ArtistDecorations.tsx`                     | ArtistDecorations                                                                                                      |       0 |     0 |
| `src/ui/people/AvatarFrame.tsx`                           | AvatarFrame                                                                                                            |       0 |     0 |
| `src/ui/people/BotProfileDialog.tsx`                      | BotProfileDialog                                                                                                       |       1 |     0 |
| `src/ui/people/CollectibleLayers.tsx`                     | recipeBackground, collectibleCardVars, CollectibleBanner, CollectibleBadge                                             |       0 |     0 |
| `src/ui/people/ConnectionRequestViews.tsx`                | ConnectionRequestWatcher, ConnectionRequestBanner                                                                      |       0 |     0 |
| `src/ui/people/ConnectionsDialog.tsx`                     | ConnectionsDialog, MessageRequestsDialog                                                                               |       2 |     0 |
| `src/ui/people/GroupPhotoCard.tsx`                        | GroupPhotoCard                                                                                                         |       0 |     0 |
| `src/ui/people/LevelRing.tsx`                             | levelColor, LevelRing                                                                                                  |       0 |     0 |
| `src/ui/people/NameBadge.tsx`                             | nameBadge, NameBadgeMark                                                                                               |       0 |     0 |
| `src/ui/people/NameStyle.tsx`                             | namePaint, StyledName, WornTagChip, useUserLook, LookName, LookAvatar                                                  |       0 |     0 |
| `src/ui/people/ProfileConnections.tsx`                    | ProfileConnections                                                                                                     |       0 |     0 |
| `src/ui/people/ProfileDialog.tsx`                         | ProfileDialog                                                                                                          |       2 |     1 |
| `src/ui/people/ProfilePins.tsx`                           | ProfilePins                                                                                                            |       0 |     0 |
| `src/ui/people/ProfileStyle.tsx`                          | useReducedMotion, decorationWidth, StyledAvatar, DecorationImage, ProfileEffect                                        |       0 |     0 |
| `src/ui/people/RequestBar.tsx`                            | RequestBar, RequestSentBanner                                                                                          |       0 |     0 |
| `src/ui/points/AchievementGallery.tsx`                    | AchievementGallery                                                                                                     |       0 |     0 |
| `src/ui/points/PointsEarn.tsx`                            | PointsEarn                                                                                                             |       0 |     0 |
| `src/ui/points/PointsPage.tsx`                            | levelUpProblem, PointsPage                                                                                             |       0 |     0 |
| `src/ui/points/PointsQuests.tsx`                          | PointsQuests                                                                                                           |       0 |     0 |
| `src/ui/settings/AccountExtrasCards.tsx`                  | BugReportsCard, DataExportCard, LogOutEverywhereCard                                                                   |       2 |     0 |
| `src/ui/settings/AccountOverview.tsx`                     | AccountOverview                                                                                                        |       2 |     0 |
| `src/ui/settings/AccountPages.tsx`                        | DevicesPage, SecurityPage                                                                                              |       3 |     0 |
| `src/ui/settings/AccountSafetyCards.tsx`                  | TwoStepCard, StandingCard                                                                                              |       0 |     0 |
| `src/ui/settings/AccountSettingsPage.tsx`                 | AccountSettingsPage                                                                                                    |       0 |     0 |
| `src/ui/settings/AdminUsagePage.tsx`                      | AdminUsagePage                                                                                                         |       1 |     0 |
| `src/ui/settings/AdvancedPage.tsx`                        | AdvancedPage                                                                                                           |       0 |     0 |
| `src/ui/settings/AppearanceExtras.tsx`                    | VibesCard, AccessibilityCard                                                                                           |       0 |     0 |
| `src/ui/settings/AuthorizedAppsCard.tsx`                  | AuthorizedAppsCard                                                                                                     |       0 |     0 |
| `src/ui/settings/BackgroundNotifications.tsx`             | BackgroundNotifications                                                                                                |       0 |     0 |
| `src/ui/settings/CallsPage.tsx`                           | CallsPage, keyName                                                                                                     |       0 |     0 |
| `src/ui/settings/CollectionStudio.tsx`                    | CollectionStudio                                                                                                       |       1 |     0 |
| `src/ui/settings/CommunityProfileCard.tsx`                | CommunityProfileCard                                                                                                   |       0 |     0 |
| `src/ui/settings/ConnectedAccountsCard.tsx`               | ConnectedAccountsCard                                                                                                  |       1 |     0 |
| `src/ui/settings/ConnectionsCard.tsx`                     | ConnectionsCard                                                                                                        |       0 |     0 |
| `src/ui/settings/CreatorVerificationCard.tsx`             | CreatorVerificationCard                                                                                                |       0 |     0 |
| `src/ui/settings/DecorationPicker.tsx`                    | DecorationPicker                                                                                                       |       0 |     0 |
| `src/ui/settings/DecorationWindow.tsx`                    | useDecorationName, DecorationWindow                                                                                    |       1 |     0 |
| `src/ui/settings/InstallButton.tsx`                       | InstallButton, InstallSetting                                                                                          |       0 |     0 |
| `src/ui/settings/KeyBackupCard.tsx`                       | KeyBackupCard                                                                                                          |       0 |     0 |
| `src/ui/settings/LeaveManyDialog.tsx`                     | leaveSummary, LeaveManyDialog                                                                                          |       1 |     0 |
| `src/ui/settings/NameStyleWindow.tsx`                     | describeNameLook, NameStyleWindow                                                                                      |       1 |     0 |
| `src/ui/settings/NotificationOverview.tsx`                | NotificationOverview                                                                                                   |       0 |     0 |
| `src/ui/settings/PasskeysCard.tsx`                        | passkeyDetails, PasskeysCard                                                                                           |       0 |     0 |
| `src/ui/settings/PreferencePages.tsx`                     | NotificationsPage, AppearancePage, AboutPage                                                                           |       0 |     0 |
| `src/ui/settings/PrivacyExtras.tsx`                       | GroupAndSuggestRows, LeaveManyCard                                                                                     |       0 |     0 |
| `src/ui/settings/PrivacyPage.tsx`                         | PrivacySettings, BlockedPeople, MessagingSettings                                                                      |       0 |     0 |
| `src/ui/settings/ProfilePage.tsx`                         | ProfilePage                                                                                                            |       0 |     0 |
| `src/ui/settings/ProfilePreviewCard.tsx`                  | ProfilePreviewCard                                                                                                     |       0 |     0 |
| `src/ui/settings/ProfileStyleCard.tsx`                    | ProfileStyleCard                                                                                                       |       0 |     0 |
| `src/ui/settings/ProfileThemePicker.tsx`                  | lighten, ProfileThemePicker                                                                                            |       0 |     0 |
| `src/ui/settings/RecoveryCodesCard.tsx`                   | RecoveryCodesCard                                                                                                      |       0 |     0 |
| `src/ui/settings/ServiceHealthPage.tsx`                   | ServiceHealthPage                                                                                                      |       0 |     0 |
| `src/ui/settings/SettingsView.tsx`                        | SettingsView                                                                                                           |       0 |     0 |
| `src/ui/settings/ShortcutsPage.tsx`                       | KeyCaps, ShortcutsPage                                                                                                 |       0 |     0 |
| `src/ui/settings/ShownBadgePicker.tsx`                    | ShownBadgePicker                                                                                                       |       0 |     0 |
| `src/ui/settings/StoragePage.tsx`                         | StoragePage                                                                                                            |       0 |     0 |
| `src/ui/settings/SubmitDecorationDialog.tsx`              | SubmitDecorationDialog                                                                                                 |       1 |     0 |
| `src/ui/settings/YouCard.tsx`                             | YouCard                                                                                                                |       0 |     0 |
| `src/ui/settings/profileDraft.tsx`                        | ProfileDraftProvider, useProfileDraft                                                                                  |       0 |     0 |
| `src/ui/shell/AccountActions.tsx`                         | useAccountSwitcher, AccountActionsProvider                                                                             |       2 |     0 |
| `src/ui/shell/ConnectionBanner.tsx`                       | ConnectionBanner                                                                                                       |       0 |     0 |
| `src/ui/shell/ConversationRow.tsx`                        | SectionNameDialog                                                                                                      |       1 |     1 |
| `src/ui/shell/DmPromos.tsx`                               | inviteLink, InviteToMeldiqCard, MojoPromoCard                                                                          |       0 |     0 |
| `src/ui/shell/Notices.tsx`                                | Notices                                                                                                                |       0 |     0 |
| `src/ui/shell/ProfileMenu.tsx`                            | useProfileMenu                                                                                                         |       0 |     1 |
| `src/ui/shell/Rail.tsx`                                   | Rail                                                                                                                   |       0 |     1 |
| `src/ui/shell/RailCommunity.tsx`                          | useRailOrgs, CommunityButton                                                                                           |       0 |     1 |
| `src/ui/shell/RailFolder.tsx`                             | RailFolderItem                                                                                                         |       1 |     1 |
| `src/ui/shell/SettingsWindow.tsx`                         | SettingsWindow                                                                                                         |       0 |     0 |
| `src/ui/shell/Shell.tsx`                                  | Shell                                                                                                                  |       0 |     0 |
| `src/ui/shell/Sidebar.tsx`                                | Sidebar                                                                                                                |       0 |     2 |
| `src/ui/shell/SidebarSections.tsx`                        | Collapsible, PersonalSections, ChannelSections, BrowseRow, PeopleList, ArchivedList, SkeletonRows, PeopleExtras, DmHub |       0 |     1 |
| `src/ui/shell/TabBar.tsx`                                 | TabBar                                                                                                                 |       0 |     0 |
| `src/ui/shell/TabIndicators.tsx`                          | TabIndicators                                                                                                          |       0 |     0 |
| `src/ui/shell/TopBar.tsx`                                 | TopBar                                                                                                                 |       0 |     0 |
| `src/ui/shell/UserPanel.tsx`                              | UserPanel                                                                                                              |       0 |     2 |
| `src/ui/shell/VoiceRooms.tsx`                             | VoiceRoomsSection                                                                                                      |       0 |     0 |
| `src/ui/views/ActivityView.tsx`                           | ActivityView                                                                                                           |       0 |     0 |
| `src/ui/views/DiscoverCard.tsx`                           | DiscoverCommunityCard                                                                                                  |       0 |     0 |
| `src/ui/views/DiscoverView.tsx`                           | DiscoverView                                                                                                           |       0 |     0 |
| `src/ui/views/DraftsAndSent.tsx`                          | DraftsAndSent                                                                                                          |       0 |     0 |
| `src/ui/views/FriendRows.tsx`                             | Group, FriendRow                                                                                                       |       0 |     1 |
| `src/ui/views/FriendsView.tsx`                            | FriendsView                                                                                                            |       0 |     0 |
| `src/ui/views/HomeView.tsx`                               | HomeView                                                                                                               |       0 |     0 |
| `src/ui/views/StartChecklist.tsx`                         | StartChecklist                                                                                                         |       0 |     0 |
| `src/ui/views/SuggestedPeople.tsx`                        | SuggestedPeople                                                                                                        |       0 |     0 |
| `src/ui/workspace/AddMembersDialog.tsx`                   | AddMembersDialog                                                                                                       |       1 |     0 |
| `src/ui/workspace/AppearanceCard.tsx`                     | AppearanceCard                                                                                                         |       0 |     0 |
| `src/ui/workspace/AuditPage.tsx`                          | AuditPage                                                                                                              |       0 |     0 |
| `src/ui/workspace/BotsPage.tsx`                           | BotsPage                                                                                                               |       0 |     0 |
| `src/ui/workspace/ChannelsPage.tsx`                       | KindIcon, ChannelsPage                                                                                                 |       0 |     0 |
| `src/ui/workspace/EveryoneDialog.tsx`                     | EveryoneDialog                                                                                                         |       1 |     0 |
| `src/ui/workspace/ExpressionsPage.tsx`                    | ExpressionsPage, UploadDialog                                                                                          |       1 |     0 |
| `src/ui/workspace/GuidePages.tsx`                         | GuidePage, OnboardingPage                                                                                              |       0 |     0 |
| `src/ui/workspace/InvitationsPage.tsx`                    | InvitationsPage                                                                                                        |       0 |     0 |
| `src/ui/workspace/InviteLink.tsx`                         | InviteShare, QuickInvite                                                                                               |       0 |     0 |
| `src/ui/workspace/LobbySettingsPage.tsx`                  | LobbySettingsPage                                                                                                      |       0 |     0 |
| `src/ui/workspace/MeetingsPage.tsx`                       | MeetingsPage                                                                                                           |       1 |     0 |
| `src/ui/workspace/MemberParityActions.tsx`                | memberParityEntries, MemberParityDialogs                                                                               |       1 |     0 |
| `src/ui/workspace/ModerationPages.tsx`                    | AccessCard, JoinQuestionsCard, SecurityPage, BansPage, ApplicationsPage                                                |       0 |     0 |
| `src/ui/workspace/OnboardingGateCard.tsx`                 | OnboardingGateCard                                                                                                     |       0 |     0 |
| `src/ui/workspace/OverviewPage.tsx`                       | OverviewPage                                                                                                           |       1 |     0 |
| `src/ui/workspace/PeoplePage.tsx`                         | PeoplePage                                                                                                             |       5 |     1 |
| `src/ui/workspace/PinsPage.tsx`                           | PinsPage                                                                                                               |       2 |     0 |
| `src/ui/workspace/ProfileExtrasCards.tsx`                 | ProfileExtrasCards                                                                                                     |       0 |     0 |
| `src/ui/workspace/ProfileSafety.tsx`                      | ProfileSafety                                                                                                          |       0 |     0 |
| `src/ui/workspace/ReportsPage.tsx`                        | ReportsPage                                                                                                            |       0 |     0 |
| `src/ui/workspace/RoleDisplayTab.tsx`                     | RoleDisplayTab                                                                                                         |       0 |     0 |
| `src/ui/workspace/RoleEditor.tsx`                         | RoleEditor                                                                                                             |       1 |     0 |
| `src/ui/workspace/RoleMembers.tsx`                        | RoleMembersList                                                                                                        |       0 |     0 |
| `src/ui/workspace/RolePermissionsTab.tsx`                 | PermissionChecklist                                                                                                    |       0 |     0 |
| `src/ui/workspace/RolesPage.tsx`                          | orderedRoles, RolesPage                                                                                                |       1 |     1 |
| `src/ui/workspace/RulesPage.tsx`                          | RulesPage                                                                                                              |       0 |     0 |
| `src/ui/workspace/SparksPromotePages.tsx`                 | CommunitySparksPage                                                                                                    |       0 |     0 |
| `src/ui/workspace/StandardInvite.tsx`                     | StandardInvite                                                                                                         |       0 |     0 |
| `src/ui/workspace/TagCard.tsx`                            | TagCard                                                                                                                |       0 |     0 |
| `src/ui/workspace/ThemePage.tsx`                          | ThemePage                                                                                                              |       0 |     0 |
| `src/ui/workspace/TransferOwnership.tsx`                  | TransferOwnership                                                                                                      |       1 |     0 |
| `src/ui/workspace/UsagePage.tsx`                          | UsagePage                                                                                                              |       0 |     0 |
| `src/ui/workspace/VoiceBansCard.tsx`                      | VoiceBansCard                                                                                                          |       0 |     0 |
| `src/ui/workspace/WorkspaceSetupCards.tsx`                | GuestPolicyCard                                                                                                        |       0 |     0 |
| `src/ui/workspace/WorkspaceView.tsx`                      | WorkspaceView, Card, ErrorLine                                                                                         |       0 |     0 |
| `src/ui/workspace/bots/AlertsWatches.tsx`                 | AlertsWatches                                                                                                          |       0 |     0 |
| `src/ui/workspace/bots/BotDiagnostics.tsx`                | BotDiagnostics                                                                                                         |       0 |     0 |
| `src/ui/workspace/bots/BotLook.tsx`                       | BotLook                                                                                                                |       0 |     0 |
| `src/ui/workspace/bots/BotParts.tsx`                      | BotIcon, PlusChip, BotField, GetBotsPlusButton, PlusUpsell, FreePlusTable, ChannelSelect, ChannelList, Placeholders    |       0 |     0 |
| `src/ui/workspace/bots/BotSettingsForm.tsx`               | BotSettingsForm                                                                                                        |       0 |     0 |
| `src/ui/workspace/bots/BotWindow.tsx`                     | BotWindow                                                                                                              |       1 |     0 |
| `src/ui/workspace/bots/CommunityBotsCard.tsx`             | CommunityBotsCard                                                                                                      |       0 |     0 |
| `src/ui/workspace/bots/HelperLevelsForms.tsx`             | HelperForm, LevelsForm                                                                                                 |       0 |     0 |
| `src/ui/workspace/bots/LoggerStarboardForms.tsx`          | LoggerForm, StarboardForm                                                                                              |       0 |     0 |
| `src/ui/workspace/bots/OfficialBotsSection.tsx`           | useOfficialBotsOffered, OfficialBotsSection, AlsoBuiltIn                                                               |       0 |     0 |
| `src/ui/workspace/bots/PartTwoForms.tsx`                  | GiveawaysForm, WordyForm                                                                                               |       0 |     0 |
| `src/ui/workspace/bots/WelcomerForm.tsx`                  | WelcomerForm                                                                                                           |       0 |     0 |
| `src/ui/workspace/communityRail.tsx`                      | visibleCommunityRail, communityRailKey, communityPageTitle                                                             |       0 |     0 |
| `src/ui/workspace/discovery/DiscoveryCard.tsx`            | DiscoveryCard                                                                                                          |       0 |     0 |
| `src/ui/workspace/discovery/TemplateCard.tsx`             | TemplateCard                                                                                                           |       0 |     0 |
| `src/ui/workspace/promote/BoostCards.tsx`                 | BoostCards                                                                                                             |       0 |     0 |
| `src/ui/workspace/promote/PromotePage.tsx`                | PromotePage                                                                                                            |       0 |     0 |
| `src/ui/workspace/promote/PromotedRowCard.tsx`            | PromotedRowCard                                                                                                        |       0 |     0 |
