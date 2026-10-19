/**
 * Why a web link in a message deserves a second look before opening (android data/model/LinkRules.warning, docs/LINKS.md),
 * or null. Same checks, same order, same wording as the phone. The link still opens if the person chooses to.
 */
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LONG_CHAIN_DOTS = 5;

export function linkWarning(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return "This address can't be read.";
  }
  // URL gives the host in its ASCII (punycode) form, as java.net.IDN.toASCII does on the phone.
  const host = u.hostname.toLowerCase();
  if (!host) return "This address has no website name.";
  if (u.username || u.password) return `The address hides its real destination before “@”. It goes to ${readableDomain(href) ?? host}.`;
  if (host.split(".").some((label) => label.startsWith("xn--"))) return `The address uses letters from other alphabets that can look like familiar ones: ${host}.`;
  if (IPV4.test(host) || host.startsWith("[")) return "The address is a bare IP number, not a website name.";
  if (u.protocol === "http:") return "This link isn't encrypted (http): the network can see and change what you load.";
  if (host.split(".").length - 1 >= LONG_CHAIN_DOTS) return `The address has an unusually long chain of names: check the end of it, ${host.split(".").slice(-2).join(".")}.`;
  return null;
}

/** The site's name to show ("example.com" for "https://www.example.com/a"); null when the address can't be read. */
export function readableDomain(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
