import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

// Background colors exported so ActiveSessionPage can use them
// for its blend gradient without needing context.
export const THEME_BG: Record<Theme, string> = {
  dark: "hsl(226, 42%, 9%)",
  light: "hsl(38, 38%, 91%)",
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("chair_theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.backgroundColor = THEME_BG[theme];
    document.body.style.backgroundColor = THEME_BG[theme];
    localStorage.setItem("chair_theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
