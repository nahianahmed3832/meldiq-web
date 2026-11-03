import { text as uiText } from "../i18n";
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
    return uiText("workspace.interface.this_address_can_t_be_read_f980846");
  }
  // URL gives the host in its ASCII (punycode) form, as java.net.IDN.toASCII does on the phone.
  const host = u.hostname.toLowerCase();
  if (!host) return uiText("workspace.interface.this_address_has_no_website_name_c609420");
  if (u.username || u.password) return uiText("workspace.interface.the_address_hides_its_real_destination_before_it_goes_to_value0_eda5809", { value0: readableDomain(href) ?? host });
  if (host.split(".").some((label) => label.startsWith("xn--"))) return uiText("workspace.interface.the_address_uses_letters_from_other_alphabets_that_can_look_like_1212774", { value0: host });
  if (IPV4.test(host) || host.startsWith("[")) return uiText("workspace.interface.the_address_is_a_bare_ip_number_not_a_website_name_1cc9cb7");
  if (u.protocol === "http:") return uiText("workspace.interface.this_link_isn_t_encrypted_http_the_network_can_see_and_change_wha_3706abd");
  if (host.split(".").length - 1 >= LONG_CHAIN_DOTS)
    return uiText("workspace.interface.the_address_has_an_unusually_long_chain_of_names_check_the_end_of_85e0f33", { value0: host.split(".").slice(-2).join(".") });
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
