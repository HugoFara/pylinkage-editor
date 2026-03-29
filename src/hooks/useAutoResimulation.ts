/**
 * Auto-resimulation hook.
 *
 * Watches for mechanism structural changes that invalidate loci.
 * When loci were previously loaded and become null (due to a structural
 * edit), debounces and re-runs simulation via the REST API.
 */

import { useEffect, useRef } from 'react';
import { useMechanismStore } from '../stores/mechanismStore';
import { useEditorStore } from '../stores/editorStore';
import { simulationApi } from '../api/client';

const DEBOUNCE_MS = 500;

export function useAutoResimulation() {
  const mechanism = useMechanismStore((s) => s.mechanism);
  const loci = useMechanismStore((s) => s.loci);
  const setLoci = useMechanismStore((s) => s.setLoci);
  const activeTab = useEditorStore((s) => s.activeTab);

  const hadLoci = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether loci were previously loaded
  useEffect(() => {
    if (loci && loci.length > 0) {
      hadLoci.current = true;
    }
  }, [loci]);

  // When mechanism changes and loci got cleared, re-simulate
  useEffect(() => {
    if (activeTab !== 'design') return;
    if (!mechanism) return;
    if (loci !== null) return; // loci still valid
    if (!hadLoci.current) return; // never had loci

    // Loci were cleared by a structural edit — debounce re-simulation
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await simulationApi.simulateDirect(mechanism);
        if (result.frames && result.frames.length > 0) {
          setLoci(result.frames, result.joint_names);
        }
      } catch {
        // Simulation failed (unbuildable, etc.) — that's fine, leave loci null
        hadLoci.current = false;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mechanism, loci, activeTab, setLoci]);
}
