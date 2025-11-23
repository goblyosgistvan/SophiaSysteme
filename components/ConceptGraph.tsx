
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeType, SimulationNode, SimulationLink } from '../types';

export interface ConceptGraphHandle {
  focusNode: (nodeId: string, options?: { fitPadding?: number; targetYRatio?: number; scale?: number }) => void;
  resetZoom: () => void;
}

interface ConceptGraphProps {
  data: GraphData | null;
  onNodeClick: (node: SimulationNode) => void;
  selectedNodeId: string | null;
}

// Extend SimulationLink to support bidirectional flag
interface EnhancedLink extends SimulationLink {
    bidirectional?: boolean;
}

const ConceptGraph = forwardRef<ConceptGraphHandle, ConceptGraphProps>(({ data, onNodeClick, selectedNodeId }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  
  // Persist simulation across renders
  const simulationRef = useRef<d3.Simulation<SimulationNode, EnhancedLink> | null>(null);
  
  const renderedDataRef = useRef<GraphData | null>(null);
  // Keep track of current selection for effect hook
  const selectedNodeIdRef = useRef<string | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string, options?: { fitPadding?: number; targetYRatio?: number; scale?: number }) => {
      if (!svgRef.current || !zoomRef.current || !simulationRef.current) return;
      
      const nodes = simulationRef.current.nodes();
      const node = nodes.find(n => n.id === nodeId);
      
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        const svg = d3.select(svgRef.current);
        
        const zoomScale = options?.scale ?? 0.9;
        const effectiveWidth = dimensions.width - (options?.fitPadding || 0);
        const centerX = effectiveWidth / 2;
        const centerY = dimensions.height * (options?.targetYRatio ?? 0.5);

        const x = -node.x * zoomScale + centerX;
        const y = -node.y * zoomScale + centerY;
        
        svg.transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(zoomScale));
      }
    },
    resetZoom: () => {
       if (!svgRef.current || !zoomRef.current) return;
       const svg = d3.select(svgRef.current);
       svg.transition()
          .duration(750)
          .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }));

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- Highlight Logic Helper ---
  const highlightNode = (nodeId: string | null, nodes: any, links: any) => {
    const svg = d3.select(svgRef.current);
    if (!svg.empty() && nodeId) {
        svg.selectAll(".node").style("opacity", 0.2);
        svg.selectAll(".link").style("opacity", 0.1);
        svg.selectAll(".link-label").style("opacity", 0);

        // Find node datum
        const d = nodes.find((n: any) => n.id === nodeId);
        if (!d) return;

        // Highlight main node
        const mainNodeGroup = svg.selectAll(".node").filter((n: any) => n.id === nodeId);
        mainNodeGroup.style("opacity", 1).raise();
        mainNodeGroup.select("circle")
            .attr("stroke", "#A65D57")
            .attr("stroke-width", 3)
            .attr("r", (n: any) => getRadius(n) * 1.2);

        // Find connections
        const connectedNodeIds = new Set<string>();
        const connectedLinks: any[] = [];
        
        links.forEach((l: any) => {
            if (l.source.id === nodeId) {
                connectedNodeIds.add(l.target.id);
                connectedLinks.push(l);
            }
            if (l.target.id === nodeId) {
                connectedNodeIds.add(l.source.id);
                connectedLinks.push(l);
            }
        });

        // Highlight connected nodes
        svg.selectAll(".node").filter((n: any) => connectedNodeIds.has(n.id))
            .style("opacity", 1)
            .select("circle")
            .attr("stroke", "#C5A059")
            .attr("stroke-width", 2);

        // Highlight connected links
        svg.selectAll(".link").filter((l: any) => connectedLinks.includes(l))
            .style("opacity", 1)
            .attr("stroke", "#A65D57")
            .attr("stroke-width", 2);
            
        svg.selectAll(".link-label").filter((l: any) => connectedLinks.includes(l))
            .style("opacity", 1)
            .attr("font-weight", "bold");
    }
  };

  const resetHighlight = () => {
     const svg = d3.select(svgRef.current);
     if (!svg.empty()) {
        svg.selectAll(".node").style("opacity", 1);
        svg.selectAll(".link").style("opacity", 0.4).attr("stroke", "#B0B0B0").attr("stroke-width", 1.5);
        svg.selectAll(".link-label").style("opacity", 0.7).attr("font-weight", "normal");
        
        svg.selectAll("circle")
            .attr("stroke", "#2D2A26")
            .attr("stroke-width", 1)
            .attr("r", getRadius);
     }
  };
  
  const getRadius = (d: SimulationNode) => {
      switch (d.type) {
        case NodeType.ROOT: return 40;
        case NodeType.CATEGORY: return 30;
        case NodeType.WORK: return 18;
        default: return 14;
      }
  };

  // --- Effect to handle external selection changes ---
  useEffect(() => {
      selectedNodeIdRef.current = selectedNodeId;
      if (simulationRef.current) {
          const nodes = simulationRef.current.nodes();
          const linkSelection = d3.select(svgRef.current).selectAll(".link");
          const links = linkSelection.data();

          if (selectedNodeId) {
              highlightNode(selectedNodeId, nodes, links);
          } else {
              resetHighlight();
          }
      }
  }, [selectedNodeId]);


  // --- EFFECT: Initialize Simulation ---
  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    // Check for "Soft Update" (Content change without structural change)
    if (renderedDataRef.current && simulationRef.current) {
        const oldNodes = renderedDataRef.current.nodes;
        const newNodes = data.nodes;
        
        // Simple check: same count and same IDs
        const isStructureSame = 
            oldNodes.length === newNodes.length && 
            oldNodes.every(oldN => newNodes.some(newN => newN.id === oldN.id)) &&
            // If strictly needed, check links too, but usually node edits don't change links unless specified
            data.links.length === renderedDataRef.current.links.length;

        if (isStructureSame) {
            // Update the existing simulation nodes with new data properties
            const simNodes = simulationRef.current.nodes();
            
            simNodes.forEach(simNode => {
                const newDataNode = newNodes.find(n => n.id === simNode.id);
                if (newDataNode) {
                    // Update content properties
                    Object.assign(simNode, {
                        label: newDataNode.label,
                        type: newDataNode.type,
                        shortSummary: newDataNode.shortSummary,
                        longExplanation: newDataNode.longExplanation,
                        conceptContext: newDataNode.conceptContext,
                        // Do NOT overwrite x, y, vx, vy
                    });
                }
            });

            // Update Visuals in DOM
            const svg = d3.select(svgRef.current);
            svg.selectAll<SVGTextElement, SimulationNode>(".node text")
               .text(d => d.label.replace(/_/g, ''))
               .attr("font-style", d => d.label.includes('_') ? "italic" : "normal");

            // Update references
            renderedDataRef.current = data;
            return; // EXIT: Do not restart simulation
        }
    }

    if (renderedDataRef.current === data) return;
    renderedDataRef.current = data;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const nodes: SimulationNode[] = data.nodes.map(d => ({ ...d })) as SimulationNode[];
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Link Processing: Merge identical bidirectional links
    const rawLinks = data.links.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));
    const processedLinks: EnhancedLink[] = [];
    const processedPairs = new Set<string>();

    rawLinks.forEach(link => {
        const src = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as any).id : link.target;
        const pairId = `${src}-${tgt}`;
        const reversePairId = `${tgt}-${src}`;
        
        if (processedPairs.has(pairId)) return; // Already handled (as reverse of another)

        // Check if reverse exists AND has same label
        const reverseLink = rawLinks.find(l => {
             const lSrc = typeof l.source === 'object' ? (l.source as any).id : l.source;
             const lTgt = typeof l.target === 'object' ? (l.target as any).id : l.target;
             return lSrc === tgt && lTgt === src && l.relationLabel === link.relationLabel;
        });

        if (reverseLink) {
            // It's a bidirectional identical link
            processedLinks.push({ ...link, bidirectional: true } as EnhancedLink);
            processedPairs.add(pairId);
            processedPairs.add(reversePairId); // Mark reverse as handled
        } else {
            processedLinks.push({ ...link } as EnhancedLink);
            processedPairs.add(pairId);
        }
    });

    const links: EnhancedLink[] = processedLinks;
    
    // Check for remaining curved links (different labels)
    const remainingLinkPairs = new Set<string>();
    links.forEach(l => {
        if (l.bidirectional) return; // Straight line for bidirectional
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        remainingLinkPairs.add(`${s}-${t}`);
    });
    
    const hasReverse = (l: EnhancedLink) => {
       if (l.bidirectional) return false;
       const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
       const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
       return remainingLinkPairs.has(`${t}-${s}`);
    };
    
    const nodeColor = (d: SimulationNode) => {
      switch (d.type) {
        case NodeType.ROOT: return "#A65D57"; 
        case NodeType.CATEGORY: return "#C5A059"; 
        case NodeType.WORK: return "#6B655D"; 
        default: return "#E8E6E1"; 
      }
    };

    // --- Simulation ---
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(280))
      .force("charge", d3.forceManyBody().strength(-3500))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => getRadius(d) + 60).iterations(2))
      .alphaDecay(0.05);
    
    simulationRef.current = simulation;

    // --- Elements ---
    const g = svg.append("g");
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    // @ts-ignore
    zoomRef.current = zoom;
    svg.call(zoom);

    // Define Markers
    const defs = svg.append("defs");
    
    // Standard end marker
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 32) 
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#B0B0B0");

    // Start marker for bidirectional
    defs.append("marker")
      .attr("id", "arrowhead-start")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", -22) 
      .attr("refY", 0)
      .attr("orient", "auto-start-reverse")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#B0B0B0");

    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#B0B0B0")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .attr("class", "link")
      .attr("marker-end", "url(#arrowhead)")
      .attr("marker-start", (d) => d.bidirectional ? "url(#arrowhead-start)" : null);

    const linkLabel = g.append("g")
        .selectAll("text")
        .data(links)
        .join("text")
        .attr("dy", -4)
        .attr("text-anchor", "middle")
        .text((d) => d.relationLabel)
        .attr("font-size", "11px")
        .attr("fill", "#6B655D")
        .style("pointer-events", "none")
        .style("opacity", 0.7)
        .attr("class", "link-label");

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .attr("class", "node")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", getRadius)
      .attr("fill", nodeColor)
      .attr("stroke", "#2D2A26")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.1);

    node.append("text")
      .text(d => d.label.replace(/_/g, ''))
      .attr("dy", (d) => getRadius(d) + 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "Sabon, EB Garamond, serif") 
      .attr("font-weight", "600")
      .attr("font-style", d => d.label.includes('_') ? "italic" : "normal")
      .attr("font-size", (d) => (d.type === NodeType.ROOT || d.type === NodeType.CATEGORY) ? "22px" : "14px")
      .attr("fill", "#2D2A26")
      .attr("pointer-events", "none");

    // --- Interactions ---

    node
      .on("mouseover", function(event, d) {
        highlightNode(d.id, nodes, links);
      })
      .on("mouseout", function(event, d) {
        if (selectedNodeIdRef.current) {
            highlightNode(selectedNodeIdRef.current, nodes, links);
        } else {
            resetHighlight();
        }
      });

    node.on("click", (event, d) => {
      onNodeClick(d);
      event.stopPropagation();
    });

    simulation.on("tick", () => {
      link.attr("d", (d: any) => {
         const dx = d.target.x - d.source.x;
         const dy = d.target.y - d.source.y;
         
         // If bidirectional with same label, use straight line
         if (d.bidirectional) {
             return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
         }

         // Curved for separate reverse links
         if (hasReverse(d)) {
             const dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
         }
         
         // Default straight
         return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      });

      linkLabel
        .attr("x", (d: any) => {
            if (!d.bidirectional && hasReverse(d)) {
                 const mx = (d.source.x + d.target.x) / 2;
                 return mx;
            }
            return (d.source.x + d.target.x) / 2;
        })
        .attr("y", (d: any) => {
            if (!d.bidirectional && hasReverse(d)) {
                 const dx = d.target.x - d.source.x;
                 const dy = d.target.y - d.source.y;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 if (dist === 0) return d.source.y;
                 
                 const nx = -dy / dist;
                 const ny = dx / dist;
                 const offset = dist * 0.15; 
                 
                 return ((d.source.y + d.target.y) / 2) + ny * offset;
            }
            return (d.source.y + d.target.y) / 2;
        });
        
       linkLabel.filter((d: any) => !d.bidirectional && hasReverse(d))
        .attr("x", (d: any) => {
             const dx = d.target.x - d.source.x;
             const dy = d.target.y - d.source.y;
             const dist = Math.sqrt(dx*dx + dy*dy);
             if (dist === 0) return d.source.x;
             const nx = -dy / dist;
             const offset = dist * 0.15;
             return ((d.source.x + d.target.x) / 2) + nx * offset;
        });


      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(this).attr("cursor", "grabbing");
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      d3.select(this).attr("cursor", "pointer");
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full bg-paper relative overflow-hidden group">
      <svg 
        ref={svgRef} 
        width="100%" 
        height="100%" 
        className="w-full h-full outline-none block cursor-grab active:cursor-grabbing"
        style={{ textRendering: 'optimizeSpeed', shapeRendering: 'geometricPrecision' }}
        onClick={() => { 
        }}
      ></svg>
    </div>
  );
});

export default ConceptGraph;
