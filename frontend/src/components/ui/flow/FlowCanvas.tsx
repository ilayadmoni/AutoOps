import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background, BackgroundVariant, Controls, MarkerType, ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type Node, type NodeChange,
} from '@xyflow/react';
import type { NodeType, WorkflowNode } from '../../../types/api';
import StepNode, { PreflightNode, type Branch, type StepNodeData } from './StepNode';
import BranchEdge, { type BranchEdgeData } from './BranchEdge';
import { autoLayout, COL, loadPositions, savePositions, type Positions } from './layout';

const nodeTypes = { step: StepNode, preflight: PreflightNode };
const edgeTypes = { branch: BranchEdge };

export type FlowCanvasProps = {
  nodes: WorkflowNode[];
  errors?: Record<string, Record<string, string>>;
  selected?: string | null;
  /** Read-only preview: no dragging, wiring or "+" stubs. Positions always come from auto-layout. */
  readOnly?: boolean;
  /** Key under which manual drags are remembered. Omit for a canvas that should not persist. */
  storageId?: number | null;
  /** Width of a panel overlaying the trailing edge; the view is shifted so it never hides a step. */
  overlayWidth?: number;
  onSelect?: (key: string | null) => void;
  onConnect?: (source: string, branch: Branch, target: string) => void;
  onDisconnect?: (source: string, branch: Branch) => void;
  onAddAfter?: (key: string, branch: Branch, type: NodeType) => void;
  subtitleFor?: (node: WorkflowNode) => string | undefined;
};

/**
 * Keeps the view useful as the graph and the selection change. Adding or removing a step re-fits
 * the whole graph (`fitView` on <ReactFlow> only runs on first render). While an overlay panel is
 * open, the selected step is centred in the part of the canvas the panel leaves visible, at a
 * readable zoom, rather than shrinking the whole graph into that strip.
 */
function ViewController({ signature, selected, overlayWidth }: { signature: string; selected: string | null; overlayWidth: number }) {
  const flow = useReactFlow();

  const centreOnSelected = useCallback((duration: number) => {
    if (!selected || !overlayWidth) return;
    const node = flow.getNode(selected);
    if (!node) return;
    const zoom = Math.max(flow.getZoom(), 0.8);
    const w = node.measured?.width ?? 150;
    const h = node.measured?.height ?? 130;
    // The overlay sits on the interface's inline-end edge: right in LTR, left under RTL. Shift the
    // point placed at the canvas centre so the step lands in the middle of the uncovered part.
    const sign = document.documentElement.dir === 'rtl' ? -1 : 1;
    flow.setCenter(node.position.x + w / 2 + sign * (overlayWidth / 2) / zoom, node.position.y + h / 2, { zoom, duration });
  }, [flow, selected, overlayWidth]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      flow.fitView({ padding: 0.22, minZoom: 0.6, maxZoom: 1, duration: 240 }).then(() => centreOnSelected(200));
    }, 40);
    return () => window.clearTimeout(id);
    // Only a structural change re-fits; selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, flow]);

  useEffect(() => {
    const id = window.setTimeout(() => centreOnSelected(220), 60);
    return () => window.clearTimeout(id);
  }, [centreOnSelected]);

  return null;
}

function Canvas({
  nodes, errors = {}, selected = null, readOnly, storageId, overlayWidth = 0,
  onSelect, onConnect, onDisconnect, onAddAfter, subtitleFor,
}: FlowCanvasProps) {
  const persist = !readOnly && storageId !== undefined;
  const positions = useRef<Positions>(persist ? loadPositions(storageId ?? null) : {});

  // Keys that have never been placed get a slot from the auto-layout.
  useEffect(() => {
    if (readOnly) return;
    const auto = autoLayout(nodes);
    let added = false;
    for (const n of nodes) {
      if (!positions.current[n.key]) {
        positions.current[n.key] = auto[n.key] ?? { x: 0, y: 0 };
        added = true;
      }
    }
    if (added && persist) savePositions(storageId ?? null, positions.current);
  }, [nodes, readOnly, persist, storageId]);

  const flowNodes = useMemo<Node[]>(() => {
    const auto = autoLayout(nodes);
    const steps: Node[] = nodes.map((n, index) => ({
      id: n.key,
      type: 'step',
      position: (!readOnly && positions.current[n.key]) || auto[n.key] || { x: 0, y: 0 },
      selected: selected === n.key,
      draggable: !readOnly,
      connectable: !readOnly,
      data: {
        node: n,
        index,
        errorCount: Object.keys(errors[n.key] ?? {}).length,
        subtitle: subtitleFor?.(n),
        readOnly,
        onAddAfter,
      } satisfies StepNodeData,
    }));
    return [
      { id: '__preflight', type: 'preflight', position: { x: -COL, y: 0 }, data: {}, draggable: false, selectable: false, connectable: false },
      ...steps,
    ];
  }, [nodes, errors, selected, subtitleFor, readOnly, onAddAfter]);

  const flowEdges = useMemo<Edge[]>(() => {
    const marker = (color: string) => ({ type: MarkerType.ArrowClosed, width: 16, height: 16, color });
    const out: Edge[] = [];
    if (nodes.length) {
      out.push({ id: '__entry', source: '__preflight', sourceHandle: 'success', target: nodes[0].key, type: 'branch', className: 'success entry', selectable: false, markerEnd: marker('var(--edge-ok)') });
    }
    for (const n of nodes) {
      const branch = (b: Branch, target: string): Edge => ({
        id: `${n.key}-${b === 'success' ? 's' : 'f'}`,
        source: n.key,
        sourceHandle: b,
        target,
        type: 'branch',
        className: b,
        selectable: !readOnly,
        markerEnd: marker(b === 'success' ? 'var(--edge-ok)' : 'var(--edge-bad)'),
        data: { onRemove: readOnly ? undefined : () => onDisconnect?.(n.key, b) } satisfies BranchEdgeData,
      });
      if (n.successNext) out.push(branch('success', n.successNext));
      if (n.failureNext) out.push(branch('failure', n.failureNext));
    }
    return out;
  }, [nodes, readOnly, onDisconnect]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let moved = false;
    for (const c of changes) {
      if (c.type === 'position' && c.position && c.id !== '__preflight') {
        positions.current[c.id] = c.position;
        moved = true;
      }
    }
    if (moved && persist) savePositions(storageId ?? null, positions.current);
  }, [persist, storageId]);

  const handleConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === '__preflight' || c.source === c.target) return;
    onConnect?.(c.source, c.sourceHandle === 'failure' ? 'failure' : 'success', c.target);
  }, [onConnect]);

  // The view re-fits when steps are added or removed, not on every field edit.
  const signature = nodes.map((n) => n.key).join('|');

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={readOnly ? undefined : onNodesChange}
      onConnect={readOnly ? undefined : handleConnect}
      onEdgeDoubleClick={readOnly ? undefined : (_, e) => {
        if (e.id === '__entry') return;
        onDisconnect?.(e.source, e.id.endsWith('-f') ? 'failure' : 'success');
      }}
      onNodeClick={(_, n) => n.id !== '__preflight' && onSelect?.(n.id)}
      onPaneClick={() => onSelect?.(null)}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable
      fitView
      fitViewOptions={{ padding: 0.22, minZoom: 0.6, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={null}
      connectionLineStyle={{ stroke: 'var(--primary)', strokeWidth: 2 }}
    >
      <ViewController signature={signature} selected={selected} overlayWidth={overlayWidth} />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--canvas-dot)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

/**
 * The workflow canvas shared by the builder and the assistant's live preview. Graph edges ARE the
 * workflow's successNext/failureNext fields, so wiring a connection edits the model directly
 * instead of keeping a second copy of the topology. Always laid out left to right (`dir="ltr"`):
 * columns read as execution order, which does not mirror with the interface language.
 */
export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <div className="flowCanvas" dir="ltr">
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
