/**
 * Workflow canvas primitives. Kept out of `components/ui/index` on purpose: React Flow is heavy, and
 * only the pages that draw a graph should pull it into their chunk.
 */
export { default as FlowCanvas } from './FlowCanvas';
export type { FlowCanvasProps } from './FlowCanvas';
export { STEP_ICON, STEP_TYPES, type Branch } from './StepNode';
export { autoLayout } from './layout';
