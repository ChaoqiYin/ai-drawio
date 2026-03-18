'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@arco-design/web-react';

export type InternalBreadcrumbRoute = {
  path: string;
  breadcrumbName: string;
};

type InternalBreadcrumbProps = {
  routes: InternalBreadcrumbRoute[];
  dataLayout?: string;
};

export function InternalBreadcrumb({
  routes,
  dataLayout,
}: InternalBreadcrumbProps): ReactNode {
  const router = useRouter();

  const renderBreadcrumbItem = (route: InternalBreadcrumbRoute, routes: InternalBreadcrumbRoute[]): ReactNode => {
    const isLastRoute = routes.indexOf(route) === routes.length - 1;

    if (isLastRoute) {
      return <span>{route.breadcrumbName}</span>;
    }

    return (
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-inherit"
        onClick={() => {
          router.push(route.path);
        }}
      >
        {route.breadcrumbName}
      </button>
    );
  };

  return (
    <Breadcrumb
      data-layout={dataLayout ?? 'workspace-breadcrumb'}
      routes={routes}
      itemRender={renderBreadcrumbItem}
    />
  );
}
