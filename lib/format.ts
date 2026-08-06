/**
 * Deterministic number formatting for SSR'd client components.
 *
 * `toLocaleString("en-ZA")` renders DIFFERENTLY on the server (Node ICU:
 * "1,800") and in the browser (Chrome ICU: "1 800" with a non-breaking
 * space) - a hydration text mismatch that makes React throw the subtree away
 * and silently drop its event handlers. This helper produces the same string
 * everywhere: space-grouped thousands, the SA convention.
 */
export function za(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}
