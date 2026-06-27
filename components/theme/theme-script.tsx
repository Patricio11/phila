import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Sets the theme class on <html> **before first paint**, so there is never a
 * flash of the wrong theme (DESIGN.md §10). Runs synchronously in <head>;
 * deliberately tiny and dependency-free. Light is the default.
 */
export function ThemeScript() {
  const js = `(function(){var r=document.documentElement;r.classList.add("js");try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(t!=="light"&&t!=="dark"){t=${JSON.stringify(
    DEFAULT_THEME,
  )};}r.classList.toggle("dark",t==="dark");r.dataset.theme=t;}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
