import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Gem } from "lucide-react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { navigate } from "../../application/router";
import { SparkGoal } from "../mojo/SparkGoal";
import { Card } from "../components/SettingsCard";
/**
 * Community settings › Sparks (the reference's boost page, Meldiq Spark): the community's level and goal, which opens
 * the Sparks dialog where anyone can give one, and the way to your own Sparks.
 */
export function CommunitySparksPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  return (
    <div className="ws-page">
      <Card title={uiText("workspace.interface.spark_level_f39d46a")} sub={uiText("workspace.interface.every_spark_lifts_the_whole_community_more_emoji_bigger_uploads_a_8d37581")}>
        <SparkGoal orgId={detail.org.id} name={detail.org.name} />
      </Card>
      <Card title={uiText("billing.interface.your_sparks_ac4e63d")} sub={uiText("workspace.interface.see_the_sparks_you_have_and_where_they_re_given_fab6586")}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "spark" })}>
            <Localized k="billing.interface.open_meldiq_spark_1eb51b9" slots={[<Gem size={14} aria-hidden="true" />]} />
          </button>
        </div>
      </Card>
    </div>
  );
}
