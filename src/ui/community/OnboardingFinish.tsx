import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { finishOnboarding } from "../../sync/communitySettings";
import { onboarding, type Onboarding } from "../../sync/guide";
import { OnboardingDialog } from "./GuideOnboarding";

interface OnboardingFlowProps {
  orgId: string;
  onClose: () => void;
}

/**
 * Finishing (or redoing) a community's onboarding (community parity A3): its questions first, then the server records
 * it (after the rules, which the composer asks for on its own), and the person lands in the community's starting channel.
 */
export function OnboardingFlow({ orgId, onClose }: OnboardingFlowProps) {
  const engine = useEngine();
  const [data, setData] = useState<Onboarding | null>(null);
  const finish = async () => {
    try {
      const status = await finishOnboarding(engine, orgId);
      if (status.startChannelId) navigate({ section: "home", conversationId: status.startChannelId });
    } catch (e) {
      engine.notice(
        "error",
        e instanceof ApiError && e.code === "rules_not_agreed" ? "Agree to this community's rules first, then finish." : e instanceof Error ? e.message : "Couldn't finish onboarding.",
      );
    } finally {
      onClose();
    }
  };
  useEffect(() => {
    let alive = true;
    onboarding(engine, orgId)
      .then((d) => {
        if (!alive) return;
        if (d.enabled && d.prompts.length > 0) setData(d);
        else void finish();
      })
      .catch(() => alive && void finish());
    return () => {
      alive = false;
    };
    // Once per opening: finish() only closes and navigates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, orgId]);
  if (!data) return null;
  return <OnboardingDialog orgId={orgId} data={data} onClose={onClose} onDone={() => void finish()} />;
}
