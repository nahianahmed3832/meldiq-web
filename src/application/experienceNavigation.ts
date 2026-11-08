export const OPEN_SPARK = "meldiq:open-spark";
export function openSpark() {
  window.dispatchEvent(new Event(OPEN_SPARK));
}
