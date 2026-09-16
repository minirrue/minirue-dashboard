'use client';

// THROWAWAY verification route for dashboard#55 — delete before committing.
import '../dashboard/dashboard.css';
import React, { useEffect, useState } from 'react';
import DashboardVideoViewer, { VideoLightbox } from '@/components/dashboard/DashboardVideoViewer';

const POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3F3A32"/><stop offset="1" stop-color="#B0924F"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="320" cy="180" r="70" fill="#FDFBF5" opacity=".25"/></svg>',
  );

export default function Page() {
  const [view, setView] = useState<string | null>(null);
  const [log, setLog] = useState('');
  useEffect(() => {
    setView(new URLSearchParams(window.location.search).get('view') ?? 'all');
  }, []);
  if (!view) return null;

  const section = (name: string, node: React.ReactNode) => (
    <section data-shot={name} style={{ marginBottom: 32 }}>
      <h2 style={{ font: '600 13px var(--mr-font-ui)', margin: '0 0 8px' }}>{name}</h2>
      {node}
    </section>
  );

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px', background: 'var(--mr-dash-bg)' }}>
      <p id="log">{log}</p>
      {section(
        'ready',
        <DashboardVideoViewer
          label="Spring film"
          video={{
            id: 'r1',
            url: '/zz-clip.mp4',
            posterUrl: POSTER,
            status: 'ready',
            mimeType: 'video/mp4',
            width: 640,
            height: 360,
            durationSeconds: 12,
            sizeBytes: 313823,
            convertedFrom: 'video/quicktime',
          }}
        />,
      )}
      {section(
        'converting',
        <DashboardVideoViewer
          label="Converting clip"
          video={{
            id: 'c1',
            url: 'http://localhost:8002/raw/c1.mov',
            posterUrl: POSTER,
            status: 'processing',
            mimeType: 'video/quicktime',
            width: 640,
            height: 360,
            durationSeconds: 12,
          }}
          onUpdate={(f) => setLog(`poll: ${f.status}`)}
        />,
      )}
      {section(
        'failed',
        <DashboardVideoViewer
          label="Failed clip"
          video={{
            id: 'f1',
            url: 'http://localhost:8002/raw/f1.avi',
            posterUrl: POSTER,
            status: 'failed',
            processingError: 'This video is 400 seconds long. The limit is 120 seconds — trim it and upload again.',
            mimeType: 'video/x-msvideo',
          }}
          onExchange={() => setLog('exchange clicked')}
          onDelete={() => setLog('delete clicked')}
        />,
      )}
      {section(
        'error',
        <DashboardVideoViewer
          label="Broken clip"
          video={{ id: 'e1', url: '/zz-missing.mp4', posterUrl: null, status: 'ready', mimeType: 'video/mp4' }}
        />,
      )}
      {section(
        'slow',
        <DashboardVideoViewer
          label="Slow clip"
          video={{ url: '/zz-slow.mp4', posterUrl: POSTER, status: 'ready', mimeType: 'video/mp4' }}
        />,
      )}
      {section(
        'compact',
        <div style={{ width: 200, aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden' }}>
          <DashboardVideoViewer
            label="Chosen video"
            size="compact"
            muted
            poll={false}
            video={{ url: '/zz-clip.mp4', posterUrl: POSTER, status: 'ready' }}
          />
        </div>,
      )}
      {view === 'lightbox' && (
        <VideoLightbox title="Spring film — hero cut" onClose={() => setLog('lightbox closed')}>
          <DashboardVideoViewer
            label="Spring film"
            poll={false}
            video={{ url: '/zz-clip.mp4', posterUrl: POSTER, status: 'ready', mimeType: 'video/mp4', width: 640, height: 360, sizeBytes: 313823 }}
          />
        </VideoLightbox>
      )}
    </main>
  );
}
