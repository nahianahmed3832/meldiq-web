import { text as uiText } from "../../i18n";
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
type Label = {
  label: string;
  icon: ReactNode;
  danger?: boolean;
};
/** What each channel menu item says (android CommunityMenus channelItem). */
export const CHANNEL_ITEM: Record<ChannelMenuItem, Label> = {
  markRead: {
    get label() {
      return uiText("notifications.markRead");
    },
    icon: <CheckCheck size={16} />,
  },
  favourite: {
    get label() {
      return uiText("organization.interface.star_e357d39");
    },
    icon: <Star size={16} />,
  },
  unfavourite: {
    get label() {
      return uiText("organization.interface.remove_from_starred_1ae7d78");
    },
    icon: <StarOff size={16} />,
  },
  mute: {
    get label() {
      return uiText("organization.interface.mute_channel_5998856");
    },
    icon: <BellOff size={16} />,
  },
  unmute: {
    get label() {
      return uiText("organization.interface.unmute_channel_6eb9aa8");
    },
    icon: <Bell size={16} />,
  },
  hide: {
    get label() {
      return uiText("organization.interface.hide_from_channel_list_36df5c3");
    },
    icon: <EyeOff size={16} />,
  },
  show: {
    get label() {
      return uiText("organization.interface.show_in_channel_list_878d748");
    },
    icon: <Eye size={16} />,
  },
  copyName: {
    get label() {
      return uiText("organization.interface.copy_name_a037e53");
    },
    icon: <Copy size={16} />,
  },
  copyId: {
    get label() {
      return uiText("organization.interface.copy_channel_id_bdb175d");
    },
    icon: <IdCard size={16} />,
  },
  edit: {
    get label() {
      return uiText("organization.interface.edit_channel_9f0f0ff");
    },
    icon: <Pencil size={16} />,
  },
  permissions: {
    get label() {
      return uiText("organization.interface.permissions_cd4f4e3");
    },
    icon: <KeyRound size={16} />,
  },
  moveTo: {
    get label() {
      return uiText("organization.interface.move_to_5af2f53");
    },
    icon: <FolderInput size={16} />,
  },
  moveUp: {
    get label() {
      return uiText("organization.interface.move_up_c66feb5");
    },
    icon: <ArrowUp size={16} />,
  },
  moveDown: {
    get label() {
      return uiText("organization.interface.move_down_40bb50d");
    },
    icon: <ArrowDown size={16} />,
  },
  archive: {
    get label() {
      return uiText("organization.interface.archive_channel_e61d2bc");
    },
    icon: <Archive size={16} />,
  },
  restore: {
    get label() {
      return uiText("organization.interface.restore_channel_31d9297");
    },
    icon: <ArchiveRestore size={16} />,
  },
  delete: {
    get label() {
      return uiText("organization.interface.delete_channel_831aada");
    },
    icon: <Trash2 size={16} />,
    danger: true,
  },
};
/** What each category menu item says (android CommunityMenus categoryItem). */
export const CATEGORY_ITEM: Record<CategoryMenuItem, Label> = {
  markRead: {
    get label() {
      return uiText("notifications.markRead");
    },
    icon: <CheckCheck size={16} />,
  },
  collapse: {
    get label() {
      return uiText("organization.interface.collapse_be6eb1f");
    },
    icon: <ChevronsDownUp size={16} />,
  },
  expand: {
    get label() {
      return uiText("organization.interface.expand_07548c2");
    },
    icon: <ChevronsUpDown size={16} />,
  },
  collapseAll: {
    get label() {
      return uiText("organization.interface.collapse_all_categories_817a398");
    },
    icon: <ChevronsDownUp size={16} />,
  },
  mute: {
    get label() {
      return uiText("organization.interface.mute_category_f72ce48");
    },
    icon: <BellOff size={16} />,
  },
  unmute: {
    get label() {
      return uiText("organization.interface.unmute_category_b5b31ff");
    },
    icon: <Bell size={16} />,
  },
  notify: {
    get label() {
      return uiText("organization.interface.notification_settings_a936905");
    },
    icon: <SlidersHorizontal size={16} />,
  },
  newChannel: {
    get label() {
      return uiText("organization.interface.create_channel_1b86c6d");
    },
    icon: <Plus size={16} />,
  },
  rename: {
    get label() {
      return uiText("organization.interface.rename_category_3119b97");
    },
    icon: <Pencil size={16} />,
  },
  permissions: {
    get label() {
      return uiText("organization.interface.permissions_cd4f4e3");
    },
    icon: <KeyRound size={16} />,
  },
  moveUp: {
    get label() {
      return uiText("organization.interface.move_up_c66feb5");
    },
    icon: <ArrowUp size={16} />,
  },
  moveDown: {
    get label() {
      return uiText("organization.interface.move_down_40bb50d");
    },
    icon: <ArrowDown size={16} />,
  },
  delete: {
    get label() {
      return uiText("organization.interface.delete_category_17c9915");
    },
    icon: <Trash2 size={16} />,
    danger: true,
  },
};
