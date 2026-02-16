import type { Metadata } from "next";
import "./globals.css";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { AuthProvider, WorkspaceProvider } from "@/web/context";

export const metadata: Metadata = {
  title: "Bush - Creative Collaboration Platform",
  description: "Cloud-based creative collaboration for video, design, and marketing teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthKitProvider>
          <AuthProvider>
            <WorkspaceProvider>
              {children}
            </WorkspaceProvider>
          </AuthProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
