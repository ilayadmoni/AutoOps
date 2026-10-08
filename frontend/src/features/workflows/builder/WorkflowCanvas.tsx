import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useReactFlow,
  type Connection, type Edge, type Node, type NodeChange, type EdgeMouseHandler,
} from '@xyflow/react';
import type { WorkflowNode } from '../../../types/api';
import StepNode, { PreflightNode, type StepNodeData } from './StepNode';
import { autoLayout, COL, loadPositions, savePositions, type Positions } from './layout';

const nodeTypes = { step: StepNode, preflight: PreflightNode };

/** Matches `.inspector` in flow.css. The canvas pans by half of it so the edited step stays visible. */
const INSPECTOR_WIDTH = 348;

/**
 * Re-frames the canvas when the step count changes. `fitView` on <ReactFlow> only runs for the
 * first render, which would leave every step added afterwards drifting off-screen.
 */
function FitOnChange({ count, offsetRight }: { count: number; offsetRight: number }) {
  const flow = useReactFlow();
  useEffect(() => {
    const id = window.setTimeout(() => {
      // Extra padding while the drawer is open: the pan below shifts the graph left, and without
      // the slack the first step slides under the canvas edge instead of under the drawer.
      flow.fitView({ padding: offsetRight ? 0.3 : 0.2, minZoom: 0.55, maxZoom: 1, duration: 200 });
      // fitView centres on the full canvas, but the inspector covers its right edge. Pan back by
      // half the drawer so the step being edited never ends up underneath it.
      if (offsetRight) {
        window.setTimeout(() => {
          const vp = flow.getViewport();
          flow.setViewport({ ...vp, x: vp.x - offsetRight / 2 }, { duration: 200 });
        }, 220);
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [count, offsetRight, flow]);
  return null;
}

/**
 * The node canvas. Graph edges ARE the workflow's successNext/failureNext fields, so wiring a
 * connection edits the model directly rather than keeping a second copy of the topology.
 */
export default function WorkflowCanvas({ nodes, errors, selected, workflowId, onSelect, onConnect, onDisconnect, subtitleFor }: {
  nodes: WorkflowNode[];
  errors: Record<string, Record<string, string>>;
  selected: string | null;
  workflowId: number | null;
  onSelect: (key: string | null) => void;
  onConnect: (source: string, branch: 'success' | 'failure', target: string) => void;
  onDisconnect: (source: string, branch: 'success' | 'failure') => void;
  subtitleFor: (node: WorkflowNode) => string | undefined;
}) {
  const positions = useRef<Positions>(loadPositions(workflowId));

  // Keys that have never been placed get a slot from the auto-layout.
  useEffect(() => {
    const auto = autoLayout(nodes);
    let added = false;
    for (const n of nodes) {
      if (!positions.current[n.key]) {
        positions.current[n.key] = auto[n.key] ?? { x: 0, y: 0 };
        added = true;
      }
    }
    if (added) savePositions(workflowId, positions.current);
  }, [nodes, workflowId]);

  const flowNodes = useMemo<Node[]>(() => {
    const auto = autoLayout(nodes);
    const steps: Node[] = nodes.map((n, index) => ({
      id: n.key,
      type: 'step',
      position: positions.current[n.key] ?? auto[n.key] ?? { x: 0, y: 0 },
      selected: selected === n.key,
      data: {
        node: n,
        index,
        errorCount: Object.keys(errors[n.key] ?? {}).length,
        subtitle: subtitleFor(n),
      } satisfies StepNodeData,
    }));
    return [
      { id: '__preflight', type: 'preflight', position: { x: -COL, y: 0 }, data: {}, draggable: false, selectable: false },
      ...steps,
    ];
  }, [nodes, errors, selected, subtitleFor]);

  const flowEdges = useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    if (nodes.length) {
      out.push({ id: '__entry', source: '__preflight', target: nodes[0].key, className: 'success', animated: true });
    }
    for (const n of nodes) {
      if (n.successNext) {
        out.push({ id: `${n.key}-s`, source: n.key, sourceHandle: 'success', target: n.successNext, className: 'success', label: '✓' });
      }
      if (n.failureNext) {
        out.push({ id: `${n.key}-f`, source: n.key, sourceHandle: 'failure', target: n.failureNext, className: 'failure', label: '✗' });
      }
    }
    return out;
  }, [nodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let moved = false;
    for (const c of changes) {
      if (c.type === 'position' && c.position && c.id !== '__preflight') {
        positions.current[c.id] = c.position;
        moved = true;
      }
    }
    if (moved) savePositions(workflowId, positions.current);
  }, [workflowId]);

  const handleConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === '__preflight' || c.source === c.target) return;
    onConnect(c.source, c.sourceHandle === 'failure' ? 'failure' : 'success', c.target);
  }, [onConnect]);

  const handleEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => {
    if (edge.id === '__entry') return;
    const branch = edge.id.endsWith('-f') ? 'failure' : 'success';
    onDisconnect(edge.source, branch);
  }, [onDisconnect]);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={handleConnect}
      onEdgeDoubleClick={handleEdgeClick}
      onNodeClick={(_, n) => n.id !== '__preflight' && onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: 0.55, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={null}
    >
      <FitOnChange count={nodes.length} offsetRight={selected ? INSPECTOR_WIDTH : 0} />
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="transparent" nodeColor="#5d665f" style={{ width: 150, height: 96 }} />
    </ReactFlow>
  );
}
