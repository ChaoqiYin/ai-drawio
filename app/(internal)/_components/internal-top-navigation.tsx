'use client';

import type { ReactNode } from 'react';
import { Button, Card } from '@arco-design/web-react';
import { IconLeft } from '@arco-design/web-react/icon';

type InternalTopNavigationProps = {
  actions?: ReactNode;
  backLabel?: string;
  content: ReactNode;
  onBack?: () => void;
};

const topNavigationCardStyle = {
  borderRadius: 8,
  backdropFilter: 'blur(18px)',
} as const;

export function InternalTopNavigation({
  actions,
  backLabel,
  content,
  onBack,
}: InternalTopNavigationProps): ReactNode {
  const handleBack = (): void => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <Card
      className="internal-panel bg-transparent"
      style={topNavigationCardStyle}
      bodyStyle={{ padding: '8px 10px' }}
      data-layout="workspace-top-nav"
    >
      <div className="flex items-center gap-4">
        <Button type="primary" size="mini" icon={<IconLeft />} onClick={handleBack}>
          {backLabel ?? '返回'}
        </Button>
        <div className="min-w-0 flex-1" data-layout="workspace-top-nav-content">
          {content}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2" data-layout="workspace-top-nav-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
