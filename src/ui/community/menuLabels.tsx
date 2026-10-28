import {
  Archive,
  ArchiveRestore,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  IdCard,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  FolderInput,
  KeyRound,
  ArrowDown,
  ArrowUp,
  CheckCheck,
  Pencil,
  Plus,
  SlidersHorizontal,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CategoryMenuItem, ChannelMenuItem } from "../../sync/communityRules";

type Label = { label: string; icon: ReactNode; danger?: boolean };

/** What each channel menu item says (android CommunityMenus channelItem). */
export const CHANNEL_ITEM: Record<ChannelMenuItem, Label> = {
  markRead: { label: "Mark as read", icon: <CheckCheck size={16} /> },
  favourite: { label: "Star", icon: <Star size={16} /> },
  unfavourite: { label: "Remove from Starred", icon: <StarOff size={16} /> },
  mute: { label: "Mute channel…", icon: <BellOff size={16} /> },
  unmute: { label: "Unmute channel", icon: <Bell size={16} /> },
  hide: { label: "Hide from channel list", icon: <EyeOff size={16} /> },
  show: { label: "Show in channel list", icon: <Eye size={16} /> },
  copyName: { label: "Copy name", icon: <Copy size={16} /> },
  copyId: { label: "Copy channel ID", icon: <IdCard size={16} /> },
  edit: { label: "Edit channel…", icon: <Pencil size={16} /> },
  permissions: { label: "Permissions…", icon: <KeyRound size={16} /> },
  moveTo: { label: "Move to…", icon: <FolderInput size={16} /> },
  moveUp: { label: "Move up", icon: <ArrowUp size={16} /> },
  moveDown: { label: "Move down", icon: <ArrowDown size={16} /> },
  archive: { label: "Archive channel", icon: <Archive size={16} /> },
  restore: { label: "Restore channel", icon: <ArchiveRestore size={16} /> },
  delete: { label: "Delete channel…", icon: <Trash2 size={16} />, danger: true },
};

/** What each category menu item says (android CommunityMenus categoryItem). */
export const CATEGORY_ITEM: Record<CategoryMenuItem, Label> = {
  markRead: { label: "Mark as read", icon: <CheckCheck size={16} /> },
  collapse: { label: "Collapse", icon: <ChevronsDownUp size={16} /> },
  expand: { label: "Expand", icon: <ChevronsUpDown size={16} /> },
  collapseAll: { label: "Collapse all categories", icon: <ChevronsDownUp size={16} /> },
  mute: { label: "Mute category…", icon: <BellOff size={16} /> },
  unmute: { label: "Unmute category", icon: <Bell size={16} /> },
  notify: { label: "Notification settings…", icon: <SlidersHorizontal size={16} /> },
  newChannel: { label: "Create channel…", icon: <Plus size={16} /> },
  rename: { label: "Rename category…", icon: <Pencil size={16} /> },
  permissions: { label: "Permissions…", icon: <KeyRound size={16} /> },
  moveUp: { label: "Move up", icon: <ArrowUp size={16} /> },
  moveDown: { label: "Move down", icon: <ArrowDown size={16} /> },
  delete: { label: "Delete category…", icon: <Trash2 size={16} />, danger: true },
};
