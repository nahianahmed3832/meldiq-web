import { Avatar, colorIndexOf } from "./Avatar";
import { usePhoto } from "./photos";

/** A workspace's photo, or its initials on a stable colour. */
export function OrgAvatar({ orgId, name, photoRev, size = 34, decorative = true }: { orgId: string; name: string; photoRev: number | null; size?: number; decorative?: boolean }) {
  const url = usePhoto("org", orgId, photoRev);
  return <Avatar name={name} colorIndex={colorIndexOf(orgId)} size={size} square decorative={decorative} photoUrl={url} />;
}

/** A person's photo (where their privacy setting lets this account see it), or their initials. */
export function UserAvatar(props: { userId: string; name: string; colorIndex: number; photoRev: number | null | undefined; size?: number; online?: boolean | null; decorative?: boolean }) {
  const url = usePhoto("user", props.userId, props.photoRev);
  return <Avatar name={props.name} colorIndex={props.colorIndex} size={props.size} online={props.online} decorative={props.decorative} photoUrl={url} />;
}
