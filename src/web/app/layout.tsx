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
 * 2. Apply the data-theme attribute immediately to prevent flash
 *
 * Without this, users would see a flash of dark theme before
 * light theme applies (or vice versa) during page load.
 */
const antiFoucScript = `
(function() {
  try {
    var stored = localStorage.getItem('bush_theme');
    if (stored === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    // Dark is default, so no attribute needed for dark theme
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFoucScript }} />
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthKitProvider>
              <AuthProvider>
                <WorkspaceProvider>
                  {children}
                </WorkspaceProvider>
              </AuthProvider>
            </AuthKitProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
