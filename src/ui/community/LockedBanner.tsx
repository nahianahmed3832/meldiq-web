import { Lock } from "lucide-react";
import { untilWhen } from "../format";

/** A locked community (community parity A2), on top of its channels: nobody new joins and only moderators chat. */
export function LockedBanner({ until }: { until: number }) {
  return (
    <div className="banner warn" role="status">
      <Lock size={16} aria-hidden="true" />
      <span className="grow">This community is locked and unlocks {untilWhen(until)}. Nobody new can join and only moderators can chat for now.</span>
    </div>
  );
}
