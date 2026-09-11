import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
export const metadata: Metadata = {
 title:'LinkX 极链行服务 · 一路同向，一起出发',
 description:'极链行服务，连接纽约与新泽西的同路人。在微信小程序中寻找拼车、分享空座、发现二手好物与转租信息。',
 icons:{icon:'/favicon.svg'}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="zh-CN" suppressHydrationWarning><body><Script src="/theme.js" strategy="beforeInteractive"/>{children}</body></html>;
}
