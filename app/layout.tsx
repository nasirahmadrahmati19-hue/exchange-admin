// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "صرافی من",
    template: "%s | صرافی من",
  },
  description: "اپلیکیشن صرافی",
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
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // تنظیمات استاندارد برای نمایش به عنوان وب‌اپلیکیشن در موبایل (بدون نیاز به manifest)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "صرافی من",
  },
  other: {
    "mobile-web-app-capable": "yes",
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
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
