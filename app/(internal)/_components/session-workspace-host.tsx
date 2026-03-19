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
    <div className={hidden ? 'hidden' : 'flex min-h-0 flex-1'} data-session-host={sessionId}>
      <SessionWorkspace hidden={hidden} sessionId={sessionId} />
    </div>
  );
}
