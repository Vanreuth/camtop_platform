"use client";

import { useEffect } from "react";

export function FontProvider() {
  useEffect(() => {
    // Load and apply saved font preferences from localStorage
    const savedLanguageFont = localStorage.getItem("languageFont");
    const savedFontSize = localStorage.getItem("fontSize");
    const savedAccentColor = localStorage.getItem("accentColor");
    const savedFontFamily = localStorage.getItem("fontFamily");

    if (savedLanguageFont) {
      document.documentElement.setAttribute("data-language-font", savedLanguageFont);
    } else {
      // Set default to system if no preference is saved
      document.documentElement.setAttribute("data-language-font", "system");
    }

    if (savedFontSize) {
      document.documentElement.setAttribute("data-font-size", savedFontSize);
    }

    if (savedAccentColor) {
      document.documentElement.setAttribute("data-accent-color", savedAccentColor);
    }

    if (savedFontFamily) {
      const khmerFallback =
        'var(--font-hanuman), "Hanuman", "Khmer OS Battambang", "Khmer OS", sans-serif';
      const fontMap: Record<string, string> = {
        inter: `var(--font-inter), ${khmerFallback}`,
        system: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", ${khmerFallback}`,
        roboto: `"Roboto", ${khmerFallback}`,
        "open-sans": `"Open Sans", ${khmerFallback}`,
        poppins: `"Poppins", ${khmerFallback}`,
      };
      const fontFamily = fontMap[savedFontFamily] || fontMap.inter;
      document.documentElement.style.setProperty("--font-family", fontFamily);
      document.body.style.fontFamily = fontFamily;
    }
  }, []);

  return null;
}
