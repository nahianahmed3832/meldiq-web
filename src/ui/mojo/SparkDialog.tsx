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
      setError(e instanceof Error ? e.message : "Couldn't change the Spark.");
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
      <button className="icon-btn spark-dialog-close" onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
      <OrgAvatar orgId={orgId} name={name} photoRev={photoRev} size={72} />
      <h2>Sparks for {name}</h2>
      {here && (
        <>
          <p className="spark-now">
            <strong>{here.level === 0 ? "No Spark level yet" : `Level ${here.level} unlocked for everyone here`}</strong>
            <small>
              {here.active} active Spark{here.active === 1 ? "" : "s"}
              {here.next ? `: ${here.next.needs} more for Level ${here.next.level}` : ": the highest level"}
            </small>
          </p>
          <SparkTrack levels={levels} level={here.level} active={here.active} />
        </>
      )}
    </div>
  );
  return (
    <Dialog title={`Sparks for ${name}`} onClose={onClose} header={header} className="spark-dialog-shell" width="min(760px, 100%)">
      <div className="dialog-body spark-dialog">
        {!here || !catalog ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <p className="spark-unlocks-title">What everyone here has now</p>
            <ul className="spark-unlocks">
              <li>{here.perks.emojiSlots} emoji slots</li>
              <li>{here.perks.uploadBytes ? `${size(here.perks.uploadBytes)} uploads for everyone` : "Everyone's own upload limit"}</li>
              <li>{here.perks.voiceKbps} kbps voice</li>
              <li>{here.perks.screen.length ? `${screenLabel(catalog, here.perks.screen)} screen sharing for everyone` : "Everyone's own screen sharing"}</li>
            </ul>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Give a Spark to a server you love. Every Spark helps unlock more emoji slots, bigger uploads, and better voice and screen sharing for everyone here. A level never lowers what anyone's
              own plan gives.
            </p>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            {mine.length > 0 && (
              <p style={{ margin: 0 }}>
                You give this community {mine.length} Spark{mine.length === 1 ? "" : "s"}. Thank you.
              </p>
            )}
            {confirmTake && (
              <div className="banner warn" role="alert">
                Taking this Spark back {lowers ? `drops ${name} to Level ${here.level - 1} for everyone` : "doesn't change the level"}.{" "}
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void act(() => engine.mojo.removeSpark(confirmTake))}>
                  Take it back
                </button>{" "}
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmTake(null)}>
                  Keep it
                </button>
              </div>
            )}
            <div className="row spark-actions">
              {free > 0 ? (
                <button className="btn btn-lg btn-mojo" disabled={busy || !online} onClick={() => void act(() => engine.mojo.giveSpark(orgId))}>
                  <Sparkles size={15} /> {here.level >= 3 ? "Give a Spark (already Level 3)" : "Give a Spark"}
                </button>
              ) : (
                <button
                  className="btn btn-lg btn-mojo"
                  onClick={() => {
                    onClose();
                    navigate({ section: "settings", settingsPage: "mojo" });
                  }}
                >
                  <Sparkles size={15} /> Get Sparks{catalog.onSale.spark ? ` (${money(catalog.onSale.spark.amountMinor, catalog.onSale.spark.currency)}/month each)` : ""}
                </button>
              )}
              {mine.length > 0 && !confirmTake && (
                <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setConfirmTake(mine[mine.length - 1]!.id)}>
                  Take one back
                </button>
              )}
            </div>
            {here.level >= 3 && free > 0 && <small className="muted">This community is at the highest level: a Spark may do more for another one.</small>}
            <SparkLevelCards catalog={catalog} levels={levels} level={here.level} />
          </>
        )}
      </div>
    </Dialog>
  );
}
