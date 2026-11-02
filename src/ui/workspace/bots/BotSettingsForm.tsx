import type { AnySettings, BotSettingsMap, SettingsKey } from "../../../sync/officialBotRules";
import type { BotFormProps } from "./botForm";
import { HelperForm, LevelsForm } from "./HelperLevelsForms";
import { LoggerForm, StarboardForm } from "./LoggerStarboardForms";
import { GiveawaysForm, WordyForm } from "./PartTwoForms";
import { WelcomerForm } from "./WelcomerForm";

type Common = Omit<BotFormProps<SettingsKey>, "draft" | "set">;

interface BotSettingsFormProps extends Common {
  botKey: SettingsKey;
  draft: AnySettings;
  set: (patch: AnySettings) => void;
}

/** The settings form of one bot (the draft is checked by officialBotRules before it's saved). */
export function BotSettingsForm({ botKey, draft, set, ...rest }: BotSettingsFormProps) {
  const props = <K extends SettingsKey>() => ({ ...rest, draft: draft as unknown as BotSettingsMap[K], set: set as (p: Partial<BotSettingsMap[K]>) => void });
  switch (botKey) {
    case "welcomer":
      return <WelcomerForm {...props<"welcomer">()} />;
    case "helper":
      return <HelperForm {...props<"helper">()} />;
    case "levels":
      return <LevelsForm {...props<"levels">()} />;
    case "logger":
      return <LoggerForm {...props<"logger">()} />;
    case "starboard":
      return <StarboardForm {...props<"starboard">()} />;
    case "giveaways":
      return <GiveawaysForm {...props<"giveaways">()} />;
    case "wordy":
      return <WordyForm {...props<"wordy">()} />;
  }
}
