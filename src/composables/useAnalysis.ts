import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from 'vue';
import { analyzeChoreography } from '../geometry/geometry';
import type { AnalysisResult, Choreography } from '../geometry/types';
import { isValidChoreography } from '../choreography/validation';
import AnalysisWorker from '../workers/analysis.worker.ts?worker';
import type {
  AnalysisRequest,
  AnalysisResponse,
} from '../workers/analysis.worker';

export interface AnalysisState {
  result: ShallowRef<AnalysisResult | null>
  computing: Ref<boolean>
  workerAlive: Ref<boolean>
  version: Ref<number>
  analyze: (choreography: Choreography) => void
}

/**
 * Run the exact analysis off the UI thread.
 *
 * Each call bumps a monotone version. When the worker replies we only
 * accept it if its version is still the newest one — results computed by
 * the (old) worker from pre-edit geometry are dropped. A worker that
 * crashes while starting is rebuilt once; if it cannot be built at all we
 * fall back to synchronous analysis on the main thread.
 */
export function useAnalysis(): AnalysisState {
  const result = shallowRef<AnalysisResult | null>(null);
  const computing = ref(false);
  const workerAlive = ref(false);
  const version = ref(0);

  let worker: Worker | null = null;
  let activeVersion = 0;
  let rebuildAttempted = false;

  const handleMessage = (ev: MessageEvent<AnalysisResponse>) => {
    if (ev.data.type !== 'result') return;
    if (ev.data.version !== activeVersion) {
      // Stale geometry: silently discard.
      return;
    }
    result.value = ev.data.result;
    version.value = ev.data.version;
    computing.value = false;
  };

  const startWorker = (): boolean => {
    try {
      worker = new AnalysisWorker();
      worker.onmessage = handleMessage;
      worker.onerror = () => {
        workerAlive.value = false;
        worker?.terminate();
        worker = null;
      };
      workerAlive.value = true;
      return true;
    } catch {
      worker = null;
      workerAlive.value = false;
      return false;
    }
  };

  startWorker();

  const analyze = (choreography: Choreography) => {
    const nextVersion = activeVersion + 1;
    activeVersion = nextVersion;
    version.value = nextVersion;

    if (!isValidChoreography(choreography)) {
      // Invalid edit: wipe any result belonging to older geometry.
      result.value = null;
      computing.value = false;
      return;
    }

    computing.value = true;

    if (!worker) {
      if (!rebuildAttempted) {
        rebuildAttempted = true;
        if (startWorker()) {
          // fall through and dispatch on the fresh worker
        } else {
          result.value = analyzeChoreography(choreography, nextVersion);
          version.value = nextVersion;
          computing.value = false;
          return;
        }
      } else {
        result.value = analyzeChoreography(choreography, nextVersion);
        version.value = nextVersion;
        computing.value = false;
        return;
      }
    }

    const request: AnalysisRequest = { choreography, version: nextVersion };
    worker!.postMessage(request);
  };

  onScopeDispose(() => {
    worker?.terminate();
    worker = null;
  });

  return { result, computing, workerAlive, version, analyze };
}

/** Largest waypoint time across all dancers (slider upper bound). */
export function useTimeBounds(choreography: Ref<Choreography>) {
  return computed(() => {
    let max = 0;
    for (const d of choreography.value.dancers) {
      for (const wp of d.waypoints) max = Math.max(max, wp.t);
    }
    return max;
  });
}
