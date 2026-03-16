import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArcoConfigProvider } from './arco-config-provider';

export const metadata: Metadata = {
  title: 'AI Drawio 会话',
  description: '用于 draw.io 的本地 AI 会话工作台',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body arco-theme="light">
        <ArcoConfigProvider>{children}</ArcoConfigProvider>
      </body>
    </html>
  );
}
