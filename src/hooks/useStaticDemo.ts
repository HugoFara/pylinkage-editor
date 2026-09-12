/**
 * Static demo hook.
 *
 * The app opens on the Synthesis tab, which needs the backend. When the probe
 * finds none (the GitHub Pages build), land on the Design tab once instead, so
 * the first thing a visitor sees works.
 */

import { useEffect, useRef } from 'react';
import { useBackendStatus } from '../api/backend';
import { useEditorStore } from '../stores/editorStore';

export function useStaticDemo() {
  const backend = useBackendStatus();
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const redirected = useRef(false);

  useEffect(() => {
    if (backend !== 'offline' || redirected.current) return;
    redirected.current = true;
    setActiveTab('design');
  }, [backend, setActiveTab]);
}
