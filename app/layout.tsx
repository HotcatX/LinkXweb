import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;
  const socialImage = origin ? `${origin}/og.png` : undefined;

  return {
    title: "LinkX — 连接你的留学生活",
    description: "LinkX 为纽约与新泽西学生连接拼车、二手和转租，让城市里的留学生活彼此相连。",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "LinkX — 把生活连成网络",
      description: "拼车、二手、转租，一个入口连接留学生活。",
      type: "website",
      images: socialImage ? [{ url: socialImage, width: 1536, height: 1024, alt: "LinkX 社区生活网络" }] : undefined,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: "LinkX — 把生活连成网络",
      description: "拼车、二手、转租，一个入口连接留学生活。",
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
