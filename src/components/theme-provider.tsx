"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

// Three explicit themes, no "system" auto-switching -- there was no theme
// toggle in this app before, so there's no existing user expectation of
// following the OS preference to preserve.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      themes={["light", "dark", "glass"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
