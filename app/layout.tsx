import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "صرافی برادران نورزاد — هرات",
  description: "سامانه مدیریت معاملات ارزی، حواله‌جات و تبدیل ارز",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png"
  },
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
