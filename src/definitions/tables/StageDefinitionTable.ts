import type { StageDefinition } from '../types/StageDefinition';
import stage1Data from '../data/stage1.json';
import stage2Data from '../data/stage2.json';
import stage3Data from '../data/stage3.json';

const stage1: StageDefinition = stage1Data as StageDefinition;
const stage2: StageDefinition = stage2Data as StageDefinition;
const stage3: StageDefinition = stage3Data as StageDefinition;

export const STAGE_DEFINITIONS: StageDefinition[] = [stage1, stage2, stage3];

export function getStageByIndex(index: number): StageDefinition | undefined {
  return STAGE_DEFINITIONS[index];
}

/** @deprecated Use STAGE_DEFINITIONS instead */
export const StageDefinitionTable: StageDefinition[] = STAGE_DEFINITIONS;
