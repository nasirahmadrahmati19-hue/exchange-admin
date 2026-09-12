// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./AuthProvider";
import InstallPWAButton from "./components/InstallPWAButton";
import PWAUpdateNotifier from "./components/PWAUpdateNotifier"; // ✅ خط جدید اضافه شد
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "صرافی من",
    template: "%s | صرافی من",
  },
  description: "اپلیکیشن صرافی",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "صرافی من",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "صرافی من",
    description: "اپلیکیشن صرافی",
    siteName: "صرافی من",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <InstallPWAButton />
        </AuthProvider>
        
        {/* ✅ کامپوننت اطلاع‌رسانی بروزرسانی PWA اضافه شد */}
        <PWAUpdateNotifier />
        
      </body>
    </html>
  );
}
