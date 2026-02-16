import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
