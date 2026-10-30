import { Gem } from "lucide-react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { navigate } from "../../application/router";
import { SparkGoal } from "../mojo/SparkGoal";
import { Card } from "./WorkspaceView";

/**
 * Community settings › Sparks (the reference's boost page, Meldiq Spark): the community's level and goal, which opens
 * the Sparks dialog where anyone can give one, and the way to your own Sparks.
 */
export function CommunitySparksPage({ detail }: { detail: OrgAdminDetail }) {
  return (
    <div className="ws-page">
      <Card title="Spark level" sub="Every Spark lifts the whole community: more emoji, bigger uploads and better voice for everyone here.">
        <SparkGoal orgId={detail.org.id} name={detail.org.name} />
      </Card>
      <Card title="Your Sparks" sub="See the Sparks you have and where they're given.">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "spark" })}>
            <Gem size={14} aria-hidden="true" /> Open Meldiq Spark
          </button>
        </div>
      </Card>
    </div>
  );
}
