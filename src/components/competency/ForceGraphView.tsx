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
  curvature: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const STATUS_LABEL: Record<GraphNode['status'], string> = {
  completed: 'Completed',
  planned: 'Planned',
  waived: 'Waived',
  unplaced: 'Not placed',
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const hashUnit = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const disciplineCenter = (discipline: DisciplineId, width: number, height: number) => {
  const index = Math.max(0, DISCIPLINE_ORDER.indexOf(discipline));
  const angle = (index / DISCIPLINE_ORDER.length) * Math.PI * 2 - Math.PI / 2;
  const radius = Math.min(width, height) * 0.29;
  return {
    x: width / 2 + Math.cos(angle) * radius * 1.28,
    y: height / 2 + Math.sin(angle) * radius,
  };
};

export const ForceGraphView = ({ graph, timeline }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const viewRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const alphaRef = useRef(0);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const panningRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hasFittedRef = useRef(false);
  const pendingFitRef = useRef(true);
  const hoverRef = useRef<{ id: string | null; ancestors: Set<string>; descendants: Set<string> }>({
    id: null,
    ancestors: new Set(),
    descendants: new Set(),
  });
  const filterRef = useRef<DisciplineId | null>(null);
  const searchRef = useRef<Set<string>>(new Set());
  const timelineIndexRef = useRef<number | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineId | null>(null);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [zoomPct, setZoomPct] = useState(100);

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const lineage = useMemo(() => computeGraphLineage(graph), [graph]);
  const hoveredNode = hoveredId ? nodeById.get(hoveredId) ?? null : null;
  const hoveredLineage = hoveredId ? lineage.get(hoveredId) : undefined;
  const hoveredDiscipline = hoveredNode ? getDisciplineInfo(hoveredNode.discipline) : null;

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
    hoverRef.current = {
      id: hoveredId,
      ancestors: hoveredLineage?.ancestors ?? new Set<string>(),
      descendants: hoveredLineage?.descendants ?? new Set<string>(),
    };
  }, [hoveredId, hoveredLineage]);

  useEffect(() => {
    filterRef.current = activeDiscipline;
  }, [activeDiscipline]);

  useEffect(() => {
    searchRef.current = searchMatches;
  }, [searchMatches]);

  useEffect(() => {
    timelineIndexRef.current = timelineIndex;
  }, [timelineIndex]);

  /* Build/refresh the simulation whenever the graph changes, preserving the
   * positions of modules that were already on screen. */
  useEffect(() => {
    const maxWidth = sizeRef.current.width || 960;
    const maxHeight = sizeRef.current.height || 640;
    const previous = new Map(simNodesRef.current.map((node) => [node.id, node]));
    const localIndex = new Map<DisciplineId, number>();

    const nodes: SimNode[] = graph.nodes.map((node) => {
      const existing = previous.get(node.id);
      const index = localIndex.get(node.discipline) ?? 0;
      localIndex.set(node.discipline, index + 1);
      const center = disciplineCenter(node.discipline, maxWidth, maxHeight);
      const angle = index * 2.399963 + DISCIPLINE_ORDER.indexOf(node.discipline) * 0.7;
      const ring = 18 + Math.sqrt(index) * 45 + hashUnit(`${node.id}-r`) * 16;
      const x = existing?.x ?? center.x + Math.cos(angle) * ring + (hashUnit(node.id) - 0.5) * 26;
      const y = existing?.y ?? center.y + Math.sin(angle) * ring + (hashUnit(`${node.id}-y`) - 0.5) * 26;
      const radius = 16 + Math.min(16, node.degree * 2.2);
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
          curvature: (hashUnit(`${link.source}-${link.target}`) - 0.5) * 0.34,
        } satisfies SimLink;
      })
      .filter((link): link is SimLink => Boolean(link));

    simNodesRef.current = nodes;
    simLinksRef.current = links;
    alphaRef.current = 1;
    pendingFitRef.current = true;
    if (!hasFittedRef.current) pendingFitRef.current = true;
  }, [graph]);

  const positionTooltip = useCallback((clientX: number, clientY: number) => {
    const element = tooltipRef.current;
    const container = containerRef.current;
    if (!element || !container) return;
    const rect = container.getBoundingClientRect();
    const width = element.offsetWidth || 260;
    const height = element.offsetHeight || 150;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    let left = localX + 16;
    let top = localY + 16;
    if (left + width > rect.width - 10) left = localX - width - 16;
    if (top + height > rect.height - 10) top = localY - height - 16;
    element.style.transform = `translate(${Math.max(10, left)}px, ${Math.max(10, top)}px)`;
  }, []);

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
    const padding = 86;
    const bottomPadding = 108;
    const boxWidth = Math.max(1, maxX - minX);
    const boxHeight = Math.max(1, maxY - minY);
    const scale = clamp(
      Math.min((width - padding * 2) / boxWidth, (height - padding - bottomPadding) / boxHeight),
      0.2,
      1.45,
    );
    viewRef.current = {
      scale,
      offsetX: width / 2 - ((minX + maxX) / 2) * scale,
      offsetY: (height - bottomPadding) / 2 - ((minY + maxY) / 2) * scale,
    };
    setZoomPct(Math.round(scale * 100));
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
  }, []);

  const focusFirstMatch = useCallback(() => {
    const firstCode = searchMatches.values().next().value as string | undefined;
    if (!firstCode) return;
    const node = simNodesRef.current.find((candidate) => candidate.id === firstCode);
    if (!node) return;
    const { width, height } = sizeRef.current;
    const scale = 1.35;
    viewRef.current = {
      scale,
      offsetX: width / 2 - node.x * scale,
      offsetY: (height - 80) / 2 - node.y * scale,
    };
    setZoomPct(Math.round(scale * 100));
    setHoveredId(firstCode);
  }, [searchMatches]);

  useEffect(() => {
    if (hoveredNode) positionTooltip(pointerRef.current.x, pointerRef.current.y);
  }, [hoveredNode, positionTooltip]);

  /* Main canvas lifecycle: size, input, physics and rendering. */
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
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const reach = node.radius + 7;
        if (dx * dx + dy * dy <= reach * reach) return node;
      }
      return null;
    };

    const updateHover = (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY };
      const point = toWorld(clientX, clientY);
      const node = hitTest(point.x, point.y);
      setHoveredId(node?.id ?? null);
      if (node) {
        canvas.style.cursor = draggingRef.current ? 'grabbing' : 'pointer';
        positionTooltip(clientX, clientY);
      } else {
        canvas.style.cursor = draggingRef.current ? 'grabbing' : 'grab';
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
      if (node) {
        draggingRef.current = node.id;
        dragOffsetRef.current = { x: node.x - point.x, y: node.y - point.y };
        node.vx = 0;
        node.vy = 0;
        alphaRef.current = Math.max(alphaRef.current, 0.35);
        setHoveredId(node.id);
        pointerRef.current = { x: event.clientX, y: event.clientY };
        positionTooltip(event.clientX, event.clientY);
      } else {
        panningRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          offsetX: viewRef.current.offsetX,
          offsetY: viewRef.current.offsetY,
        };
        setHoveredId(null);
      }
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingRef.current) {
        const point = toWorld(event.clientX, event.clientY);
        const node = simNodesRef.current.find((candidate) => candidate.id === draggingRef.current);
        if (node) {
          node.x = point.x + dragOffsetRef.current.x;
          node.y = point.y + dragOffsetRef.current.y;
          node.vx = 0;
          node.vy = 0;
          alphaRef.current = Math.max(alphaRef.current, 0.3);
        }
        pointerRef.current = { x: event.clientX, y: event.clientY };
        positionTooltip(event.clientX, event.clientY);
        return;
      }
      if (panningRef.current) {
        const start = panningRef.current;
        viewRef.current = {
          ...viewRef.current,
          offsetX: start.offsetX + (event.clientX - start.startX),
          offsetY: start.offsetY + (event.clientY - start.startY),
        };
        return;
      }
      updateHover(event.clientX, event.clientY);
    };

    const finishPointer = (event: PointerEvent) => {
      draggingRef.current = null;
      panningRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };

    const handlePointerLeave = () => {
      if (!draggingRef.current && !panningRef.current) setHoveredId(null);
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
      updateHover(event.clientX, event.clientY);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    const alphaForNode = (node: SimNode): number => {
      const hover = hoverRef.current;
      const filter = filterRef.current;
      const searchSet = searchRef.current;
      const timelineCutoff = timelineIndexRef.current;
      let alpha = 1;

      if (hover.id) {
        if (node.id === hover.id) alpha = 1;
        else if (hover.ancestors.has(node.id) || hover.descendants.has(node.id)) alpha = 1;
        else alpha = 0.15;
      }
      if (filter && node.discipline !== filter) alpha *= 0.12;
      if (searchSet.size > 0 && !searchSet.has(node.id)) alpha *= 0.16;
      if (timelineCutoff !== null) {
        if (node.status === 'waived') {
          /* Waived modules are pre-credit knowledge and stay visible. */
        } else if (node.semesterIndex < 0) alpha *= 0.18;
        else if (node.semesterIndex > timelineCutoff) alpha *= 0.16;
      }
      return alpha;
    };

    const isAncestorEdge = (source: SimNode, target: SimNode): boolean => {
      const hover = hoverRef.current;
      if (!hover.id) return false;
      return (
        (source.id === hover.id || hover.ancestors.has(source.id)) &&
        (target.id === hover.id || hover.ancestors.has(target.id))
      );
    };

    const isDescendantEdge = (source: SimNode, target: SimNode): boolean => {
      const hover = hoverRef.current;
      if (!hover.id) return false;
      return (
        (source.id === hover.id || hover.descendants.has(source.id)) &&
        (target.id === hover.id || hover.descendants.has(target.id))
      );
    };

    const drawArrow = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      targetRadius: number,
      color: string,
      alpha: number,
    ) => {
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const x = toX - Math.cos(angle) * (targetRadius + 3);
      const y = toY - Math.sin(angle) * (targetRadius + 3);
      const size = 5.5;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - Math.cos(angle - 0.48) * size, y - Math.sin(angle - 0.48) * size);
      context.lineTo(x - Math.cos(angle + 0.48) * size, y - Math.sin(angle + 0.48) * size);
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawEdges = () => {
      const links = simLinksRef.current;
      for (const link of links) {
        const sourceAlpha = alphaForNode(link.source);
        const targetAlpha = alphaForNode(link.target);
        let alpha = Math.min(sourceAlpha, targetAlpha);
        if (alpha < 0.015) continue;

        let color = link.kind === 'prerequisite' ? 'rgba(20, 20, 19, 0.34)' : 'rgba(20, 20, 19, 0.13)';
        let width = link.kind === 'prerequisite' ? 1.15 + link.strength * 0.45 : 0.85;
        let glow = false;

        if (hoverRef.current.id) {
          if (link.kind === 'prerequisite') {
            if (isAncestorEdge(link.source, link.target)) {
              color = '#0f766e';
              width = 2.2;
              alpha = 0.92;
              glow = true;
            } else if (isDescendantEdge(link.source, link.target)) {
              color = '#b45309';
              width = 2.2;
              alpha = 0.92;
              glow = true;
            } else {
              alpha = Math.min(alpha, 0.07);
            }
          } else {
            alpha = Math.min(alpha, 0.05);
          }
        }

        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const bend = distance * 0.16 * link.curvature;
        const controlX = (link.source.x + link.target.x) / 2 + normalX * bend;
        const controlY = (link.source.y + link.target.y) / 2 + normalY * bend;

        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = color;
        context.lineWidth = width;
        context.lineCap = 'round';
        if (link.kind === 'affinity') context.setLineDash([3.5, 5]);
        else context.setLineDash([]);
        if (glow) {
          context.shadowBlur = 11;
          context.shadowColor = color;
        }
        context.beginPath();
        context.moveTo(link.source.x, link.source.y);
        context.quadraticCurveTo(controlX, controlY, link.target.x, link.target.y);
        context.stroke();
        context.restore();

        if (link.kind === 'prerequisite' && alpha > 0.16 && !glow) {
          drawArrow(controlX, controlY, link.target.x, link.target.y, link.target.radius, color, alpha);
        } else if (link.kind === 'prerequisite' && glow) {
          drawArrow(controlX, controlY, link.target.x, link.target.y, link.target.radius, color, 0.95);
        }
      }
    };

    const fitText = (code: string, radius: number): number => {
      let size = clamp(radius * 0.52, 7.5, 12.5);
      context.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      while (context.measureText(code).width > radius * 1.86 && size > 6) {
        size -= 0.4;
        context.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      }
      return size;
    };

    const drawCheck = (x: number, y: number, radius: number) => {
      context.save();
      context.strokeStyle = '#efeee7';
      context.lineWidth = 1.5;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(x - radius * 0.5, y);
      context.lineTo(x - radius * 0.1, y + radius * 0.4);
      context.lineTo(x + radius * 0.55, y - radius * 0.42);
      context.stroke();
      context.restore();
    };

    const drawNode = (node: SimNode) => {
      const alpha = alphaForNode(node);
      if (alpha < 0.012) return;
      const info = DISCIPLINES[node.discipline];
      const hover = hoverRef.current;
      const isHovered = hover.id === node.id;
      const isAncestor = hover.ancestors.has(node.id);
      const isDescendant = hover.descendants.has(node.id);
      const isSearchMatch = searchRef.current.has(node.id);
      const glowColor = isHovered
        ? '#605c4e'
        : isAncestor
          ? '#0f766e'
          : isDescendant
            ? '#b45309'
            : isSearchMatch
              ? '#b45309'
              : null;

      context.save();
      context.globalAlpha = alpha;

      if (node.status === 'planned') {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 4.5, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(96, 92, 78, 0.58)';
        context.lineWidth = 1.4;
        context.stroke();
      }

      if (glowColor) {
        context.shadowBlur = isHovered ? 26 : 18;
        context.shadowColor = glowColor;
      }

      if (node.status === 'waived') {
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fillStyle = '#f6f1e6';
        context.fill();
      } else if (node.status === 'unplaced') {
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(239, 238, 231, 0.58)';
        context.fill();
      } else {
        const gradient = context.createRadialGradient(
          node.x - node.radius * 0.38,
          node.y - node.radius * 0.45,
          node.radius * 0.1,
          node.x,
          node.y,
          node.radius * 1.08,
        );
        gradient.addColorStop(0, hexToRgba('#ffffff', 0.28));
        gradient.addColorStop(0.55, hexToRgba(info.color, 0.94));
        gradient.addColorStop(1, hexToRgba(info.color, 0.82));
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();
      }

      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.strokeStyle = node.status === 'unplaced' ? 'rgba(20, 20, 19, 0.42)' : '#141413';
      context.lineWidth = 2;
      if (node.status === 'waived' || node.status === 'unplaced') context.setLineDash([4, 3]);
      else context.setLineDash([]);
      context.stroke();
      context.setLineDash([]);

      if (isHovered) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(96, 92, 78, 0.8)';
        context.lineWidth = 1.5;
        context.stroke();
      }
      if (isSearchMatch && !isHovered) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 6.5, 0, Math.PI * 2);
        context.strokeStyle = '#b45309';
        context.lineWidth = 1.8;
        context.stroke();
      }

      const textColor =
        node.status === 'waived' || node.status === 'unplaced' ? '#57534e' : '#f7f4ec';
      const fontSize = fitText(node.code, node.radius);
      context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = textColor;
      context.fillText(node.code, node.x, node.y + 0.5);

      if (node.status === 'completed') {
        const badgeX = node.x + node.radius * 0.64;
        const badgeY = node.y - node.radius * 0.64;
        context.beginPath();
        context.arc(badgeX, badgeY, 5.6, 0, Math.PI * 2);
        context.fillStyle = '#141413';
        context.fill();
        context.strokeStyle = '#efeee7';
        context.lineWidth = 1.2;
        context.stroke();
        drawCheck(badgeX, badgeY, 6);
      } else if (node.status === 'unplaced') {
        context.beginPath();
        context.arc(node.x + node.radius * 0.64, node.y - node.radius * 0.64, 3.2, 0, Math.PI * 2);
        context.fillStyle = 'rgba(20, 20, 19, 0.45)';
        context.fill();
      }

      context.restore();
    };

    const draw = () => {
      const { width, height, dpr } = sizeRef.current;
      if (width === 0 || height === 0) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const background = context.createRadialGradient(
        width * 0.32,
        height * 0.22,
        30,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.82,
      );
      background.addColorStop(0, '#f4f2ec');
      background.addColorStop(0.58, '#efeee7');
      background.addColorStop(1, '#e7e3d8');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      /* Faint parchment dot grain. */
      context.save();
      context.fillStyle = 'rgba(20, 20, 19, 0.035)';
      for (let x = 24; x < width; x += 34) {
        for (let y = 24; y < height; y += 34) {
          context.beginPath();
          context.arc(x, y, 0.7, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();

      const view = viewRef.current;
      context.save();
      context.translate(view.offsetX, view.offsetY);
      context.scale(view.scale, view.scale);
      drawEdges();
      const nodes = simNodesRef.current;
      const hovered = hoverRef.current.id;
      for (const node of nodes) {
        if (node.id !== hovered) drawNode(node);
      }
      const hoveredNodeSim = hovered ? nodes.find((node) => node.id === hovered) : null;
      if (hoveredNodeSim) drawNode(hoveredNodeSim);
      context.restore();
    };

    const step = () => {
      const nodes = simNodesRef.current;
      if (nodes.length === 0) return;
      const alpha = alphaRef.current;
      if (alpha <= 0.002) return;
      const { width, height } = sizeRef.current;
      const centerX = width / 2;
      const centerY = (height - 90) / 2;

      /* Coulomb repulsion. */
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSq = dx * dx + dy * dy + 0.01;
          const distance = Math.sqrt(distanceSq);
          const force = (1850 * alpha) / (distanceSq + 260);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      /* Hooke springs along prerequisites and affinity links. */
      for (const link of simLinksRef.current) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const restLength = link.kind === 'prerequisite' ? 112 : 168;
        const stiffness = link.kind === 'prerequisite' ? 0.02 : 0.0055;
        const force = (distance - restLength) * stiffness * alpha;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        link.source.vx += fx;
        link.source.vy += fy;
        link.target.vx -= fx;
        link.target.vy -= fy;
      }

      const maxSpeed = 11;
      for (const node of nodes) {
        if (node.id === draggingRef.current) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx += (centerX - node.x) * 0.0017 * alpha;
        node.vy += (centerY - node.y) * 0.0017 * alpha;
        node.vx *= 0.87;
        node.vy *= 0.87;
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
    };

    const tick = () => {
      if (!mounted) return;
      step();
      draw();
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
  }, [fitView, positionTooltip]);

  const clearFilters = () => {
    setSearch('');
    setActiveDiscipline(null);
    setTimelineIndex(null);
    setHoveredId(null);
  };

  const hasFilters = Boolean(search.trim()) || activeDiscipline !== null || timelineIndex !== null;
  const activeTimelineLabel =
    timelineIndex === null
      ? 'All semesters'
      : timeline.find((step) => step.index === timelineIndex)?.label ?? 'All semesters';

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-3xl border border-ink/15 bg-canvas"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="img"
        aria-label={`Constellation of ${graph.nodes.length} modules connected by ${graph.links.length} prerequisite and discipline links. Drag nodes, pan the canvas, or use the timeline to watch your degree grow.`}
      />

      {/* Top toolbar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-2xl border border-ink/10 bg-[#f8f5ee]/90 p-2 shadow-soft backdrop-blur-sm">
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
                aria-label="Search modules in the constellation"
                className="w-36 rounded-xl border border-ink/15 bg-white/60 py-1 pl-7 pr-2 text-[11px] text-ink placeholder:text-muted/80 focus:outline-none focus:ring-1 focus:ring-accent sm:w-44"
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
            <div className="ml-0.5 flex flex-wrap items-center gap-1">
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
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all"
                    style={
                      active
                        ? { backgroundColor: info.color, borderColor: info.color, color: '#f7f4ec' }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.42)',
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
                className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-white/60 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-ink/10 bg-[#f8f5ee]/90 p-1 shadow-soft backdrop-blur-sm">
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
            title="Fit the whole constellation in view"
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && hoveredDiscipline && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-0 z-30 w-[260px] rounded-2xl border border-ink/15 bg-[#fbf8f1]/95 p-3 text-ink shadow-soft backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold leading-tight">{hoveredNode.code}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted">{hoveredNode.name}</div>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: hexToRgba(hoveredDiscipline.color, 0.12),
                color: hoveredDiscipline.color,
              }}
            >
              {hoveredDiscipline.shortLabel}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-ink/10 pt-2 text-[10px]">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-muted">Credits</div>
              <div className="font-medium">{hoveredNode.mcs} MC</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-muted">Semester</div>
              <div className="font-medium">{hoveredNode.semesterLabel ?? '—'}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-muted">Status</div>
              <div className="font-medium">{STATUS_LABEL[hoveredNode.status]}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-muted">Prerequisites</div>
              <div className="font-medium">
                {hoveredNode.inDegree} required · {hoveredNode.outDegree} unlocked
              </div>
            </div>
          </div>

          {hoveredNode.focusArea && (
            <div className="mt-2 rounded-xl bg-ink/5 px-2 py-1 text-[10px] text-muted">
              Focus area: <span className="font-medium text-ink">{hoveredNode.focusArea}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 text-[9px] text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#0f766e' }} /> ancestors
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#b45309' }} /> unlocks
            </span>
          </div>
        </div>
      )}

      {/* Degree-growth timeline */}
      {timeline.length > 0 && (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-ink/10 bg-[#f8f5ee]/92 px-3 py-2 shadow-soft backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                Degree growth
              </span>
              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-medium text-canvas">
                {activeTimelineLabel}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
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
          <p className="mt-1 hidden text-[9px] text-muted sm:block">
            Hover a module to trace its prerequisites (teal) and unlocked courses (amber). Drag a node to
            pull its neighbours; scroll to zoom, drag the parchment to pan.
          </p>
        </div>
      )}
    </div>
  );
};
