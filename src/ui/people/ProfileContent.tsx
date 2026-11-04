import type { Profile } from "../../api/schemas";
import { useT } from "../../i18n";
import { SafeLink } from "../chat/SafeLink";
import { ProfileConnections } from "./ProfileConnections";
import { visibleProfileSections } from "./profileSections";

/** Public profile and editor preview share ordering. Hidden data is also withheld by the capable server. */
export function ProfileContent({ profile, connections = true }: { profile: Pick<Profile, "profileStyle" | "aboutMe" | "links" | "connections">; connections?: boolean }) {
  const t = useT();
  return (
    <div className="profile-content">
      {visibleProfileSections(profile.profileStyle).map((section) => {
        if (section === "about" && profile.aboutMe)
          return (
            <section key={section} className="profile-box" aria-label={t("files.interface.about_me_1359ec8")}>
              <h3>{t("files.interface.about_me_1359ec8")}</h3>
              <p className="profile-about">{profile.aboutMe}</p>
            </section>
          );
        if (section === "links" && profile.links.length)
          return (
            <section key={section} className="profile-box" aria-label={t("messaging.interface.links_9024c19")}>
              <h3>{t("messaging.interface.links_9024c19")}</h3>
              <ul className="profile-links">
                {profile.links.map((link) => (
                  <li key={link.url}>
                    <SafeLink href={link.url}>{link.label}</SafeLink>
                  </li>
                ))}
              </ul>
            </section>
          );
        if (section === "connections" && connections) return <ProfileConnections key={section} list={profile.connections} />;
        return null;
      })}
    </div>
  );
}
