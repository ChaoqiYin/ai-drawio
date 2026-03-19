import { Suspense } from "react";

import SessionRouteShell from "../_components/session-route-shell";

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionRouteShell />
    </Suspense>
  );
}
