"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "@arco-design/web-react";

type ArcoConfigProviderProps = Readonly<{
  children: ReactNode;
}>;

export function ArcoConfigProvider({ children }: ArcoConfigProviderProps) {
  return (
    <ConfigProvider
      componentConfig={{
        Button: { size: "small", shape: "round" },
        Card: { size: "small" },
        Popconfirm: { position: "bottom" },
        Tag: { bordered: false }
      }}
    >
      {children}
    </ConfigProvider>
  );
}
