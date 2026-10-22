import dynamic from "next/dynamic";

/**
 * Every route of the app (src/application/router.ts) is this one client-only page. Messages and keys exist only in the
 * browser (end-to-end encryption), so nothing here is rendered on a server: the static export is the page's empty shell,
 * index.html, which nginx serves for any app path (deploy/nginx, try_files … /index.html). A static page (not a
 * catch-all route) on purpose: Next.js then never re-routes on load, which would look the path up among its pages.
 */
const ClientRoot = dynamic(() => import("../client/Root"), { ssr: false });

export default function AppPage() {
  return <ClientRoot />;
}
