'use client';

import { useSearchParams } from 'next/navigation';

import SessionTabsShell from './session-tabs-shell';

export default function SessionRouteShell() {
  const searchParams = useSearchParams();

  return <SessionTabsShell initialSessionId={searchParams.get('id') || ''} />;
}
