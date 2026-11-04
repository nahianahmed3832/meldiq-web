import { Check } from "lucide-react";
import { useT } from "../../i18n";

/** Shared by account setup and the signed-in welcome flow; contains no navigation or authentication logic. */
export function SetupProgress({ labels, current }: { labels: readonly string[]; current: number }) {
  const t = useT();
  return (
    <ol className="setup-progress" aria-label={t("auth.foundation.progress", { step: current + 1, total: labels.length })}>
      {labels.map((label, index) => (
        <li key={label} aria-current={current === index ? "step" : undefined} data-complete={index < current || undefined}>
          <span aria-hidden="true">{index < current ? <Check size={14} /> : index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}
