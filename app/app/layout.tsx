import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "پنل مدیریت صرافی",
  description: "سیستم مدیریت صرافی ارز دیجیتال",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-100 text-gray-900">{children}</body>
    </html>
  );
}
