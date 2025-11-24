
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Info, ChevronRight, ChevronLeft, X, Home, ArrowRight, Trash2, Edit2, Eye, Check, Download, Plus, Send, List, GripVertical, FileJson, FileText, Upload, MoreVertical, Folder, File, BookOpen } from 'lucide-react';
import ConceptGraph, { ConceptGraphHandle } from './components/ConceptGraph';
import DetailPanel from './components/DetailPanel';
import { fetchPhilosophyData, augmentPhilosophyData, enrichNodeData, createConnectedNode } from './services/geminiService';
import { exportJSON, exportMarkdown } from './services/exportService';
import { GraphData, PhilosophicalNode, NodeType } from './types';

interface SavedGraph {
  id: string;
  topic: string;
  date: string;
  data: GraphData;
}

const ALL_SUGGESTIONS = [
    'Sztoicizmus', 'Platón', 'Etika', 'Egzisztencializmus', 'Kategorikus imperatívusz',
    'Nietzsche', 'Arisztotelészi logika', 'Utilitarizmus', 'Fenomenológia', 'Heidegger',
    'Spinoza etikája', 'Schopenhauer', 'Metafizika', 'Episztemológia', 'Társadalmi szerződés'
];

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhilosophicalNode | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Panel state
  const [panelWidth, setPanelWidth] = useState(480);
  
  // Augment State
  const [showAugmentInput, setShowAugmentInput] = useState(false);
  const [augmentQuery, setAugmentQuery] = useState('');
  const [augmentLoading, setAugmentLoading] = useState(false);
  const augmentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Node Regeneration State
  const [isRegeneratingNode, setIsRegeneratingNode] = useState(false);
  
  // Adding specific node connection state
  const [isAddingConnection, setIsAddingConnection] = useState(false);

  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Tour State
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourPath, setTourPath] = useState<string[]>([]);
  const [tourIndex, setTourIndex] = useState(-1);
  const [showTourOutline, setShowTourOutline] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  
  const outlineScrollRef = useRef<HTMLDivElement>(null);
  const toggleOutlineBtnRef = useRef<HTMLButtonElement>(null);


  // Responsive state
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isMobile = windowWidth < 768;

  const graphRef = useRef<ConceptGraphHandle>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
      setCurrentSuggestions(shuffled.slice(0, 5));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('sophia_saved_graphs');
    if (saved) {
      try {
        setSavedGraphs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved graphs", e);
      }
    }
  }, []);

  // Click outside to close Tour Outline
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (showTourOutline && 
              outlineScrollRef.current && 
              !outlineScrollRef.current.contains(event.target as Node) &&
              toggleOutlineBtnRef.current &&
              !toggleOutlineBtnRef.current.contains(event.target as Node)) {
              setShowTourOutline(false);
          }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTourOutline]);

  // Click outside to close Export Menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (showExportMenu && !(event.target as Element).closest('.export-container')) {
              setShowExportMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Focus augment input when opened
  useEffect(() => {
      if (showAugmentInput && augmentInputRef.current) {
          augmentInputRef.current.focus();
      }
  }, [showAugmentInput]);

  const autoSaveGraph = (topic: string, graphData: GraphData) => {
    const exists = savedGraphs.some(g => g.topic.toLowerCase() === topic.toLowerCase());
    
    if (exists) {
        // Update existing if it exists (for regeneration/augmentation)
        const updated = savedGraphs.map(g => 
            g.topic.toLowerCase() === topic.toLowerCase() ? { ...g, data: graphData, date: new Date().toLocaleDateString('hu-HU') } : g
        );
        setSavedGraphs(updated);
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
    } else {
        // Create new
        const newGraph: SavedGraph = {
          id: Date.now().toString(),
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          date: new Date().toLocaleDateString('hu-HU'),
          data: graphData
        };
        const updated = [newGraph, ...savedGraphs];
        setSavedGraphs(updated);
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
    }
  };

  const deleteGraph = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
  }

  const startRenaming = (id: string, currentName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setRenamingId(id);
      setRenameValue(currentName);
  }

  const handleRename = (e: React.FormEvent) => {
      e.preventDefault();
      if (!renamingId) return;
      
      const updated = savedGraphs.map(g => g.id === renamingId ? { ...g, topic: renameValue } : g);
      setSavedGraphs(updated);
      localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
      setRenamingId(null);
  }

  const loadSavedGraph = (graph: SavedGraph) => {
    setQuery(graph.topic);
    setData(graph.data);
    setHasSearched(true);
    setSelectedNode(null);
    setError(null);
  };

  const goHome = () => {
    setData(null);
    setHasSearched(false);
    setQuery('');
    setSelectedNode(null);
    stopTour();
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 5));
  };

  const handleExportJSON = () => {
      if (!data) return;
      exportJSON(data, query);
      setShowExportMenu(false);
  }

  const handleExportMarkdown = () => {
    if (!data) return;
    exportMarkdown(data, query);
    setShowExportMenu(false);
  };

  const handleImportGraph = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
            const parsedData = JSON.parse(content);
            // Basic validation check
            if (parsedData.nodes && Array.isArray(parsedData.nodes) && parsedData.links && Array.isArray(parsedData.links)) {
                
                // Determine topic name
                const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                const topic = rootNode ? rootNode.label : file.name.replace('.json', '');

                // Save and Load
                autoSaveGraph(topic, parsedData);
                const importedGraph: SavedGraph = {
                    id: Date.now().toString(),
                    topic: topic,
                    date: new Date().toLocaleDateString('hu-HU'),
                    data: parsedData
                };
                
                loadSavedGraph(importedGraph);
                
            } else {
                alert("A fájl formátuma nem megfelelő.");
            }
        } catch (err) {
            console.error("Invalid JSON", err);
            alert("Hiba a fájl beolvasásakor.");
        }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  }

  // --- Augment Logic ---

  const handleAugment = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!augmentQuery.trim() || !data) return;

      setAugmentLoading(true);
      try {
          const newData = await augmentPhilosophyData(data, augmentQuery);
          
          // Merge Nodes
          const mergedNodes = [...data.nodes];
          newData.nodes.forEach(newNode => {
              if (!mergedNodes.some(n => n.id === newNode.id)) {
                  mergedNodes.push(newNode);
              }
          });

          // Merge Links
          const mergedLinks = [...data.links];
          newData.links.forEach(newLink => {
              const exists = mergedLinks.some(l => 
                l.source === newLink.source && l.target === newLink.target && l.relationLabel === newLink.relationLabel
              );
              if (!exists) {
                  mergedLinks.push(newLink);
              }
          });
          
          const updatedData = { nodes: mergedNodes, links: mergedLinks };
          setData(updatedData);
          autoSaveGraph(query, updatedData); // Save the augmented version
          setShowAugmentInput(false);
          setAugmentQuery('');
      } catch (err) {
          console.error(err);
      } finally {
          setAugmentLoading(false);
      }
  };

  // --- Update Node Logic (Manual Edit) ---
  const handleNodeUpdate = (updatedNode: PhilosophicalNode) => {
      if (!data) return;
      
      const updatedNodes = data.nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
      const updatedData = { ...data, nodes: updatedNodes };
      
      setData(updatedData);
      setSelectedNode(updatedNode);
      autoSaveGraph(query, updatedData);
  }

  // --- Regenerate Node Logic ---
  
  const handleRegenerateNode = async (node: PhilosophicalNode) => {
      if (!data) return;
      setIsRegeneratingNode(true);

      try {
          const enrichedFields = await enrichNodeData(node, query);
          
          // Create updated node
          const updatedNode = { ...node, ...enrichedFields };
          
          // Update Graph Data state
          const updatedNodes = data.nodes.map(n => n.id === node.id ? updatedNode : n);
          const updatedData = { ...data, nodes: updatedNodes };
          
          setData(updatedData);
          setSelectedNode(updatedNode); // Update currently viewed node
          autoSaveGraph(query, updatedData); // Save progress

      } catch (error) {
          console.error("Failed to regenerate node:", error);
      } finally {
          setIsRegeneratingNode(false);
      }
  };

  // --- Delete Node Logic ---
  const handleDeleteNode = (nodeId: string) => {
      if (!data) return;

      // Filter out node
      const updatedNodes = data.nodes.filter(n => n.id !== nodeId);

      // Filter out connected links (handle both string IDs and d3 objects if simulated)
      const updatedLinks = data.links.filter(l => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return s !== nodeId && t !== nodeId;
      });

      // Update connections arrays in remaining nodes
      // (Remove the deleted ID from other nodes' connections lists)
      const finalNodes = updatedNodes.map(n => ({
          ...n,
          connections: n.connections.filter(c => c !== nodeId)
      }));

      const updatedData = { nodes: finalNodes, links: updatedLinks };
      
      // Update Tour Path if active
      if (tourPath.includes(nodeId)) {
          const newPath = tourPath.filter(id => id !== nodeId);
          setTourPath(newPath);
          // If deleted node was current tour step, adjust index
          if (isTourActive && tourIndex >= newPath.length) {
              setTourIndex(newPath.length - 1);
          }
      }

      setData(updatedData);
      setSelectedNode(null); // Close panel
      autoSaveGraph(query, updatedData);
  };

  // --- Add Connected Node Logic ---
  const handleAddConnectedNode = async (sourceNode: PhilosophicalNode, topic: string) => {
      if (!data) return;
      setIsAddingConnection(true);

      try {
          const result = await createConnectedNode(sourceNode, topic);
          if (!result.nodes.length || !result.links.length) return;

          const newNode = result.nodes[0];
          const newLink = result.links[0];
          
          // 1. Add new node
          const updatedNodes = [...data.nodes, newNode];

          // 2. Add new link
          const updatedLinks = [...data.links, newLink];
          
          // 3. Update 'connections' arrays for Source and New node to reflect relationship in data
          // Update source node in the list
          const finalNodes = updatedNodes.map(n => {
             if (n.id === sourceNode.id) {
                 return { ...n, connections: [...n.connections, newNode.id] };
             }
             if (n.id === newNode.id) {
                 // Ensure new node knows about source
                 if (!n.connections.includes(sourceNode.id)) {
                     return { ...n, connections: [...n.connections, sourceNode.id] };
                 }
             }
             return n;
          });

          const updatedData = { nodes: finalNodes, links: updatedLinks };
          setData(updatedData);
          
          // Automatically focus on the new node? Or keep current open?
          // Let's keep current open but maybe refresh it if needed (it updates via selectedNode logic)
          // Actually, we need to update selectedNode because its connections array changed
          const updatedSourceNode = finalNodes.find(n => n.id === sourceNode.id);
          if (updatedSourceNode) {
              setSelectedNode(updatedSourceNode);
          }

          autoSaveGraph(query, updatedData);

      } catch (err) {
          console.error("Failed to add connected node", err);
      } finally {
          setIsAddingConnection(false);
      }
  };

  // --- Tour Logic (Strict Hierarchy: Root -> Category -> Children) ---

  const generateTourPath = (graph: GraphData): string[] => {
    if (!graph.nodes.length) return [];

    const nodes = graph.nodes;
    const links = graph.links;
    
    // 1. Identify Structure
    const root = nodes.find(n => n.type === NodeType.ROOT);
    const categories = nodes.filter(n => n.type === NodeType.CATEGORY);
    const others = nodes.filter(n => n.type !== NodeType.ROOT && n.type !== NodeType.CATEGORY);

    // 2. Assign 'others' (Concepts/Works) to the closest Category via BFS
    const assignments = new Map<string, string>(); // NodeID -> CategoryID
    const distances = new Map<string, number>(); // NodeID -> Distance from anchor
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const getId = (item: string | any) => typeof item === 'object' ? item.id : item;

    // Helper: Adjacency list
    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));
    links.forEach(l => {
        const s = getId(l.source);
        const t = getId(l.target);
        adj.get(s)?.push(t);
        adj.get(t)?.push(s);
    });

    // BFS initialization from all Categories simultaneously
    // queue: { id, anchorId, dist }
    const queue: { id: string, anchorId: string, dist: number }[] = [];
    const visited = new Set<string>();

    categories.forEach(c => {
        queue.push({ id: c.id, anchorId: c.id, dist: 0 });
        visited.add(c.id);
        distances.set(c.id, 0);
    });

    if (root) visited.add(root.id);

    while (queue.length > 0) {
        const { id, anchorId, dist } = queue.shift()!;
        
        // If it's a content node, assign it
        const currentNode = nodeMap.get(id);
        if (currentNode && currentNode.type !== NodeType.CATEGORY && currentNode.type !== NodeType.ROOT) {
            if (!assignments.has(id)) {
                assignments.set(id, anchorId);
                distances.set(id, dist);
            }
        }

        const neighbors = adj.get(id) || [];
        for (const nextId of neighbors) {
            if (!visited.has(nextId)) {
                visited.add(nextId);
                // Propagate the anchorId
                queue.push({ id: nextId, anchorId, dist: dist + 1 });
            }
        }
    }

    // 3. Construct the Path
    const path: string[] = [];

    // A. Root first
    if (root) path.push(root.id);

    // B. Categories and their assigned children
    categories.forEach(cat => {
        // Add Category
        path.push(cat.id);
        
        // Find children assigned to this category
        const children = others.filter(n => assignments.get(n.id) === cat.id);
        
        // Sort children:
        // 1. Distance (ASC) -> Ensures traversing topological order (A before B if A connects Category to B)
        // 2. Type (Works first)
        // 3. Label
        children.sort((a, b) => {
            const distA = distances.get(a.id) || 999;
            const distB = distances.get(b.id) || 999;
            
            if (distA !== distB) return distA - distB; // Closer nodes first
            
            if (a.type === NodeType.WORK && b.type !== NodeType.WORK) return -1;
            if (a.type !== NodeType.WORK && b.type === NodeType.WORK) return 1;
            
            return a.label.localeCompare(b.label);
        });

        children.forEach(child => path.push(child.id));
    });

    // C. Orphans (nodes reachable only from Root or isolated)
    const orphans = others.filter(n => !assignments.has(n.id));
    orphans.forEach(o => path.push(o.id));

    return path;
  };

  const startTour = () => {
    if (!data) return;
    const path = generateTourPath(data);
    setTourPath(path);
    setTourIndex(0);
    setIsTourActive(true);
    focusOnNodeById(path[0]);
  };

  const nextStep = () => {
    if (tourIndex < tourPath.length - 1) {
      const newIndex = tourIndex + 1;
      setTourIndex(newIndex);
      focusOnNodeById(tourPath[newIndex]);
    } else {
      stopTour();
    }
  };

  const prevStep = () => {
    if (tourIndex > 0) {
      const newIndex = tourIndex - 1;
      setTourIndex(newIndex);
      focusOnNodeById(tourPath[newIndex]);
    }
  };

  const stopTour = () => {
    setIsTourActive(false);
    setShowTourOutline(false);
    setTourIndex(-1);
    setSelectedNode(null); // Close panel
    graphRef.current?.resetZoom(); // Center camera
  };

  const handleTourJump = (index: number) => {
      setTourIndex(index);
      focusOnNodeById(tourPath[index]);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      // Hide ghost image slightly if desired, or set a custom one
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';

      // Auto Scroll Logic - Improved sensitivity for "scroll while dragging"
      const container = outlineScrollRef.current;
      if (container) {
          const { top, bottom } = container.getBoundingClientRect();
          const hoverY = e.clientY;
          
          // Increased threshold area for easier scrolling
          const threshold = 80; 
          
          // Speed calculation based on how close to edge
          if (hoverY < top + threshold) {
              // Closer to top = faster scroll
              const speed = Math.max(2, (threshold - (hoverY - top)) / 5);
              container.scrollTop -= speed; 
          } else if (hoverY > bottom - threshold) {
              const speed = Math.max(2, (threshold - (bottom - hoverY)) / 5);
              container.scrollTop += speed;
          }
      }

      // Visual Drop Indicator Logic
      if (draggedItemIndex === null) return;
      if (index === draggedItemIndex) {
          setDropTargetIndex(null);
          return;
      }
      
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      if (e.clientY < midY) {
          setDropTargetIndex(index); // Insert before
      } else {
          setDropTargetIndex(index + 1); // Insert after
      }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      
      if (draggedItemIndex === null || dropTargetIndex === null) return;
      if (draggedItemIndex === dropTargetIndex) {
        setDraggedItemIndex(null);
        setDropTargetIndex(null);
        return;
      }

      const newPath = [...tourPath];
      const [draggedItem] = newPath.splice(draggedItemIndex, 1);
      
      // Calculate insertion index
      let insertionIndex = dropTargetIndex;
      if (draggedItemIndex < dropTargetIndex) {
          insertionIndex -= 1;
      }
      
      newPath.splice(insertionIndex, 0, draggedItem);
      
      setTourPath(newPath);

      // Adjust active tour index to track the current node
      const currentActiveId = tourPath[tourIndex];
      const newActiveIndex = newPath.indexOf(currentActiveId);
      if (newActiveIndex !== -1) {
          setTourIndex(newActiveIndex);
      }

      setDraggedItemIndex(null);
      setDropTargetIndex(null);
  };

  const focusOnNodeById = (id: string) => {
    if (!data) return;
    const node = data.nodes.find(n => n.id === id);
    if (node) {
      setSelectedNode(node);
      if (isMobile) {
          // Mobile: Focus on the center of the top 40% (targetYRatio 0.2) with less zoom (scale 0.5)
          graphRef.current?.focusNode(id, { targetYRatio: 0.2, scale: 0.5 });
      } else {
          // Desktop: Default behavior, offset for right panel
          graphRef.current?.focusNode(id, { fitPadding: panelWidth, scale: 0.9 });
      }
    }
  };

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSelectedNode(null);
    setHasSearched(true);
    stopTour();

    try {
      const graphData = await fetchPhilosophyData(query);
      setData(graphData);
      autoSaveGraph(query, graphData); 
    } catch (err: any) {
      console.error(err);
      setError("Hiba történt a generálás során. Kérlek, próbáld újra, vagy pontosítsd a témát.");
      setHasSearched(false); 
    } finally {
      setLoading(false);
    }
  }, [query, savedGraphs]);

  const handleNodeClick = useCallback((node: any) => {
    const pNode = node as PhilosophicalNode;
    // Trigger focus with specific params when manually clicking too
    if (isMobile) {
        // Same as tour: Center in the top 40% with less zoom (scale 0.5)
        graphRef.current?.focusNode(pNode.id, { targetYRatio: 0.2, scale: 0.5 });
    } else {
        graphRef.current?.focusNode(pNode.id, { fitPadding: panelWidth, scale: 0.9 });
    }
    setSelectedNode(pNode);

    if (isTourActive) {
        const indexInPath = tourPath.indexOf(pNode.id);
        if (indexInPath !== -1) {
            setTourIndex(indexInPath);
        } else {
            // Do not stop tour if clicking around, just don't update index if not in path
            // stopTour(); 
        }
    }
  }, [isTourActive, tourPath, isMobile, panelWidth]);

  return (
    <div className="h-screen w-screen flex flex-col bg-paper text-ink overflow-hidden relative">
      
      {/* --- Floating Controls (Left) --- */}
      <div className="absolute top-4 left-6 z-50 flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 bg-ink text-paper rounded-full flex items-center justify-center font-serif text-2xl cursor-pointer shadow-md hover:scale-105 transition-transform" onClick={goHome}>
              S
          </div>
          {hasSearched && !loading && (
            <h1 className="font-serif text-xl tracking-wide hidden md:block cursor-pointer text-[#D1D1D1] hover:text-ink transition-colors" onClick={goHome}>Sophia</h1>
          )}
      </div>
      
      {/* --- Floating Controls (Right) --- */}
      <div className="absolute top-4 right-6 z-[70] flex gap-4 items-center pointer-events-auto">
        
        {data && !loading && (
            <>
                {/* Augment Bar (Expanding) */}
                <div className={`
                    flex items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${showAugmentInput 
                        ? (isMobile 
                            ? 'absolute right-0 w-[calc(100vw-3rem)] z-50 bg-white shadow-lg border border-stone-200 rounded-full pr-1' 
                            : 'w-72 bg-white shadow-md border border-stone-200 rounded-full pr-1'
                          )
                        : 'relative w-10'
                    }
                `}>
                    
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleAugment(); }}
                        className={`
                           transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center mb-0
                           ${showAugmentInput 
                               ? (isMobile ? 'flex-1 opacity-100 h-10 pl-4' : 'w-72 opacity-100 h-10 ml-5') 
                               : 'w-0 opacity-0 h-10 ml-0 overflow-hidden'
                           }
                        `}
                    >
                        <input 
                           ref={augmentInputRef}
                           type="text"
                           value={augmentQuery}
                           onChange={e => setAugmentQuery(e.target.value)}
                           placeholder={showAugmentInput && isMobile ? "Kiegészítés..." : "Mit hiányolsz a gráfról?"}
                           className="leading-none bg-transparent border-none focus:ring-0 font-serif text-ink placeholder:text-stone-400 outline-none w-full h-full text-sm m-0 p-0"
                        />
                    </form>

                    <button 
                        onClick={() => {
                            if (!showAugmentInput) {
                                setShowAugmentInput(true);
                            } else if (augmentQuery.trim()) {
                                handleAugment();
                            } else {
                                setShowAugmentInput(false);
                            }
                        }}
                        disabled={augmentLoading}
                        className={`
                            transition-colors shrink-0 flex items-center justify-center w-10 h-10 rounded-full
                            ${showAugmentInput ? 'text-ink hover:bg-stone-100' : 'text-[#D1D1D1] hover:text-ink'}
                        `}
                        title={showAugmentInput ? (augmentQuery.trim() ? "Küldés" : "Bezárás") : "Gráf kiegészítése"}
                    >
                        {augmentLoading ? (
                             <Loader2 className="w-5 h-5 animate-spin text-accent"/>
                        ) : (
                             showAugmentInput && augmentQuery.trim() ? <Send className="w-4 h-4"/> : 
                             <Plus className={`w-6 h-6 transition-transform duration-300 ${showAugmentInput ? 'rotate-45 text-secondary' : ''}`} />
                        )}
                    </button>
                </div>

                {/* Export Dropdown */}
                <div className="relative export-container">
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className={`text-[#D1D1D1] hover:text-ink transition-colors ${showExportMenu ? 'text-ink' : ''}`}
                        title="Exportálás"
                    >
                        <Download className="w-6 h-6" />
                    </button>
                    
                    {showExportMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                             <button 
                                onClick={handleExportMarkdown}
                                className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-center gap-3 transition-colors"
                             >
                                 <FileText className="w-4 h-4 text-secondary" />
                                 <span className="font-sans text-sm text-ink">Esszé (.md)</span>
                             </button>
                             <button 
                                onClick={handleExportJSON}
                                className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-center gap-3 transition-colors border-t border-stone-100"
                             >
                                 <FileJson className="w-4 h-4 text-secondary" />
                                 <span className="font-sans text-sm text-ink">Adatfájl (.json)</span>
                             </button>
                        </div>
                    )}
                </div>

                <button 
                onClick={goHome}
                className="text-[#D1D1D1] hover:text-ink transition-colors"
                title="Főoldal"
                >
                    <Home className="w-6 h-6" />
                </button>
            </>
        )}
        
        {/* Info Button */}
        <button 
        onClick={() => setShowInfo(true)}
        className="text-[#D1D1D1] hover:text-ink transition-colors"
        title="Info"
        >
            <Info className="w-6 h-6" />
        </button>
      </div>


      {/* --- Info Modal --- */}
      {showInfo && (
          <div className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
              <div 
                className="bg-paper max-w-lg w-full rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
              >
                  <div className="p-6 md:p-8 flex justify-between items-center border-b border-stone-200 bg-paper shrink-0">
                      <h2 className="text-2xl font-serif font-bold text-ink">SophiaSysteme</h2>
                      <button onClick={() => setShowInfo(false)} className="text-secondary hover:text-ink p-1">
                          <X size={24} /> 
                      </button>
                  </div>

                  <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                      <div className="space-y-4 font-serif text-lg text-ink/80 leading-relaxed">
                          <p>
                              A SophiaSysteme a görög bölcsesség (sophia) és a francia rendszer (systéme) szó összegyúrásából keletkezett. Ez egy kísérleti tanulási felület, amely gráfok segítségével igyekszik vizualizálni az összetett filozófiai rendszerek kapcsolódási pontjait és összefüggéseit.
                          </p>
                          <p>
                              A használat elég egyszerű: megadsz egy témát és a mesterséges intelligencia összeállítja neked a tartalmat. Ezután a bal egérgomb lenyomásával tudod mozgatni a térképet, a görgővel tudsz nagyítani, és a csomópontokra kattintva elolvashatod azok kifejtéseit. Az „Áttekintés” gombra kattintva, hierarchikusan, egyesével végigvezet a fogalmakon és koncepciókon.
                          </p>
                          <p>
                              A jobb felső sarokban található „+” gombbal kiegészítheted a gráfot új elemekkel, a letöltés ikonnal pedig esszé formátumban exportálhatod a tudástárat.
                          </p>
                          <p className="text-base text-secondary pt-4 font-sans">
                              0.3.4 verzió. 2025. november
                          </p>
                      </div>
                  </div>
                  
              </div>
          </div>
      )}

      {/* --- Main Content --- */}
      <main className="flex-1 relative flex flex-row overflow-hidden">
        
        {/* Landing Page */}
        {!hasSearched && !loading && (
            <div className="absolute inset-0 overflow-y-auto bg-paper z-30">
                <div className="max-w-4xl mx-auto px-6 py-28 flex flex-col items-center text-center">
                    <div className="mb-16 w-full max-w-2xl">
                        <h2 className="text-5xl md:text-7xl font-serif text-ink mb-8 font-light">
                            A filozófia <span className="text-accent italic">rendszerei</span>
                        </h2>
                        
                        <div className="w-full relative group mb-10">
                             <form onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Írj ide egy filozófiai témát, művet vagy filozófust..."
                                    className="w-full pl-14 pr-14 py-4 bg-white border border-stone-300 rounded-full text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-serif shadow-lg transition-all hover:shadow-xl placeholder:text-stone-400 text-ink"
                                    autoFocus
                                />
                                <Search className="absolute left-5 top-5 w-6 h-6 text-stone-400 group-hover:text-accent transition-colors" />
                                <button 
                                    type="submit" 
                                    disabled={!query}
                                    className="absolute right-3 top-3 p-2 bg-ink text-white rounded-full disabled:opacity-50 hover:bg-accent transition-colors shadow-md"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                             </form>
                        </div>

                        <p className="max-w-xl mx-auto text-lg text-secondary font-sans font-light leading-relaxed mb-6">
                            Rendszerszintű megértés filozófiai témákhoz. Add meg a témát vagy válassz egyet:
                        </p>
                        
                        <div className="flex flex-wrap justify-center gap-3">
                            {currentSuggestions.map((tag) => (
                                <button 
                                    key={tag}
                                    onClick={() => { setQuery(tag); handleSearch(); }}
                                    className="px-5 py-2 rounded-full border border-stone-200 bg-white text-stone-600 font-sans text-sm hover:border-accent hover:text-accent hover:bg-stone-50 transition-all shadow-sm"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full max-w-3xl text-left animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                        <div className="flex justify-between items-end mb-6 border-b border-stone-200 pb-2">
                             <h3 className="font-serif text-2xl text-ink">Előzmények</h3>
                             
                             {/* Import Button */}
                             <div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleImportGraph}
                                    accept=".json" 
                                    className="hidden" 
                                />
                                <button 
                                    onClick={triggerFileUpload}
                                    className="flex items-center gap-2 text-secondary hover:text-accent transition-colors text-sm font-sans"
                                    title="Mentett gráf importálása"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Importálás</span>
                                </button>
                             </div>
                        </div>

                        {savedGraphs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {savedGraphs.map(graph => (
                                    <div 
                                        key={graph.id}
                                        onClick={() => loadSavedGraph(graph)}
                                        className="group relative p-2 bg-white border border-stone-200 rounded-lg shadow-sm hover:shadow-md hover:border-gold transition-all cursor-pointer flex justify-between items-center h-[70px]"
                                    >
                                        <div className="flex-1 mr-2 min-w-0 flex flex-col justify-center h-full">
                                            {renamingId === graph.id ? (
                                                <form onSubmit={handleRename} onClick={e => e.stopPropagation()} className="flex items-center gap-2 w-full">
                                                    <input 
                                                        type="text" 
                                                        value={renameValue} 
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        className="flex-1 min-w-0 border-b border-accent focus:outline-none bg-transparent font-serif text-lg text-ink"
                                                        autoFocus
                                                    />
                                                    <button type="submit" className="text-accent hover:text-ink flex-shrink-0 p-1">
                                                        <Check size={16}/>
                                                    </button>
                                                </form>
                                            ) : (
                                                <div className="flex flex-col w-full">
                                                    <h4 className="font-serif text-lg text-ink group-hover:text-accent transition-colors truncate w-full leading-tight" title={graph.topic}>
                                                      {graph.topic}
                                                    </h4>
                                                    <span className="text-xs text-secondary/70 font-sans mt-0.5">{graph.date}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renamingId !== graph.id && (
                                                 <button 
                                                    onClick={(e) => startRenaming(graph.id, graph.topic, e)}
                                                    className="p-1 text-stone-400 hover:text-ink transition-colors"
                                                    title="Átnevezés"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => deleteGraph(graph.id, e)}
                                                className="p-1 text-stone-400 hover:text-red-400 transition-colors"
                                                title="Törlés"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-secondary/50 italic text-center py-8">Még nincsenek mentett gráfjaid.</p>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Loading State */}
        {loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm z-50">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="font-serif text-xl animate-pulse">Kapcsolatok létrehozása...</p>
                <p className="text-sm text-secondary mt-2 font-sans">Ez körülbelül 1-2 percet vesz igénybe.</p>
             </div>
        )}

        {/* Error State */}
        {error && (
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                 <div className="bg-white p-6 rounded-lg shadow-xl border border-red-100 max-w-md text-center pointer-events-auto">
                    <p className="text-accent font-medium mb-4">{error}</p>
                    <button 
                        onClick={() => { setError(null); setHasSearched(false); }}
                        className="px-4 py-2 bg-ink text-white rounded hover:bg-stone-700 transition-colors font-sans text-sm"
                    >
                        Vissza a főoldalra
                    </button>
                 </div>
            </div>
        )}

        {/* Persistent Floating Bottom Interaction Bar with Morphing Animation */}
        {data && !loading && (
            <>
             <div 
                className={`absolute bottom-8 transform -translate-x-1/2 z-[100] bg-white/95 backdrop-blur shadow-lg border border-stone-200 rounded-full flex items-center transition-all duration-500 ease-in-out overflow-visible ${isTourActive ? 'w-[320px] h-[52px]' : 'w-[150px] h-[44px]'}`}
                style={{
                    left: (selectedNode && windowWidth >= 768) ? `calc((100% - ${panelWidth}px) / 2)` : '50%'
                }}
             >
                 {/* Tour Outline Popup */}
                 <div 
                    ref={outlineScrollRef}
                    className={`absolute bottom-16 left-0 w-full bg-white/95 backdrop-blur shadow-2xl border border-stone-200 rounded-2xl p-2 max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1 z-[110] transition-all duration-300 origin-bottom transform ${isTourActive && showTourOutline ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-90 translate-y-4 pointer-events-none'}`}
                 >
                    {tourPath.map((nodeId, idx) => {
                        const node = data.nodes.find(n => n.id === nodeId);
                        if (!node) return null;
                        const isActive = idx === tourIndex;
                        const isBeingDragged = draggedItemIndex === idx;
                        
                        const showDropLine = dropTargetIndex === idx && !isBeingDragged;
                        const showDropLineBottom = dropTargetIndex === idx + 1 && !isBeingDragged;

                        // Indentation Level Logic
                        let paddingClass = "pl-2"; // Default (Root)
                        if (node.type === NodeType.CATEGORY) paddingClass = "pl-6";
                        if (node.type === NodeType.CONCEPT || node.type === NodeType.WORK) paddingClass = "pl-10";

                        const nodeNumber = idx + 1;

                        return (
                            <div key={`${nodeId}-${idx}`} className="relative transition-all duration-200">
                                {showDropLine && (
                                    <div className="absolute -top-1 left-0 right-0 h-0.5 bg-accent rounded-full z-10" />
                                )}
                                
                                <div 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={handleDrop}
                                    onClick={() => handleTourJump(idx)}
                                    className={`
                                        flex items-center gap-2 p-2 rounded cursor-pointer transition-colors group
                                        ${isActive ? 'bg-accent/10 text-accent' : 'hover:bg-stone-100 text-ink'}
                                        ${isBeingDragged ? 'opacity-50' : 'opacity-100'}
                                        ${paddingClass}
                                    `}
                                >
                                    {/* Number instead of Icon */}
                                    <div className="text-stone-400 font-mono text-xs w-5 text-right flex-shrink-0">
                                       {nodeNumber}.
                                    </div>

                                    {/* Reorder Grip */}
                                    <div className="cursor-grab active:cursor-grabbing p-1 text-stone-300 group-hover:text-stone-500 ml-auto order-last">
                                        <GripVertical size={12} />
                                    </div>
                                    
                                    <span className={`font-sans text-sm truncate ${isActive ? 'font-medium' : ''} ${node.type === NodeType.ROOT ? 'font-bold' : ''} ${node.type === NodeType.WORK ? 'italic' : ''}`}>
                                        {node.label.replace(/_/g, '')}
                                    </span>
                                </div>

                                {showDropLineBottom && (
                                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full z-10" />
                                )}
                            </div>
                        )
                    })}
                 </div>

                 <div className="relative w-full h-full overflow-hidden rounded-full">
                    
                    {/* Start Button View */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isTourActive ? 'opacity-100 delay-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                        <button 
                            onClick={startTour}
                            className="flex items-center gap-3 w-full h-full justify-center text-ink group"
                        >
                            <Eye className="w-4 h-4 text-secondary group-hover:text-ink transition-colors" />
                            <span className="font-sans text-sm uppercase tracking-wider font-medium pt-0.5 whitespace-nowrap">Áttekintés</span>
                        </button>
                    </div>

                   {/* Tour Controls View */}
                   <div className={`absolute inset-0 flex items-center justify-between px-4 transition-opacity duration-300 ${isTourActive ? 'opacity-100 delay-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                      
                      {/* Outline Toggle */}
                      <button 
                        ref={toggleOutlineBtnRef}
                        onClick={() => setShowTourOutline(!showTourOutline)}
                        className={`p-2 rounded-full transition-colors shrink-0 mr-1 ${showTourOutline ? 'bg-accent text-white' : 'hover:bg-stone-100 text-secondary'}`}
                        title="Vázlat"
                      >
                          <List className="w-4 h-4" />
                      </button>

                      <div className="w-px h-6 bg-stone-300 mx-1 shrink-0" />

                      <button 
                        onClick={prevStep} 
                        disabled={tourIndex === 0}
                        className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-30 transition-colors shrink-0"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      <span className="font-serif text-lg text-center whitespace-nowrap w-12">
                        {tourIndex + 1} / {tourPath.length}
                      </span>

                      <button 
                        onClick={nextStep}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors shrink-0"
                      >
                          {tourIndex === tourPath.length - 1 ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>

                      <div className="w-px h-6 bg-stone-300 mx-1 shrink-0" />

                      <button 
                        onClick={stopTour}
                        className="px-2 py-1 text-xs uppercase tracking-wider text-secondary hover:text-ink hover:bg-stone-100 rounded transition-colors font-sans whitespace-nowrap"
                      >
                        Kilépés
                      </button>
                   </div>
                 </div>
            </div>
            </>
        )}

        <div className="flex-1 relative bg-paper h-full min-w-0">
            <ConceptGraph 
                ref={graphRef}
                data={data} 
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNode?.id || null}
            />
        </div>

        <DetailPanel 
            node={selectedNode} 
            allNodes={data?.nodes || []}
            onClose={() => setSelectedNode(null)} 
            onNavigate={(id) => focusOnNodeById(id)}
            onRegenerate={handleRegenerateNode}
            onSave={handleNodeUpdate}
            onDelete={handleDeleteNode}
            onAddConnectedNode={handleAddConnectedNode}
            isRegenerating={isRegeneratingNode}
            isAddingNode={isAddingConnection}
            isMobile={isMobile}
            width={panelWidth}
            onResize={setPanelWidth}
        />

      </main>
    </div>
  );
};

export default App;
