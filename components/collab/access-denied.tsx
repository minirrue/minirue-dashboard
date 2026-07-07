'use client';



import Link from 'next/link';

import { CollabEmptyState } from '@/components/collab/collab-ui';



export interface CollabAccessDeniedProps {

  moduleName?: string;

  traceId?: string;

}



export default function CollabAccessDenied({ moduleName = 'This module', traceId }: CollabAccessDeniedProps) {

  return (

    <CollabEmptyState

      title={`${moduleName} is not available for your account`}

      copy="Your administrator has not enabled this capability. Contact the store team if you need access."

      traceId={traceId}

      action={

        <Link href="/collab" className="dash-btn-primary">

          Back to partner workspace

        </Link>

      }

    />

  );

}

