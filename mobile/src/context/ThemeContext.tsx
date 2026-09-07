import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Asset } from "expo-asset";
import * as SecureStore from "expo-secure-store";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = "mobile-theme";
const wallpaperAssets = [
  Asset.fromModule(require("../../assets/chat-wallpaper.jpg")),
  Asset.fromModule(require("../../assets/darktheme-bg.jpg")),
];

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void Promise.all([
      SecureStore.getItemAsync(THEME_KEY),
      ...wallpaperAssets.map((asset) => asset.downloadAsync()),
    ])
      .then(([storedTheme]) => {
        if (mounted && (storedTheme === "light" || storedTheme === "dark")) {
          setTheme(storedTheme);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      void SecureStore.setItemAsync(THEME_KEY, nextTheme);
      return nextTheme;
    });
  };

  if (!ready) return null;

  return <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
