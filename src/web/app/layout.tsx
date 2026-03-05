import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
// Import design system (Tailwind v4 + tokens)
import "../styles/theme.css";
// Import global styles (resets, base styles)
import "../styles/globals.css";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { AuthProvider, WorkspaceProvider } from "@/web/context";
import { ThemeProvider } from "@/web/context/theme-context";
import { ErrorBoundary } from "@/web/components/error-boundary";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export const metadata: Metadata = {
  title: "Bush - Creative Collaboration Platform",
  description: "Cloud-based creative collaboration for video, design, and marketing teams",
};

// Load Inter font - primary body font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Load JetBrains Mono - code/monospace font
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

/**
 * Anti-FOUC (Flash of Unstyled Content) Script
 *
 * This inline script runs before React hydration to:
 * 1. Read the stored theme preference from localStorage
 * 2. Toggle the .dark class immediately to prevent flash
 *
 * Without this, users would see a flash of dark theme before
 * light theme applies (or vice versa) during page load.
 */
const antiFoucScript = `
(function() {
  try {
    var stored = localStorage.getItem('bush_theme');
    if (stored === 'light') {
      // Light mode: remove dark class
      document.documentElement.classList.remove('dark');
    } else {
      // Dark mode (default): ensure dark class is present
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // localStorage access may be blocked in private browsing mode
    // or by browser settings - this is non-critical and expected
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[Theme] Could not access localStorage:', e.message);
    }
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFoucScript }} />
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            {DEMO_MODE ? (
              <AuthProvider>
                <WorkspaceProvider>{children}</WorkspaceProvider>
              </AuthProvider>
            ) : (
              <AuthKitProvider>
                <AuthProvider>
                  <WorkspaceProvider>{children}</WorkspaceProvider>
                </AuthProvider>
              </AuthKitProvider>
            )}
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
