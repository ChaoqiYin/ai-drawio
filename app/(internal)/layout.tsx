import type { ReactNode } from "react";

import InternalShellBridge from "./_components/internal-shell-bridge";

export default function InternalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <InternalShellBridge />
      {children}
    </>
  );
}
