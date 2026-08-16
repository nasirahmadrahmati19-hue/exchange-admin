import type { Metadata } from "next";
import "./globals.css";
// ✅ مسیر صحیح: ./components (چون فایل داخل app است)
import SettingsDrawer from "./components/SettingsDrawer";

export const metadata: Metadata = {
  title: "صرافی برادران نورزاد",
  description: "سیستم مدیریت صرافی",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <SettingsDrawer />
        {children}
      </body>
    </html>
  );
}
