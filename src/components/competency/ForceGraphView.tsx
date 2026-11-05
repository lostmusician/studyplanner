import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompetencyGraph, DisciplineId, GraphNode, SemesterTimelineStep } from './competencyTypes';
import {
  DISCIPLINES,
  DISCIPLINE_ORDER,
  computeGraphLineage,
  getDisciplineInfo,
  hexToRgba,
} from './competencyData';

interface Props {
  graph: CompetencyGraph;
  timeline: SemesterTimelineStep[];
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
  kind: 'prerequisite' | 'affinity';
  strength: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface Pt {
  x: number;
  y: number;
}

const STATUS_LABEL: Record<GraphNode['status'], string> = {
  completed: 'Completed',
  planned: 'Planned',
  waived: 'Waived',
  unplaced: 'Not placed',
};

const DEFAULT_SPREAD = 2.5;
const DEFAULT_GRAVITY = 0.7;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

const hashUnit = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const disciplineCenter = (discipline: DisciplineId, width: number, height: number, spread = 1): Pt => {
  const index = Math.max(0, DISCIPLINE_ORDER.indexOf(discipline));
  const angle = (index / DISCIPLINE_ORDER.length) * Math.PI * 2 - Math.PI / 2;
  const radius = Math.min(width, height) * 0.3 * Math.sqrt(spread);
  return {
    x: width / 2 + Math.cos(angle) * radius * 1.25,
    y: height / 2 + Math.sin(angle) * radius * 0.95,
  };
};

/* Monotone chain 2D convex hull for cluster regions */
const computeConvexHull = (points: Pt[]): Pt[] => {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Pt[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Pt[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
};

export const ForceGraphView = ({ graph, timeline }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const viewRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const alphaRef = useRef(0);
  const dirtyRef = useRef(true);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const panningRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hasFittedRef = useRef(false);
  const pendingFitRef = useRef(true);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineId | null>(null);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  const [spread, setSpread] = useState(DEFAULT_SPREAD);
  const [gravity, setGravity] = useState(DEFAULT_GRAVITY);
  const [showPhysicsMenu, setShowPhysicsMenu] = useState(false);

  const spreadRef = useRef(DEFAULT_SPREAD);
  const gravityRef = useRef(DEFAULT_GRAVITY);

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const lineage = useMemo(() => computeGraphLineage(graph), [graph]);

  // Active focal node is either selected or hovered
  const focalId = selectedId ?? hoveredId;
  const focalNode = focalId ? nodeById.get(focalId) ?? null : null;
  const focalLineage = focalId ? lineage.get(focalId) : undefined;
  const focalDiscipline = focalNode ? getDisciplineInfo(focalNode.discipline) : null;

  const focalRef = useRef<{ id: string | null; ancestors: Set<string>; descendants: Set<string> }>({
    id: null,
    ancestors: new Set(),
    descendants: new Set(),
  });

  const filterRef = useRef<DisciplineId | null>(null);
  const searchRef = useRef<Set<string>>(new Set());
  const timelineIndexRef = useRef<number | null>(null);

  const searchMatches = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return new Set<string>();
    return new Set(
      graph.nodes
        .filter(
          (node) => node.code.toUpperCase().includes(query) || node.name.toUpperCase().includes(query),
        )
        .map((node) => node.id),
    );
  }, [graph.nodes, search]);

  useEffect(() => {
    focalRef.current = {
      id: focalId,
      ancestors: focalLineage?.ancestors ?? new Set<string>(),
      descendants: focalLineage?.descendants ?? new Set<string>(),
    };
    dirtyRef.current = true;
  }, [focalId, focalLineage]);

  useEffect(() => {
    filterRef.current = activeDiscipline;
    dirtyRef.current = true;
  }, [activeDiscipline]);

  useEffect(() => {
    searchRef.current = searchMatches;
    dirtyRef.current = true;
  }, [searchMatches]);

  useEffect(() => {
    timelineIndexRef.current = timelineIndex;
    dirtyRef.current = true;
  }, [timelineIndex]);

  useEffect(() => {
    spreadRef.current = spread;
    gravityRef.current = gravity;
    alphaRef.current = Math.max(alphaRef.current, 0.45);
    dirtyRef.current = true;
  }, [spread, gravity]);

  /* Build / refresh simulation nodes and links */
  useEffect(() => {
    const maxWidth = sizeRef.current.width || 960;
    const maxHeight = sizeRef.current.height || 640;
    const previous = new Map(simNodesRef.current.map((node) => [node.id, node]));
    const localIndex = new Map<DisciplineId, number>();

    const nodes: SimNode[] = graph.nodes.map((node) => {
      const existing = previous.get(node.id);
      const index = localIndex.get(node.discipline) ?? 0;
      localIndex.set(node.discipline, index + 1);
      const center = disciplineCenter(node.discipline, maxWidth, maxHeight, DEFAULT_SPREAD);
      const angle = index * 2.399963 + DISCIPLINE_ORDER.indexOf(node.discipline) * 0.7;
      const ring = 18 + Math.sqrt(index) * 36 + hashUnit(`${node.id}-r`) * 14;
      const x = existing?.x ?? center.x + Math.cos(angle) * ring + (hashUnit(node.id) - 0.5) * 20;
      const y = existing?.y ?? center.y + Math.sin(angle) * ring + (hashUnit(`${node.id}-y`) - 0.5) * 20;
      // Small labelled node: radius 5.5px to 8.5px based on connectivity
      const radius = 5.5 + Math.min(3.5, node.degree * 0.45);
      return { ...node, x, y, vx: 0, vy: 0, radius };
    });

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const links: SimLink[] = graph.links
      .map((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return null;
        return {
          source,
          target,
          kind: link.kind,
          strength: link.strength,
        } satisfies SimLink;
      })
      .filter((link): link is SimLink => Boolean(link));

    simNodesRef.current = nodes;
    simLinksRef.current = links;
    alphaRef.current = 1;
    dirtyRef.current = true;
    if (!hasFittedRef.current) pendingFitRef.current = true;
  }, [graph]);

  const fitView = useCallback(() => {
    const nodes = simNodesRef.current;
    const { width, height } = sizeRef.current;
    if (nodes.length === 0 || width === 0 || height === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }
    const padding = 70;
    const bottomPadding = 90;
    const boxWidth = Math.max(1, maxX - minX);
    const boxHeight = Math.max(1, maxY - minY);
    const scale = clamp(
      Math.min((width - padding * 2) / boxWidth, (height - padding - bottomPadding) / boxHeight),
      0.25,
      1.4,
    );
    viewRef.current = {
      scale,
      offsetX: width / 2 - ((minX + maxX) / 2) * scale,
      offsetY: (height - bottomPadding) / 2 - ((minY + maxY) / 2) * scale,
    };
    setZoomPct(Math.round(scale * 100));
    dirtyRef.current = true;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const { width, height } = sizeRef.current;
    const view = viewRef.current;
    const nextScale = clamp(view.scale * factor, 0.2, 3);
    const centerX = width / 2;
    const centerY = height / 2;
    const ratio = nextScale / view.scale;
    viewRef.current = {
      scale: nextScale,
      offsetX: centerX - (centerX - view.offsetX) * ratio,
      offsetY: centerY - (centerY - view.offsetY) * ratio,
    };
    setZoomPct(Math.round(nextScale * 100));
    dirtyRef.current = true;
  }, []);

  const panToNode = useCallback((nodeId: string) => {
    const node = simNodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    const { width, height } = sizeRef.current;
    const scale = Math.max(viewRef.current.scale, 1.15);
    viewRef.current = {
      scale,
      offsetX: width / 2 - node.x * scale,
      offsetY: (height - 80) / 2 - node.y * scale,
    };
    setZoomPct(Math.round(scale * 100));
    setSelectedId(nodeId);
    setHoveredId(null);
    dirtyRef.current = true;
  }, []);

  const focusFirstMatch = useCallback(() => {
    const firstCode = searchMatches.values().next().value as string | undefined;
    if (firstCode) panToNode(firstCode);
  }, [searchMatches, panToNode]);

  /* Main Canvas Lifecycle: single-pass Canvas 2D, dirty-flag RAF */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    let mounted = true;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const view = viewRef.current;
      return {
        x: (screenX - view.offsetX) / view.scale,
        y: (screenY - view.offsetY) / view.scale,
        screenX,
        screenY,
      };
    };

    const hitTest = (worldX: number, worldY: number): SimNode | null => {
      const nodes = simNodesRef.current;
      // PICKING_PAD: hit-test padding around the small dot + label box below
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const reach = node.radius + 10;
        if (dx * dx + dy * dy <= reach * reach) return node;

        // Also test the label box directly below the node
        const labelHalfWidth = 26;
        const labelTop = node.y + node.radius;
        const labelBottom = labelTop + 18;
        if (Math.abs(dx) <= labelHalfWidth && worldY >= labelTop && worldY <= labelBottom) {
          return node;
        }
      }
      return null;
    };

    const updateHover = (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY };
      const point = toWorld(clientX, clientY);
      const node = hitTest(point.x, point.y);
      const nextId = node ? node.id : null;
      if (nextId !== hoveredId) {
        setHoveredId(nextId);
        dirtyRef.current = true;
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      dirtyRef.current = true;
      if (pendingFitRef.current) {
        fitView();
        pendingFitRef.current = false;
        hasFittedRef.current = true;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (draggingRef.current) return;
      const point = toWorld(event.clientX, event.clientY);
      const node = hitTest(point.x, point.y);
      canvas.setPointerCapture(event.pointerId);
      hasFittedRef.current = true;
      dragDistanceRef.current = 0;

      if (node) {
        draggingRef.current = node.id;
        dragOffsetRef.current = { x: node.x - point.x, y: node.y - point.y };
        node.vx = 0;
        node.vy = 0;
        alphaRef.current = Math.max(alphaRef.current, 0.35);
        dirtyRef.current = true;
      } else {
        panningRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          offsetX: viewRef.current.offsetX,
          offsetY: viewRef.current.offsetY,
        };
      }
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingRef.current) {
        dragDistanceRef.current += Math.hypot(event.movementX, event.movementY);
        const point = toWorld(event.clientX, event.clientY);
        const node = simNodesRef.current.find((candidate) => candidate.id === draggingRef.current);
        if (node) {
          node.x = point.x + dragOffsetRef.current.x;
          node.y = point.y + dragOffsetRef.current.y;
          node.vx = 0;
          node.vy = 0;
          alphaRef.current = Math.max(alphaRef.current, 0.3);
          dirtyRef.current = true;
        }
        return;
      }
      if (panningRef.current) {
        const start = panningRef.current;
        viewRef.current = {
          ...viewRef.current,
          offsetX: start.offsetX + (event.clientX - start.startX),
          offsetY: start.offsetY + (event.clientY - start.startY),
        };
        setZoomPct(Math.round(viewRef.current.scale * 100));
        dirtyRef.current = true;
        return;
      }
      updateHover(event.clientX, event.clientY);
    };

    const finishPointer = (event: PointerEvent) => {
      if (draggingRef.current) {
        // If pointer barely moved, treat as a node click to select!
        if (dragDistanceRef.current < 5) {
          setSelectedId((prev) => (prev === draggingRef.current ? null : draggingRef.current));
          dirtyRef.current = true;
        }
      } else if (panningRef.current && dragDistanceRef.current < 5) {
        // Click on empty canvas closes selection
        setSelectedId(null);
        dirtyRef.current = true;
      }

      draggingRef.current = null;
      panningRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };

    const handlePointerLeave = () => {
      if (!draggingRef.current && !panningRef.current) {
        setHoveredId(null);
        dirtyRef.current = true;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const view = viewRef.current;
      const worldX = (screenX - view.offsetX) / view.scale;
      const worldY = (screenY - view.offsetY) / view.scale;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const nextScale = clamp(view.scale * factor, 0.2, 3);
      viewRef.current = {
        scale: nextScale,
        offsetX: screenX - worldX * nextScale,
        offsetY: screenY - worldY * nextScale,
      };
      setZoomPct(Math.round(nextScale * 100));
      dirtyRef.current = true;
      updateHover(event.clientX, event.clientY);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    /* Node opacity determination */
    const alphaForNode = (node: SimNode): number => {
      const focal = focalRef.current;
      const filter = filterRef.current;
      const searchSet = searchRef.current;
      const timelineCutoff = timelineIndexRef.current;
      let alpha = 1;

      if (focal.id) {
        if (node.id === focal.id) alpha = 1;
        else if (focal.ancestors.has(node.id) || focal.descendants.has(node.id)) alpha = 1;
        else alpha = 0.16; // LearnHarness-style clean contrast dimming
      }
      if (filter && node.discipline !== filter) alpha *= 0.12;
      if (searchSet.size > 0 && !searchSet.has(node.id)) alpha *= 0.15;
      if (timelineCutoff !== null) {
        if (node.status === 'waived') {
          // Waived modules are prior standing, keep visible
        } else if (node.semesterIndex < 0) alpha *= 0.18;
        else if (node.semesterIndex > timelineCutoff) alpha *= 0.15;
      }
      return alpha;
    };

    const isAncestorEdge = (source: SimNode, target: SimNode): boolean => {
      const focal = focalRef.current;
      if (!focal.id) return false;
      return (
        (source.id === focal.id || focal.ancestors.has(source.id)) &&
        (target.id === focal.id || focal.ancestors.has(target.id))
      );
    };

    const isDescendantEdge = (source: SimNode, target: SimNode): boolean => {
      const focal = focalRef.current;
      if (!focal.id) return false;
      return (
        (source.id === focal.id || focal.descendants.has(source.id)) &&
        (target.id === focal.id || focal.descendants.has(target.id))
      );
    };

    /* LearnHarness arrow geometry: crisp shaft + clean head triangle */
    const drawArrowhead = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      targetRadius: number,
      color: string,
      alpha: number,
      headLength = 5.5,
    ) => {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-4) return;
      const ux = dx / dist;
      const uy = dy / dist;

      // Tip on the target circle boundary
      const tipX = toX - ux * (targetRadius + 1);
      const tipY = toY - uy * (targetRadius + 1);

      // Shaft ends at base of arrowhead
      const baseX = tipX - ux * headLength;
      const baseY = tipY - uy * headLength;

      // Arrow wings (perpendicular)
      const wingWidth = headLength * 0.42;
      const leftX = baseX - uy * wingWidth;
      const leftY = baseY + ux * wingWidth;
      const rightX = baseX + uy * wingWidth;
      const rightY = baseY - ux * wingWidth;

      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(tipX, tipY);
      context.lineTo(leftX, leftY);
      context.lineTo(rightX, rightY);
      context.closePath();
      context.fill();
      context.restore();
    };

    /* LearnHarness Layer 1: Cluster Regions (Hulls + Centroid Labels) */
    const drawClusterRegions = () => {
      const nodes = simNodesRef.current;
      const view = viewRef.current;
      // Zoom-gated cluster label opacity: visible at low zoom, fades as user zooms in past 1.05
      const clusterLabelAlpha = clamp01((1.15 - view.scale) / 0.55);

      for (const disciplineId of DISCIPLINE_ORDER) {
        const disciplineNodes = nodes.filter((n) => n.discipline === disciplineId);
        if (disciplineNodes.length === 0) continue;

        const info = DISCIPLINES[disciplineId];
        const points = disciplineNodes.map((n) => ({ x: n.x, y: n.y }));

        // Compute centroid
        let sumX = 0;
        let sumY = 0;
        for (const p of points) {
          sumX += p.x;
          sumY += p.y;
        }
        const centroidX = sumX / points.length;
        const centroidY = sumY / points.length;

        // Draw soft translucent region hull
        context.save();
        context.fillStyle = hexToRgba(info.color, 0.05);
        context.strokeStyle = hexToRgba(info.color, 0.22);
        context.lineWidth = 1 / Math.max(0.7, view.scale);
        context.setLineDash([4 / view.scale, 4 / view.scale]);

        if (points.length === 1) {
          const r = disciplineNodes[0].radius + 24;
          context.beginPath();
          context.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        } else if (points.length === 2) {
          // Pill between two nodes
          const [p1, p2] = points;
          const r = 24;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const nx = -Math.sin(angle) * r;
          const ny = Math.cos(angle) * r;
          context.beginPath();
          context.arc(p1.x, p1.y, r, angle + Math.PI / 2, angle + (Math.PI * 3) / 2);
          context.arc(p2.x, p2.y, r, angle - Math.PI / 2, angle + Math.PI / 2);
          context.closePath();
          context.fill();
          context.stroke();
        } else {
          // 3+ nodes: convex hull with padding
          const hull = computeConvexHull(points);
          if (hull.length >= 3) {
            context.beginPath();
            const padding = 24;
            for (let i = 0; i < hull.length; i += 1) {
              const curr = hull[i];
              // Offset outward from centroid
              const dx = curr.x - centroidX;
              const dy = curr.y - centroidY;
              const dist = Math.hypot(dx, dy) || 1;
              const px = curr.x + (dx / dist) * padding;
              const py = curr.y + (dy / dist) * padding;
              if (i === 0) context.moveTo(px, py);
              else context.lineTo(px, py);
            }
            context.closePath();
            context.fill();
            context.stroke();
          }
        }
        context.restore();

        // Cluster region label at centroid (prominent when zoomed out)
        if (clusterLabelAlpha > 0.02) {
          context.save();
          context.globalAlpha = clusterLabelAlpha * 0.75;
          context.font = '700 11px ui-sans-serif, system-ui, sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillStyle = info.color;
          context.letterSpacing = '0.08em';
          context.fillText(info.label.toUpperCase(), centroidX, centroidY);
          context.restore();
        }
      }
    };

    /* LearnHarness Layer 2: Directed Edges (Clean straight/subtle curved shafts, no glow) */
    const drawEdges = () => {
      const links = simLinksRef.current;
      for (const link of links) {
        const sourceAlpha = alphaForNode(link.source);
        const targetAlpha = alphaForNode(link.target);
        let alpha = Math.min(sourceAlpha, targetAlpha);
        if (alpha < 0.02) continue;

        let color = link.kind === 'prerequisite' ? 'rgba(20, 20, 19, 0.35)' : 'rgba(20, 20, 19, 0.12)';
        let width = link.kind === 'prerequisite' ? 1.2 : 0.85;
        let isHighlighted = false;

        if (focalRef.current.id) {
          if (link.kind === 'prerequisite') {
            if (isAncestorEdge(link.source, link.target)) {
              color = '#0f766e'; // Teal ancestor pathway
              width = 2.0;
              alpha = 0.95;
              isHighlighted = true;
            } else if (isDescendantEdge(link.source, link.target)) {
              color = '#b45309'; // Amber unlock pathway
              width = 2.0;
              alpha = 0.95;
              isHighlighted = true;
            } else {
              alpha = Math.min(alpha, 0.08);
            }
          } else {
            alpha = Math.min(alpha, 0.05);
          }
        }

        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;

        // Clean shaft: starts on source disc edge, ends before target arrowhead
        const ux = dx / dist;
        const uy = dy / dist;
        const startX = link.source.x + ux * (link.source.radius + 1);
        const startY = link.source.y + uy * (link.source.radius + 1);
        const headLen = isHighlighted ? 6.5 : 5.5;
        const endX = link.target.x - ux * (link.target.radius + headLen);
        const endY = link.target.y - uy * (link.target.radius + headLen);

        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = color;
        context.lineWidth = width;
        context.lineCap = 'round';
        if (link.kind === 'affinity') context.setLineDash([3, 4]);
        else context.setLineDash([]);

        // Crisp lines: NO shadowBlur / NO glow!
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        context.restore();

        if (link.kind === 'prerequisite' && alpha > 0.1) {
          drawArrowhead(startX, startY, link.target.x, link.target.y, link.target.radius, color, alpha, headLen);
        }
      }
    };

    /* LearnHarness Layer 3: Nodes (Small labelled pips, tactile borders, NOT big balls) */
    const drawNode = (node: SimNode) => {
      const alpha = alphaForNode(node);
      if (alpha < 0.015) return;
      const info = DISCIPLINES[node.discipline];
      const focal = focalRef.current;
      const isSelected = selectedId === node.id;
      const isHovered = hoveredId === node.id && !isSelected;
      const isAncestor = focal.ancestors.has(node.id);
      const isDescendant = focal.descendants.has(node.id);
      const isSearchMatch = searchRef.current.has(node.id);
      const view = viewRef.current;

      context.save();
      context.globalAlpha = alpha;

      // 1. Planned indicator: delicate outer hairline ring
      if (node.status === 'planned' && !isSelected && !isHovered) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 2.8, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(96, 92, 78, 0.45)';
        context.lineWidth = 0.85;
        context.stroke();
      }

      // 2. Node Interior Fill (Small matte disc in discipline color)
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      if (node.status === 'waived') {
        context.fillStyle = '#f7f4ec';
      } else if (node.status === 'unplaced') {
        context.fillStyle = 'rgba(239, 238, 231, 0.6)';
      } else {
        context.fillStyle = info.color;
      }
      context.fill();

      // 3. Crisp Node Border (Solid, sharp ink stroke — NO glow)
      let strokeColor = '#141413';
      let strokeWidth = 1.5;

      if (isSelected) {
        strokeColor = '#141413';
        strokeWidth = 2.2;
      } else if (isHovered) {
        strokeColor = '#141413';
        strokeWidth = 2.0;
      } else if (isAncestor) {
        strokeColor = '#0f766e';
        strokeWidth = 2.0;
      } else if (isDescendant) {
        strokeColor = '#b45309';
        strokeWidth = 2.0;
      } else if (isSearchMatch) {
        strokeColor = '#b45309';
        strokeWidth = 2.0;
      } else if (node.status === 'unplaced') {
        strokeColor = 'rgba(20, 20, 19, 0.45)';
      }

      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.strokeStyle = strokeColor;
      context.lineWidth = strokeWidth;
      if (node.status === 'waived' || node.status === 'unplaced') context.setLineDash([2.5, 2]);
      else context.setLineDash([]);
      context.stroke();
      context.setLineDash([]);

      // 4. Selection / Hover crisp double contour ring (sharp, tactile, not glowy)
      if (isSelected) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        context.strokeStyle = '#141413';
        context.lineWidth = 1.5;
        context.stroke();
      } else if (isHovered) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 3.5, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(20, 20, 19, 0.55)';
        context.lineWidth = 1.2;
        context.stroke();
      } else if (isSearchMatch) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 3.5, 0, Math.PI * 2);
        context.strokeStyle = '#b45309';
        context.lineWidth = 1.4;
        context.stroke();
      }

      // 5. Completed indicator: clean solid center core dot
      if (node.status === 'completed') {
        context.beginPath();
        context.arc(node.x, node.y, node.radius * 0.38, 0, Math.PI * 2);
        context.fillStyle = '#efeee7';
        context.fill();
      }

      // 6. Crisp Label Placed Underneath Node (Obsidian / LearnHarness small-node style)
      const labelAlphaVal = clamp01((view.scale - 0.32) / 0.28);
      if (labelAlphaVal > 0.05) {
        context.globalAlpha = alpha * labelAlphaVal;
        context.textAlign = 'center';
        context.textBaseline = 'top';

        let textColor = '#141413';
        if (isSelected) textColor = '#141413';
        else if (isAncestor) textColor = '#0f766e';
        else if (isDescendant) textColor = '#b45309';
        else if (node.status === 'waived' || node.status === 'unplaced') textColor = '#5a5956';

        const labelY = node.y + node.radius + 3.5;

        // Paper background halo stroke so text is 100% readable over intersecting edges/hulls
        context.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        context.strokeStyle = 'rgba(239, 238, 231, 0.92)';
        context.lineWidth = 3;
        context.lineJoin = 'round';
        context.strokeText(node.code, node.x, labelY);
        context.fillStyle = textColor;
        context.fillText(node.code, node.x, labelY);

        // When zoomed in or when hovered/selected, render short course title on second line
        if (view.scale >= 0.95 || isHovered || isSelected) {
          const subAlpha = isHovered || isSelected ? 1 : clamp01((view.scale - 0.95) / 0.35);
          context.globalAlpha = alpha * labelAlphaVal * subAlpha * 0.88;
          context.font = '500 8.5px ui-sans-serif, system-ui, sans-serif';
          const shortName = node.name.length > 20 ? `${node.name.slice(0, 19)}…` : node.name;
          const subY = labelY + 12;
          context.strokeStyle = 'rgba(239, 238, 231, 0.92)';
          context.lineWidth = 2.5;
          context.strokeText(shortName, node.x, subY);
          context.fillStyle = '#57534e';
          context.fillText(shortName, node.x, subY);
        }
      }

      context.restore();
    };

    /* Draw Entire Scene */
    const draw = () => {
      const { width, height, dpr } = sizeRef.current;
      if (width === 0 || height === 0) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      // Clean flat paper canvas background
      context.fillStyle = '#efeee7';
      context.fillRect(0, 0, width, height);

      // Subtle paper grid pattern
      context.save();
      context.fillStyle = 'rgba(20, 20, 19, 0.03)';
      for (let x = 20; x < width; x += 32) {
        for (let y = 20; y < height; y += 32) {
          context.fillRect(x, y, 1, 1);
        }
      }
      context.restore();

      const view = viewRef.current;
      context.save();
      context.translate(view.offsetX, view.offsetY);
      context.scale(view.scale, view.scale);

      // Layer 1: Cluster Regions (Hulls + Centroid Labels)
      drawClusterRegions();

      // Layer 2: Directed Prerequisite Edges
      drawEdges();

      // Layer 3: Nodes
      const nodes = simNodesRef.current;
      const activeFocalId = focalRef.current.id;
      for (const node of nodes) {
        if (node.id !== activeFocalId) drawNode(node);
      }
      // Draw focal node last so it sits cleanly on top
      if (activeFocalId) {
        const activeNode = nodes.find((n) => n.id === activeFocalId);
        if (activeNode) drawNode(activeNode);
      }

      context.restore();
    };

    /* Simulation step (Coulomb repulsion, Hooke springs, centering) */
    const step = () => {
      const nodes = simNodesRef.current;
      if (nodes.length === 0) return;
      const alpha = alphaRef.current;
      if (alpha <= 0.002) return;
      const { width, height } = sizeRef.current;
      const centerX = width / 2;
      const centerY = (height - 80) / 2;

      // Centering and cluster gravity
      const s = spreadRef.current;
      const g = gravityRef.current;
      for (const node of nodes) {
        if (draggingRef.current === node.id) continue;
        const center = disciplineCenter(node.discipline, width, height, s);
        node.vx += (center.x - node.x) * (0.016 * g) * alpha;
        node.vy += (center.y - node.y) * (0.016 * g) * alpha;
        node.vx += (centerX - node.x) * (0.004 * g) * alpha;
        node.vy += (centerY - node.y) * (0.004 * g) * alpha;
      }

      // Coulomb repulsion between nodes
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          const minDistance = (a.radius + b.radius + 24) * Math.sqrt(s);
          const strength = (dist < minDistance ? 980 : 420) * (s * s);
          const force = (strength / distSq) * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (draggingRef.current !== a.id) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (draggingRef.current !== b.id) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // Hooke attraction along edges
      const links = simLinksRef.current;
      for (const link of links) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = (link.kind === 'prerequisite' ? 62 : 90) * s;
        const force = (dist - targetDist) * (link.kind === 'prerequisite' ? 0.045 : 0.02) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (draggingRef.current !== link.source.id) {
          link.source.vx += fx;
          link.source.vy += fy;
        }
        if (draggingRef.current !== link.target.id) {
          link.target.vx -= fx;
          link.target.vy -= fy;
        }
      }

      // Integration and damping
      const friction = 0.86;
      const maxSpeed = 16;
      for (const node of nodes) {
        if (draggingRef.current === node.id) continue;
        node.vx *= friction;
        node.vy *= friction;
        const speed = Math.hypot(node.vx, node.vy);
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }
        node.x += node.vx;
        node.y += node.vy;
      }

      alphaRef.current = alpha * 0.985;
      if (alphaRef.current < 0.002) alphaRef.current = 0;
      dirtyRef.current = true;
    };

    /* RAF loop driven by dirty flag (Zero CPU when idle) */
    const tick = () => {
      if (!mounted) return;
      if (alphaRef.current > 0) step();
      if (dirtyRef.current) {
        draw();
        dirtyRef.current = false;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      mounted = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', finishPointer);
      canvas.removeEventListener('pointercancel', finishPointer);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [fitView, hoveredId, selectedId]);

  const clearFilters = () => {
    setSearch('');
    setActiveDiscipline(null);
    setTimelineIndex(null);
    setSelectedId(null);
    setHoveredId(null);
  };

  const hasFilters = Boolean(search.trim()) || activeDiscipline !== null || timelineIndex !== null;
  const activeTimelineLabel =
    timelineIndex === null
      ? 'All semesters'
      : timeline.find((step) => step.index === timelineIndex)?.label ?? 'All semesters';

  // Compute direct ancestors and direct unlocks for the selected/focal node
  const directPrereqs = useMemo(() => {
    if (!focalNode) return [];
    return graph.links
      .filter((l) => l.target === focalNode.id && l.kind === 'prerequisite')
      .map((l) => nodeById.get(l.source))
      .filter((n): n is GraphNode => Boolean(n));
  }, [focalNode, graph.links, nodeById]);

  const directUnlocks = useMemo(() => {
    if (!focalNode) return [];
    return graph.links
      .filter((l) => l.source === focalNode.id && l.kind === 'prerequisite')
      .map((l) => nodeById.get(l.target))
      .filter((n): n is GraphNode => Boolean(n));
  }, [focalNode, graph.links, nodeById]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-3xl border border-ink/15 bg-canvas"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="img"
        aria-label={`Graph of ${graph.nodes.length} modules connected by ${graph.links.length} prerequisite links.`}
      />

      {/* Top Search & Filter Toolbar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-2xl border border-ink/10 bg-paper/90 p-2 shadow-soft backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative flex items-center">
              <span className="pointer-events-none absolute left-2.5 text-[11px] text-muted" aria-hidden="true">
                ⌕
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') focusFirstMatch();
                  if (event.key === 'Escape') setSearch('');
                }}
                placeholder="Find a module…"
                aria-label="Search modules in the graph"
                className="w-36 rounded-xl border border-ink/15 bg-canvas py-1 pl-7 pr-2 text-[11px] text-ink placeholder:text-muted/80 focus:outline-none focus:ring-1 focus:ring-ink/30 sm:w-44"
              />
            </label>
            {searchMatches.size > 0 && (
              <button
                type="button"
                onClick={focusFirstMatch}
                className="rounded-lg bg-ink px-2 py-1 text-[10px] font-medium text-canvas transition-opacity hover:opacity-80"
              >
                {searchMatches.size} match{searchMatches.size === 1 ? '' : 'es'} · focus
              </button>
            )}
            <div className="ml-0.5 flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none sm:w-auto sm:flex-1">
              {DISCIPLINE_ORDER.map((id) => {
                const info = DISCIPLINES[id];
                const active = activeDiscipline === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveDiscipline(active ? null : id)}
                    title={info.description}
                    aria-pressed={active}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all"
                    style={
                      active
                        ? { backgroundColor: info.color, borderColor: info.color, color: '#f7f4ec' }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.45)',
                            borderColor: 'rgba(20,20,19,0.13)',
                            color: '#141413',
                          }
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: active ? '#f7f4ec' : info.color }}
                    />
                    {info.shortLabel}
                  </button>
                );
              })}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Zoom & View Controls */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-ink/10 bg-paper/90 p-1 shadow-soft backdrop-blur-sm">
          <button
            type="button"
            onClick={() => zoomBy(1.22)}
            aria-label="Zoom in"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-sm font-semibold text-ink transition-colors hover:bg-ink/10"
          >
            +
          </button>
          <span className="w-9 text-center text-[10px] font-mono text-muted">{zoomPct}%</span>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.22)}
            aria-label="Zoom out"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-sm font-semibold text-ink transition-colors hover:bg-ink/10"
          >
            −
          </button>
          <button
            type="button"
            onClick={fitView}
            className="ml-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-ink transition-colors hover:bg-ink/10"
            title="Fit all nodes in view"
          >
            Fit view
          </button>
          <div className="mx-0.5 h-3.5 w-px bg-ink/15" />
          <button
            type="button"
            onClick={() => setShowPhysicsMenu((open) => !open)}
            aria-pressed={showPhysicsMenu}
            title="Adjust node spread & cluster gravity"
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
              showPhysicsMenu || spread !== DEFAULT_SPREAD || gravity !== DEFAULT_GRAVITY
                ? 'bg-ink text-canvas font-semibold'
                : 'text-ink hover:bg-ink/10'
            }`}
          >
            <span>Spread</span>
            <span className="font-mono text-[9px] opacity-75">{spread.toFixed(1)}×</span>
          </button>
        </div>
      </div>

      {/* Physics & Spread Adjustment Popover */}
      {showPhysicsMenu && (
        <div className="pointer-events-auto absolute right-3 top-16 z-30 w-64 rounded-2xl border border-ink/15 bg-paper/95 p-3.5 text-ink shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-ink/10 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink">Physics &amp; Spread</span>
            {(spread !== DEFAULT_SPREAD || gravity !== DEFAULT_GRAVITY) && (
              <button
                type="button"
                onClick={() => {
                  setSpread(DEFAULT_SPREAD);
                  setGravity(DEFAULT_GRAVITY);
                }}
                className="text-[10px] text-muted underline hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-col gap-3 text-xs">
            <div>
              <div className="flex justify-between text-[10px] font-medium text-muted">
                <span>Node Spread (Spacing)</span>
                <span className="font-mono text-ink">{spread.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={spread}
                onChange={(e) => setSpread(Number.parseFloat(e.target.value))}
                className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/15 accent-[#605c4e]"
                aria-label="Node spread slider"
              />
              <div className="mt-0.5 flex justify-between text-[8px] text-muted/70">
                <span>Dense</span>
                <span>Default (2.5×)</span>
                <span>Spacious</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-medium text-muted">
                <span>Cluster Gravity (Pull)</span>
                <span className="font-mono text-ink">{gravity.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={gravity}
                onChange={(e) => setGravity(Number.parseFloat(e.target.value))}
                className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/15 accent-[#605c4e]"
                aria-label="Cluster gravity slider"
              />
              <div className="mt-0.5 flex justify-between text-[8px] text-muted/70">
                <span>Loose</span>
                <span>Default (0.7×)</span>
                <span>Tight</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LearnHarness-style Anchored Detail Card (When a node is selected or hovered) */}
      {focalNode && focalDiscipline && (
        <div
          className={`pointer-events-auto absolute z-30 w-72 rounded-2xl border border-ink/15 bg-paper/95 p-3.5 text-ink shadow-lg backdrop-blur-md sm:w-80 ${
            showPhysicsMenu ? 'right-3 top-[220px] sm:left-3 sm:right-auto sm:top-16' : 'right-3 top-16'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-tight">{focalNode.code}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: hexToRgba(focalDiscipline.color, 0.12),
                    color: focalDiscipline.color,
                  }}
                >
                  {focalDiscipline.shortLabel}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium leading-snug text-ink/90">{focalNode.name}</div>
            </div>
            {selectedId && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-muted hover:bg-ink/10 hover:text-ink"
                aria-label="Close detail card"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ink/10 pt-2.5 text-[11px]">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Modular Credits</div>
              <div className="font-medium text-ink">{focalNode.mcs} MC</div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Semester Placement</div>
              <div className="font-medium text-ink">{focalNode.semesterLabel ?? 'Unplaced'}</div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Degree Status</div>
              <div className="font-medium text-ink">{STATUS_LABEL[focalNode.status]}</div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Connections</div>
              <div className="font-medium text-ink">
                {directPrereqs.length} in · {directUnlocks.length} out
              </div>
            </div>
          </div>

          {focalNode.focusArea && (
            <div className="mt-2.5 rounded-xl bg-ink/5 px-2.5 py-1 text-[10px] text-muted">
              Focus area: <span className="font-medium text-ink">{focalNode.focusArea}</span>
            </div>
          )}

          {/* Direct Prerequisites List */}
          <div className="mt-3 border-t border-ink/10 pt-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#0f766e]">
              Requires ({directPrereqs.length})
            </div>
            {directPrereqs.length === 0 ? (
              <div className="mt-1 text-[10px] italic text-muted">No prerequisites required</div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {directPrereqs.map((prereq) => (
                  <button
                    key={prereq.id}
                    type="button"
                    onClick={() => panToNode(prereq.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-canvas px-2 py-0.5 font-mono text-[10px] font-semibold text-ink transition-colors hover:border-[#0f766e] hover:bg-[#0f766e]/10"
                    title={`Jump to ${prereq.code}: ${prereq.name}`}
                  >
                    <span>{prereq.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Direct Unlocks List */}
          <div className="mt-2.5 border-t border-ink/10 pt-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#b45309]">
              Unlocks ({directUnlocks.length})
            </div>
            {directUnlocks.length === 0 ? (
              <div className="mt-1 text-[10px] italic text-muted">Terminal elective / research</div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {directUnlocks.map((unlock) => (
                  <button
                    key={unlock.id}
                    type="button"
                    onClick={() => panToNode(unlock.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-canvas px-2 py-0.5 font-mono text-[10px] font-semibold text-ink transition-colors hover:border-[#b45309] hover:bg-[#b45309]/10"
                    title={`Jump to ${unlock.code}: ${unlock.name}`}
                  >
                    <span>{unlock.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Degree-Growth Semester Scrubber */}
      {timeline.length > 0 && (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-ink/10 bg-paper/95 px-3.5 py-2 shadow-soft backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                Degree growth
              </span>
              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-medium text-canvas">
                {activeTimelineLabel}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setTimelineIndex(null)}
                aria-pressed={timelineIndex === null}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  timelineIndex === null
                    ? 'bg-ink text-canvas'
                    : 'bg-white/45 text-muted hover:bg-white/75 hover:text-ink'
                }`}
              >
                All semesters
              </button>
              {timeline.map((step) => {
                const active = timelineIndex === step.index;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setTimelineIndex(step.index)}
                    aria-pressed={active}
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-ink text-canvas'
                        : 'bg-white/45 text-muted hover:bg-white/75 hover:text-ink'
                    }`}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
            <label className="flex min-w-[140px] flex-1 items-center gap-2">
              <span className="sr-only">Play through semesters</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, timeline.length - 1)}
                value={timelineIndex ?? Math.max(0, timeline.length - 1)}
                onChange={(event) => setTimelineIndex(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/15 accent-[#605c4e]"
                aria-label="Semester timeline scrubber"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
