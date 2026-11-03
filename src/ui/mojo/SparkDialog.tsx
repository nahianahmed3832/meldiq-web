import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { Dialog } from "../components/Overlay";
import { OrgAvatar } from "../components/OrgAvatar";
import { money, screenLabel, size } from "./mojoFormat";
import { SparkLevelCards, SparkTrack } from "./SparkTrack";
/**
 * "Meldiq Sparks" from a community's menu (server docs/MOJO.md › Meldiq Spark): the community's level and what it gives
 * everyone, how many more Sparks the next level needs, and the person's own Sparks here: give one, or take one back
 * (saying first when that lowers the level for everyone).
 */
export function SparkDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { catalog, me } = useOrbit((s) => s.mojo);
  const here = useOrbit((s) => s.mojo.orgs[orgId] ?? null);
  const online = useOrbit((s) => s.connection === "online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTake, setConfirmTake] = useState<string | null>(null);
  useEffect(() => {
    void engine.mojo.loadOrg(orgId);
    if (!me) void engine.mojo.refresh();
  }, [engine, orgId, me]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await engine.mojo.loadOrg(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_change_the_spark_b44a932"));
    } finally {
      setBusy(false);
      setConfirmTake(null);
    }
  };
  const mine = here?.mine.filter((m) => !m.paused) ?? [];
  const free = me?.sparks.free ?? 0;
  // Taking one back lowers the level when the server would fall below its level's threshold (2, 5 or 8 Sparks).
  const threshold = catalog?.spark.levels.find((l) => l.level === here?.level)?.sparks ?? 0;
  const lowers = !!here && here.level > 0 && here.active - 1 < threshold;
  const photoRev = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.photoRev ?? null);
  const levels = catalog?.spark.levels.filter((l) => l.level > 0) ?? [];
  const header = (
    <div className="spark-dialog-hero">
      <button className="icon-btn spark-dialog-close" onClick={onClose} aria-label={l10n("common.actions.close")}>
        <X size={18} />
      </button>
      <OrgAvatar orgId={orgId} name={name} photoRev={photoRev} size={72} />
      <h2>
        <Localized k="billing.interface.sparks_for_209c9b6" slots={[name]} />
      </h2>
      {here && (
        <>
          <p className="spark-now">
            <strong>
              {here.level === 0 ? uiText("billing.interface.no_spark_level_yet_b40719a") : uiText("billing.interface.level_value0_unlocked_for_everyone_here_0115823", { value0: here.level })}
            </strong>
            <small>
              <Localized
                k="billing.spark.activeCount"
                slots={[
                  countLabel(here.active, "sparks"),
                  "",
                  here.next
                    ? uiText("billing.interface.value0_more_for_level_value1_ed8e992", { value0: here.next.needs, value1: here.next.level })
                    : uiText("billing.interface.the_highest_level_7b900b2"),
                ]}
              />
            </small>
          </p>
          <SparkTrack levels={levels} level={here.level} active={here.active} />
        </>
      )}
    </div>
  );
  return (
    <Dialog title={uiText("billing.interface.sparks_for_value0_d212480", { value0: name })} onClose={onClose} header={header} className="spark-dialog-shell" width="min(760px, 100%)">
      <div className="dialog-body spark-dialog">
        {!here || !catalog ? (
          <p className="muted">{l10n("common.status.loading")}</p>
        ) : (
          <>
            <p className="spark-unlocks-title">
              <Localized k="billing.interface.what_everyone_here_has_now_1a1dce0" />
            </p>
            <ul className="spark-unlocks">
              <li>
                <Localized k="billing.interface.emoji_slots_14bf5ac" slots={[here.perks.emojiSlots]} />
              </li>
              <li>
                {here.perks.uploadBytes
                  ? uiText("billing.interface.value0_uploads_for_everyone_87f3948", { value0: size(here.perks.uploadBytes) })
                  : uiText("billing.interface.everyone_s_own_upload_limit_a6cca65")}
              </li>
              <li>
                <Localized k="billing.interface.kbps_voice_cce4e30" slots={[here.perks.voiceKbps]} />
              </li>
              <li>
                {here.perks.screen.length
                  ? uiText("billing.interface.value0_screen_sharing_for_everyone_183ee94", { value0: screenLabel(catalog, here.perks.screen) })
                  : uiText("billing.interface.everyone_s_own_screen_sharing_5782643")}
              </li>
            </ul>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              <Localized k="billing.interface.give_a_spark_to_a_server_you_love_every_spark_helps_unlock_more_e_e10d3b6" />
            </p>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            {mine.length > 0 && (
              <p style={{ margin: 0 }}>
                <Localized k="billing.interface.native_count_cfe979907" slots={[countLabel(mine.length, "sparks"), ""]} />
              </p>
            )}
            {confirmTake && (
              <div className="banner warn" role="alert">
                <Localized
                  k="billing.interface.taking_this_spark_back_2b7f072"
                  slots={[
                    lowers
                      ? uiText("billing.interface.drops_value0_to_level_value1_for_everyone_3d440db", { value0: name, value1: here.level - 1 })
                      : uiText("billing.interface.doesn_t_change_the_level_1448fc3"),
                  ]}
                />
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void act(() => engine.mojo.removeSpark(confirmTake))}>
                  <Localized k="billing.interface.take_it_back_e7dd2b1" />
                </button>{" "}
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmTake(null)}>
                  <Localized k="workspace.interface.keep_it_fdce5da" />
                </button>
              </div>
            )}
            <div className="row spark-actions">
              {free > 0 ? (
                <button className="btn btn-lg btn-mojo" disabled={busy || !online} onClick={() => void act(() => engine.mojo.giveSpark(orgId))}>
                  <Sparkles size={15} /> {here.level >= 3 ? uiText("billing.interface.give_a_spark_already_level_3_ae2a884") : uiText("billing.interface.give_a_spark_ec29de8")}
                </button>
              ) : (
                <button
                  className="btn btn-lg btn-mojo"
                  onClick={() => {
                    onClose();
                    navigate({ section: "settings", settingsPage: "spark" });
                  }}
                >
                  <Localized
                    k="billing.interface.get_sparks_ea01f0f"
                    slots={[
                      <Sparkles size={15} />,
                      catalog.onSale.spark ? uiText("billing.interface.value0_each_one_time_d785299", { value0: money(catalog.onSale.spark.amountMinor, catalog.onSale.spark.currency) }) : "",
                    ]}
                  />
                </button>
              )}
              {mine.length > 0 && !confirmTake && (
                <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setConfirmTake(mine[mine.length - 1]!.id)}>
                  <Localized k="billing.interface.take_one_back_b6d44b9" />
                </button>
              )}
            </div>
            {here.level >= 3 && free > 0 && (
              <small className="muted">
                <Localized k="billing.interface.this_community_is_at_the_highest_level_a_spark_may_do_more_for_an_2556bbf" />
              </small>
            )}
            <SparkLevelCards catalog={catalog} levels={levels} level={here.level} />
          </>
        )}
      </div>
    </Dialog>
  );
}
