import { ChevronRight, Search, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Localized } from "../../i18n/Localized";
import { useT } from "../../i18n";

export interface SettingsDestination<K extends string> {
  key: K;
  label: string;
  icon: ReactNode;
  description?: string;
  keywords?: string;
}
export interface SettingsGroup<K extends string> {
  key: string;
  title: string;
  pages: readonly SettingsDestination<K>[];
}

export function matchesSettingsText(text: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const haystack = normalize(text);
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

/** Both settings areas use these destinations for search, desktop links, and the compact selector. */
export function SettingsNavigation<K extends string>({
  groups,
  current,
  onSelect,
  query,
  onQuery,
  label,
  compactLabel,
  compact = false,
}: {
  groups: readonly SettingsGroup<K>[];
  current: K;
  onSelect: (key: K) => void;
  query: string;
  onQuery: (query: string) => void;
  label: string;
  compactLabel?: string;
  compact?: boolean;
}) {
  const t = useT();
  const id = useId();
  const filtered = groups.map((g) => ({ ...g, pages: g.pages.filter((p) => matchesSettingsText([p.label, p.description, p.keywords].join(" "), query)) })).filter((g) => g.pages.length);
  return (
    <>
      {compact && (
        <label className="settings-compact-nav">
          <span className="sr-only">{compactLabel ?? label}</span>
          <select className="input" value={groups.some((g) => g.pages.some((p) => p.key === current)) ? current : ""} onChange={(e) => onSelect(e.target.value as K)}>
            <option value="" disabled>
              {t("workspace.interface.choose_a_settings_page_c5f66ba")}
            </option>
            {groups.map((g) => (
              <optgroup key={g.key} label={g.title}>
                {g.pages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="settings-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          aria-label={label}
          placeholder={label}
          aria-controls={id}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDownCapture={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              e.stopPropagation();
              onQuery("");
            } else if (e.key === "ArrowDown" || (e.key === "Enter" && query.trim())) {
              e.preventDefault();
              const results = filtered.flatMap((group) => group.pages);
              if (e.key === "Enter" && results.length === 1) onSelect(results[0].key);
              else document.getElementById(id)?.querySelector<HTMLButtonElement>("button[data-settings-key]")?.focus();
            }
          }}
        />
        {query && (
          <button type="button" className="icon-btn" aria-label={t("settings.interface.clear_settings_search_63c62e1")} onClick={() => onQuery("")}>
            <X size={14} />
          </button>
        )}
      </div>
      <div
        id={id}
        className="settings-nav-pages"
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-settings-key]")];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (index < 0 || !buttons.length) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next].focus();
        }}
      >
        {query && !filtered.length && (
          <p className="faint settings-search-empty" role="status">
            <Localized k="settings.interface.no_settings_found_for_try_a_different_word_f3ce051" slots={[query]} />
          </p>
        )}
        {filtered.map((g) => (
          <div key={g.key} role="group" aria-label={g.title} className="settings-nav-group">
            <div className="settings-nav-title">{g.title}</div>
            {g.pages.map((p) => (
              <button type="button" key={p.key} data-settings-key={p.key} className="side-item" aria-current={current === p.key ? "page" : undefined} onClick={() => onSelect(p.key)}>
                <span className="glyph" aria-hidden="true">
                  {p.icon}
                </span>
                <span className="grow settings-search-result">
                  <span>{p.label}</span>
                  {query && p.description && <small>{p.description}</small>}
                </span>
                <ChevronRight size={16} className="faint you-only" aria-hidden="true" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function SettingsUnavailable() {
  const t = useT();
  return (
    <div className="empty settings-unavailable" role="status">
      <h1>{t("settings.navigation.unavailable")}</h1>
      <p className="muted">{t("settings.navigation.unavailableDescription")}</p>
    </div>
  );
}
