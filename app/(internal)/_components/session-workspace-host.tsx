'use client';

import SessionWorkspace from './session-workspace';

export default function SessionWorkspaceHost({
  hidden,
  sessionId,
}: {
  hidden: boolean;
  sessionId: string;
}) {
  return (
    <div className={hidden ? 'hidden' : 'flex min-h-0 min-w-0 flex-1 overflow-hidden'} data-session-host={sessionId}>
      <SessionWorkspace hidden={hidden} sessionId={sessionId} />
    </div>
  );
}
