import { useEffect, useState } from "react";

/** A display countdown; server rate limits remain authoritative. No code or identity is stored. */
export function useCodeCooldown(initialDeadline = 0) {
  const [deadline, setDeadline] = useState(initialDeadline);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (deadline <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return { seconds: Math.max(0, Math.ceil((deadline - now) / 1000)), waitUntil: setDeadline };
}
