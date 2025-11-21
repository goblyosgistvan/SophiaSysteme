
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeType, SimulationNode, SimulationLink } from '../types';

export interface ConceptGraphHandle {
  focusNode: (nodeId: string, panelOffset?: number) => void;
  resetZoom: () => void;
}

interface ConceptGraphProps {
  data: GraphData | null;
  onNodeClick: (node: SimulationNode) => void;
}

const ConceptGraph = forwardRef<ConceptGraphHandle, ConceptGraphProps>(({ data, onNodeClick }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  
  // Persist simulation across renders
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  
  const renderedDataRef = useRef<GraphData | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string, panelOffset: number = 0) => {
      if (!svgRef.current || !zoomRef.current || !simulationRef.current) return;
      
      const nodes = simulationRef.current.nodes();
      const node = nodes.find(n => n.id === nodeId);
      
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        const svg = d3.select(svgRef.current);
        // Less aggressive zoom (1.2 instead of 1.5)
        const scale = 1.2;
        
        // Calculate effective center:
        // We want the node to be in the center of the "visible" part of the screen.
        // If panel is open on the right, visual center is shifted to the left.
        // effectiveWidth = totalWidth - panelOffset
        // center is effectiveWidth / 2
        const effectiveWidth = dimensions.width - panelOffset;
        const centerX = effectiveWidth / 2;

        const x = -node.x * scale + centerX;
        const y = -node.y * scale + dimensions.height / 2;
        
        svg.transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
          
        onNodeClick(node);
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

  // --- EFFECT: Initialize Simulation ---
  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    if (renderedDataRef.current === data) return;
    renderedDataRef.current = data;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const nodes: SimulationNode[] = data.nodes.map(d => ({ ...d })) as SimulationNode[];
    // SAFETY CHECK: Create a set of valid node IDs
    const nodeIds = new Set(nodes.map(n => n.id));
    // Only include links where both source and target exist in the nodes array
    const links: SimulationLink[] = data.links
      .filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string))
      .map(d => ({ ...d })) as SimulationLink[];

    // Detect bidirectional links to handle curves
    const linkPairs = new Set<string>();
    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      linkPairs.add(`${sourceId}-${targetId}`);
    });
    
    // Helper to check if reverse link exists
    const hasReverse = (l: any) => {
       const s = typeof l.source === 'object' ? l.source.id : l.source;
       const t = typeof l.target === 'object' ? l.target.id : l.target;
       return linkPairs.has(`${t}-${s}`);
    };
    
    // --- Configurations ---
    const nodeRadius = (d: SimulationNode) => {
      switch (d.type) {
        case NodeType.ROOT: return 40;
        case NodeType.CATEGORY: return 30;
        case NodeType.WORK: return 18;
        default: return 14;
      }
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
    // Tweak: Increased charge (repel) and distance to separate nodes and labels
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(280)) // Increased distance from 220 to 280
      .force("charge", d3.forceManyBody().strength(-3500)) // Increased repel from -2500 to -3500
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => nodeRadius(d) + 60).iterations(2))
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

    svg.append("defs").append("marker")
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

    // Use 'path' instead of 'line' to support curves
    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#B0B0B0")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .attr("class", "link")
      .attr("marker-end", "url(#arrowhead)");

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
      .attr("r", nodeRadius)
      .attr("fill", nodeColor)
      .attr("stroke", "#2D2A26")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.1);

    node.append("text")
      .text(d => d.label.replace(/_/g, ''))
      .attr("dy", (d) => nodeRadius(d) + 20)
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
        node.style("opacity", 0.2);
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0);

        const el = d3.select(this);
        el.style("opacity", 1).raise();
        
        el.select("circle")
            .attr("stroke", "#A65D57")
            .attr("stroke-width", 3)
            .attr("r", (n: any) => nodeRadius(n) * 1.2);

        const connectedNodeIds = new Set<string>();
        const connectedLinks: any[] = [];
        
        links.forEach((l: any) => {
            if (l.source.id === d.id) {
                connectedNodeIds.add(l.target.id);
                connectedLinks.push(l);
            }
            if (l.target.id === d.id) {
                connectedNodeIds.add(l.source.id);
                connectedLinks.push(l);
            }
        });

        node.filter((n: any) => connectedNodeIds.has(n.id))
            .style("opacity", 1)
            .select("circle")
            .attr("stroke", "#C5A059")
            .attr("stroke-width", 2);

        link.filter((l: any) => connectedLinks.includes(l))
            .style("opacity", 1)
            .attr("stroke", "#A65D57")
            .attr("stroke-width", 2);
            
        linkLabel.filter((l: any) => connectedLinks.includes(l))
            .style("opacity", 1)
            .attr("font-weight", "bold");
      })
      .on("mouseout", function(event, d) {
        node.style("opacity", 1);
        link.style("opacity", 0.4).attr("stroke", "#B0B0B0").attr("stroke-width", 1.5);
        linkLabel.style("opacity", 0.7).attr("font-weight", "normal");
        
        d3.select(this).select("circle")
            .attr("stroke", "#2D2A26")
            .attr("stroke-width", 1)
            .attr("r", nodeRadius);
            
        node.selectAll("circle").attr("stroke", "#2D2A26").attr("stroke-width", 1);
      });

    node.on("click", (event, d) => {
      onNodeClick(d);
      event.stopPropagation();
    });

    simulation.on("tick", () => {
      link.attr("d", (d: any) => {
         const dx = d.target.x - d.source.x;
         const dy = d.target.y - d.source.y;
         const dr = Math.sqrt(dx * dx + dy * dy);
         
         // Curve if there is a reverse link, otherwise straight
         if (hasReverse(d)) {
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
         }
         return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      });

      linkLabel
        .attr("x", (d: any) => {
            if (hasReverse(d)) {
                 const mx = (d.source.x + d.target.x) / 2;
                 return mx;
            }
            return (d.source.x + d.target.x) / 2;
        })
        .attr("y", (d: any) => {
            if (hasReverse(d)) {
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
        })
        .attr("transform", (d: any) => {
             if (hasReverse(d)) {
                 return ""; 
             }
             return "";
        });
        
      // Adjust label x position for the curve offset calculated above
       linkLabel.filter((d: any) => hasReverse(d))
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
      ></svg>
      <div className="absolute bottom-4 left-4 text-[10px] text-secondary font-sans opacity-60 pointer-events-none select-none z-10">
        Nagyítás: görgő • Mozgatás: húzás
      </div>
    </div>
  );
});

export default ConceptGraph;
