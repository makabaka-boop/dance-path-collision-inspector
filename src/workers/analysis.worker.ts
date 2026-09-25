/// <reference lib="webworker" />
import { analyzeChoreography } from '../geometry/geometry';
import type { AnalysisResult, Choreography } from '../geometry/types';

/**
 * Analysis worker. Every request is tagged with a version number; the UI
 * stamps each edit with a fresh version and discards replies whose version
 * is stale, so results from pre-edit geometry can never reach the page.
 */

export interface AnalysisRequest {
  choreography: Choreography;
  version: number;
}

export interface AnalysisResponse {
  type: 'result';
  result: AnalysisResult;
  version: number;
}

self.onmessage = (ev: MessageEvent<AnalysisRequest>) => {
  const { choreography, version } = ev.data;
  const result = analyzeChoreography(choreography, version);
  const response: AnalysisResponse = { type: 'result', result, version };
  (self as DedicatedWorkerGlobalScope).postMessage(response);
};
