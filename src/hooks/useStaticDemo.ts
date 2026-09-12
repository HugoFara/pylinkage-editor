/**
 * Static demo hook.
 *
 * The app opens on the Synthesis tab, which needs a backend. When the probe
 * finds no server (the GitHub Pages build), land on the Design tab once
 * instead: it works immediately, while the in-browser backend is still
 * loading.
 */

import { useEffect, useRef } from 'react';
import { useBackendStatus } from '../api/backend';
import { useEditorStore } from '../stores/editorStore';

export function useStaticDemo() {
  const backend = useBackendStatus();
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const redirected = useRef(false);

  useEffect(() => {
    if (backend === 'checking' || backend === 'online' || redirected.current) return;
    redirected.current = true;
    setActiveTab('design');
  }, [backend, setActiveTab]);
}
