import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF 上传工具",
  description: "上传和处理 PDF 文件的工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
