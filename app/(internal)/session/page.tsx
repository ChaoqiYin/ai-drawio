import { Suspense } from "react";

import SessionWorkspace from "../_components/session-workspace";

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionWorkspace />
    </Suspense>
  );
}
