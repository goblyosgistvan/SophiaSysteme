
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Info, ChevronRight, ChevronLeft, X, Home, ArrowRight, Trash2, Edit2, Eye, Check, Download, Plus, Send, List, GripVertical, FileJson, FileText, Upload, MoreVertical, BookOpen, FolderInput, RefreshCw, Save, HardDrive, CheckCircle, AlertCircle, FolderOpen, Cloud, ExternalLink, RefreshCcw } from 'lucide-react';
import ConceptGraph, { ConceptGraphHandle } from './components/ConceptGraph';
import DetailPanel from './components/DetailPanel';
import { fetchPhilosophyData, augmentPhilosophyData, enrichNodeData, createConnectedNode } from './services/geminiService';
import { exportJSON, exportMarkdown, getCleanFileName } from './services/exportService';
import { GraphData, PhilosophicalNode, NodeType } from './types';

declare global {
  interface Window {
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

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
  const [showStorageModal, setShowStorageModal] = useState(false);
  
  // File System Access State
  const [folderHandle, setFolderHandle] = useState<any>(null); // FileSystemDirectoryHandle
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // UI feedback for saving
  const [lastFileSave, setLastFileSave] = useState<Date | null>(null);
  
  // Environment Detection
  const [isEmbedded, setIsEmbedded] = useState(false);

  // Panel state
  const [panelWidth, setPanelWidth] = useState(480);
  
  // Augment State
  const [showAugmentInput, setShowAugmentInput] = useState(false);
  const [augmentQuery, setAugmentQuery] = useState('');
  const [augmentLoading, setAugmentLoading] = useState(false);
  const augmentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

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
    
    // Check if running in iframe
    try {
        setIsEmbedded(window.self !== window.top);
    } catch (e) {
        setIsEmbedded(true);
    }

    // Load from LocalStorage initially (Folder access is always manual on reload)
    const saved = localStorage.getItem('sophia_saved_graphs');
    if (saved) {
        try {
            setSavedGraphs(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load saved graphs", e);
        }
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
      setCurrentSuggestions(shuffled.slice(0, 5));
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

  // --- File System Access Logic ---

  // Helper to verify permissions
  const verifyPermission = async (fileHandle: any, readWrite: boolean) => {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    // The user didn't grant permission, so return false.
    return false;
  };

  const saveToFolder = async (topic: string, graphData: GraphData, manual = false) => {
    // If we don't have a handle (e.g. iOS fallback import), we can't write to folder directly.
    if (!folderHandle) return;
    
    // Simple Debounce/Check: Don't auto-save if saved less than 2 seconds ago unless manual
    if (!manual && lastFileSave && (new Date().getTime() - lastFileSave.getTime() < 2000)) {
        return;
    }

    try {
        setIsSaving(true);
        // Verify permission first
        const hasPermission = await verifyPermission(folderHandle, true);
        if (!hasPermission) {
             console.warn("Permission denied for folder access.");
             setIsSaving(false);
             return;
        }

        const fileName = `${getCleanFileName(topic)}.json`;
        // Create or get file
        const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
        // Create a writable stream
        const writable = await fileHandle.createWritable();
        // Write the contents
        await writable.write(JSON.stringify(graphData, null, 2));
        // Close the file
        await writable.close();
        
        console.log(`Saved ${fileName} to folder.`);
        setLastFileSave(new Date());
        
        // Update SavedGraphs list date
        const updatedDate = new Date().toLocaleDateString('hu-HU');
        setSavedGraphs(prev => prev.map(g => 
            g.topic.toLowerCase() === topic.toLowerCase() ? { ...g, date: updatedDate } : g
        ));
        
    } catch (err) {
        console.error("Error saving to folder:", err);
    } finally {
        setTimeout(() => setIsSaving(false), 500);
    }
  };

  const autoSaveGraph = (topic: string, graphData: GraphData) => {
    const exists = savedGraphs.some(g => g.topic.toLowerCase() === topic.toLowerCase());
    let updatedGraphs: SavedGraph[];

    if (exists) {
        updatedGraphs = savedGraphs.map(g => 
            g.topic.toLowerCase() === topic.toLowerCase() ? { ...g, data: graphData, date: new Date().toLocaleDateString('hu-HU') } : g
        );
    } else {
        const newGraph: SavedGraph = {
          id: Date.now().toString(),
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          date: new Date().toLocaleDateString('hu-HU'),
          data: graphData
        };
        updatedGraphs = [newGraph, ...savedGraphs];
    }
    
    // Update State
    setSavedGraphs(updatedGraphs);

    // Only update LocalStorage if NO folder is connected.
    if (!folderHandle) {
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updatedGraphs));
    } else {
        // Trigger folder save
        saveToFolder(topic, graphData, false);
    }
  };

  const loadGraphsFromFolder = async (handle: any) => {
      setIsSyncing(true);
      const newGraphs: SavedGraph[] = [];
      try {
          // Iterate through files in directory
          for await (const e of handle.values()) {
              const entry: any = e;
              if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                  try {
                      const file: any = await entry.getFile();
                      const text = await file.text();
                      const parsedData = JSON.parse(text);
                      // Basic validation
                      if (parsedData.nodes && parsedData.links) {
                          const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                          const topic = rootNode ? rootNode.label : entry.name.replace('.json', '');
                          
                          newGraphs.push({
                              id: `file-${entry.name}-${Date.now()}`,
                              topic: topic,
                              date: new Date(file.lastModified).toLocaleDateString('hu-HU'),
                              data: parsedData
                          });
                      }
                  } catch (e) {
                      console.warn(`Skipping invalid/unreadable JSON: ${entry.name}`, e);
                  }
              }
          }

          // REPLACE state with folder contents (Exclusive View)
          setSavedGraphs(newGraphs);
          setFolderName(handle.name);
          return true;

      } catch (err) {
          console.error("Error reading folder:", err);
          throw err;
      } finally {
          setIsSyncing(false);
      }
  };

  const handleConnectFolder = async () => {
      // Robust check for File System Access API
      const showDirectoryPicker = (window as any).showDirectoryPicker;

      if (showDirectoryPicker) {
          try {
              const handle = await showDirectoryPicker({
                  mode: 'readwrite'
              });
              
              setFolderHandle(handle);
              // We do not save handle to IndexedDB anymore (requested feature removal)
              
              await loadGraphsFromFolder(handle);
          } catch (err: any) {
              // User cancelled or denied permission
              if (err.name === 'AbortError' || err.message?.includes('already active')) {
                  return; 
              }
              
              console.error("Folder access error:", err);

              if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin'))) {
                  alert("Biztonsági korlátozás: Ebben a környezetben a mappa-hozzáférés nem engedélyezett (pl. beágyazott ablak).\n\nPróbáld meg önálló ablakban megnyitni.");
              } else if (err.name === 'NotAllowedError') {
                  alert("Nem adtál engedélyt a mappa eléréséhez.");
              } else {
                 alert("Hiba a mappa csatlakoztatásakor: " + (err.message || "Ismeretlen hiba"));
              }
          }
      } else {
          // Fallback
          if (isMobile) {
              alert("iOS/Android rendszeren a mappa szinkronizáció nem támogatott.\n\nHasználd az 'Importálás' gombot.");
          } else {
              alert("A böngésződ nem támogatja a mappa közvetlen elérését (File System Access API). Használd Chrome, Edge vagy Opera böngészőt asztali gépen.");
          }
      }
  };

  const disconnectFolder = async () => {
      setFolderHandle(null);
      setFolderName(null);
      
      // Reload from LocalStorage when disconnecting folder
      const saved = localStorage.getItem('sophia_saved_graphs');
      if (saved) {
          try {
              setSavedGraphs(JSON.parse(saved));
          } catch (e) {
              setSavedGraphs([]);
          }
      } else {
          setSavedGraphs([]);
      }
  };

  const handleDirectoryImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsSyncing(true);
      const readers: Promise<SavedGraph | null>[] = [];

      Array.from(files).forEach((file: any) => {
          if (!file.name.endsWith('.json')) return;

          const readerPromise = new Promise<SavedGraph | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                  try {
                      const text = e.target?.result as string;
                      const parsedData = JSON.parse(text);
                      
                      if (parsedData.nodes && parsedData.links) {
                          const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                          const topic = rootNode ? rootNode.label : file.name.replace('.json', '');
                          
                          resolve({
                              id: `imported-${file.name}-${Date.now()}`,
                              topic: topic,
                              date: new Date(file.lastModified).toLocaleDateString('hu-HU'),
                              data: parsedData
                          });
                      } else {
                          resolve(null);
                      }
                  } catch (err) {
                      console.warn("Invalid JSON:", file.name);
                      resolve(null);
                  }
              };
              reader.onerror = () => resolve(null);
              reader.readAsText(file);
          });
          readers.push(readerPromise);
      });

      Promise.all(readers).then((results) => {
          const validGraphs = results.filter((g): g is SavedGraph => g !== null);
          
          setSavedGraphs(prev => {
              const merged = [...prev];
              validGraphs.forEach(ng => {
                  // Deduplicate by topic, overwrite if exists
                  const idx = merged.findIndex(g => g.topic.toLowerCase() === ng.topic.toLowerCase());
                  if (idx !== -1) {
                      merged[idx] = ng;
                  } else {
                      merged.push(ng);
                  }
              });
              // Note: Directory import usually implies we just want to load them into the view/memory, 
              // but if no folder connection is active, we might want to save to localstorage.
              if (!folderHandle) {
                localStorage.setItem('sophia_saved_graphs', JSON.stringify(merged));
              }
              return merged;
          });
          
          setIsSyncing(false);
          event.target.value = '';
          if (!folderHandle) {
             alert(`${validGraphs.length} gráf sikeresen importálva!`);
          }
      });
  };


  const deleteGraph = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // If folder connected, we currently don't implement "Delete File from Disk" via this UI for safety,
    // just remove from view. Real delete would require fileHandle.removeEntry().
    // For now, let's keep it simple:
    
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    
    if (!folderHandle) {
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
    } else {
        // If folder is connected, deleting from the list is visual only unless we implement file deletion.
        // Alert user.
        alert("A listából törölve. A fájl a mappában megmaradt.");
    }
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
      
      if (!folderHandle) {
          localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
      }
      
      setRenamingId(null);
  }

  const loadSavedGraph = (graph: SavedGraph) => {
    setQuery(graph.topic);
    setData(graph.data);
    setHasSearched(true);
    setSelectedNode(null);
    setError(null);
  };

  const goHome = async () => {
    // No Auto Save on exit requested by user
    setData(null);
    setHasSearched(false);
    setQuery('');
    setSelectedNode(null);
    stopTour();
    setLastFileSave(null);
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 5));
  };

  // Explicit Manual Save
  const handleManualSave = async () => {
      if (!data || !query) return;

      // If no folder connected, act as "Setup Storage" button
      if (!folderHandle) {
          setShowStorageModal(true);
          return;
      }
      
      // If folder connected, save to disk
      await saveToFolder(query, data, true);
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
            if (parsedData.nodes && Array.isArray(parsedData.nodes) && parsedData.links && Array.isArray(parsedData.links)) {
                
                const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                const topic = rootNode ? rootNode.label : file.name.replace('.json', '');

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
          
          const mergedNodes = [...data.nodes];
          newData.nodes.forEach(newNode => {
              if (!mergedNodes.some(n => n.id === newNode.id)) {
                  mergedNodes.push(newNode);
              }
          });

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
          autoSaveGraph(query, updatedData); 
          setShowAugmentInput(false);
          setAugmentQuery('');
      } catch (err) {
          console.error(err);
      } finally {
          setAugmentLoading(false);
      }
  };

  const handleNodeUpdate = (updatedNode: PhilosophicalNode) => {
      if (!data) return;
      const updatedNodes = data.nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
      const updatedData = { ...data, nodes: updatedNodes };
      setData(updatedData);
      setSelectedNode(updatedNode);
      autoSaveGraph(query, updatedData);
  }

  const handleRegenerateNode = async (node: PhilosophicalNode) => {
      if (!data) return;
      setIsRegeneratingNode(true);

      try {
          const enrichedFields = await enrichNodeData(node, query);
          const updatedNode = { ...node, ...enrichedFields };
          const updatedNodes = data.nodes.map(n => n.id === node.id ? updatedNode : n);
          const updatedData = { ...data, nodes: updatedNodes };
          
          setData(updatedData);
          setSelectedNode(updatedNode); 
          autoSaveGraph(query, updatedData); 

      } catch (error) {
          console.error("Failed to regenerate node:", error);
      } finally {
          setIsRegeneratingNode(false);
      }
  };

  const handleDeleteNode = (nodeId: string) => {
      if (!data) return;

      const updatedNodes = data.nodes.filter(n => n.id !== nodeId);
      const updatedLinks = data.links.filter(l => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return s !== nodeId && t !== nodeId;
      });

      const finalNodes = updatedNodes.map(n => ({
          ...n,
          connections: n.connections.filter(c => c !== nodeId)
      }));

      const updatedData = { nodes: finalNodes, links: updatedLinks };
      
      if (tourPath.includes(nodeId)) {
          const newPath = tourPath.filter(id => id !== nodeId);
          setTourPath(newPath);
          if (isTourActive && tourIndex >= newPath.length) {
              setTourIndex(newPath.length - 1);
          }
      }

      setData(updatedData);
      setSelectedNode(null);
      autoSaveGraph(query, updatedData);
  };

  const handleAddConnectedNode = async (sourceNode: PhilosophicalNode, topic: string) => {
      if (!data) return;
      setIsAddingConnection(true);

      try {
          const result = await createConnectedNode(sourceNode, topic);
          if (!result.nodes.length || !result.links.length) return;

          const newNode = result.nodes[0];
          const newLink = result.links[0];
          
          const updatedNodes = [...data.nodes, newNode];
          const updatedLinks = [...data.links, newLink];
          
          const finalNodes = updatedNodes.map(n => {
             if (n.id === sourceNode.id) {
                 return { ...n, connections: [...n.connections, newNode.id] };
             }
             if (n.id === newNode.id) {
                 if (!n.connections.includes(sourceNode.id)) {
                     return { ...n, connections: [...n.connections, sourceNode.id] };
                 }
             }
             return n;
          });

          const updatedData = { nodes: finalNodes, links: updatedLinks };
          setData(updatedData);
          
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

  // --- Tour Logic ---

  const generateTourPath = (graph: GraphData): string[] => {
    if (!graph.nodes.length) return [];
    const nodes = graph.nodes;
    const links = graph.links;
    
    const root = nodes.find(n => n.type === NodeType.ROOT);
    const categories = nodes.filter(n => n.type === NodeType.CATEGORY);
    const others = nodes.filter(n => n.type !== NodeType.ROOT && n.type !== NodeType.CATEGORY);

    const assignments = new Map<string, string>(); 
    const distances = new Map<string, number>(); 
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const getId = (item: string | any) => typeof item === 'object' ? item.id : item;

    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));
    links.forEach(l => {
        const s = getId(l.source);
        const t = getId(l.target);
        adj.get(s)?.push(t);
        adj.get(t)?.push(s);
    });

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
                queue.push({ id: nextId, anchorId, dist: dist + 1 });
            }
        }
    }

    const path: string[] = [];
    if (root) path.push(root.id);

    categories.forEach(cat => {
        path.push(cat.id);
        const children = others.filter(n => assignments.get(n.id) === cat.id);
        children.sort((a, b) => {
            const distA = distances.get(a.id) || 999;
            const distB = distances.get(b.id) || 999;
            if (distA !== distB) return distA - distB; 
            if (a.type === NodeType.WORK && b.type !== NodeType.WORK) return -1;
            if (a.type !== NodeType.WORK && b.type === NodeType.WORK) return 1;
            return a.label.localeCompare(b.label);
        });
        children.forEach(child => path.push(child.id));
    });

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
    setSelectedNode(null); 
    graphRef.current?.resetZoom(); 
  };

  const handleTourJump = (index: number) => {
      setTourIndex(index);
      focusOnNodeById(tourPath[index]);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
      const container = outlineScrollRef.current;
      if (container) {
          const { top, bottom } = container.getBoundingClientRect();
          const hoverY = e.clientY;
          const threshold = 80; 
          if (hoverY < top + threshold) {
              const speed = Math.max(2, (threshold - (hoverY - top)) / 5);
              container.scrollTop -= speed; 
          } else if (hoverY > bottom - threshold) {
              const speed = Math.max(2, (threshold - (bottom - hoverY)) / 5);
              container.scrollTop += speed;
          }
      }

      if (draggedItemIndex === null) return;
      if (index === draggedItemIndex) {
          setDropTargetIndex(null);
          return;
      }
      
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
          setDropTargetIndex(index); 
      } else {
          setDropTargetIndex(index + 1); 
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
      
      let insertionIndex = dropTargetIndex;
      if (draggedItemIndex < dropTargetIndex) {
          insertionIndex -= 1;
      }
      
      newPath.splice(insertionIndex, 0, draggedItem);
      
      setTourPath(newPath);

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
          graphRef.current?.focusNode(id, { targetYRatio: 0.2, scale: 0.5 });
      } else {
          // Pass full panelWidth as padding. Since container is full width, 
          // this centers the node in the remaining space.
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
  }, [query, savedGraphs, folderHandle]);

  const handleNodeClick = useCallback((node: any) => {
    const pNode = node as PhilosophicalNode;
    if (isMobile) {
        graphRef.current?.focusNode(pNode.id, { targetYRatio: 0.2, scale: 0.5 });
    } else {
        graphRef.current?.focusNode(pNode.id, { fitPadding: panelWidth, scale: 0.9 });
    }
    setSelectedNode(pNode);

    if (isTourActive) {
        const indexInPath = tourPath.indexOf(pNode.id);
        if (indexInPath !== -1) {
            setTourIndex(indexInPath);
        }
    }
  }, [isTourActive, tourPath, isMobile, panelWidth]);

  return (
    <div className="h-screen w-screen flex flex-col bg-paper text-ink overflow-hidden relative">
      
      {/* Hidden fallback input for directory import */}
      <input 
          type="file" 
          ref={directoryInputRef}
          onChange={handleDirectoryImport}
          className="hidden"
          multiple // Allow selecting multiple files (essential for iOS file picker)
          accept=".json"
      />

      {/* --- Floating Controls (Left) --- */}
      <div className="absolute top-4 left-6 z-50 flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 bg-ink text-paper rounded-full flex items-center justify-center font-serif text-2xl cursor-pointer shadow-md hover:scale-105 transition-transform" onClick={goHome}>
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'S'}
          </div>
          {hasSearched && !loading && (
            <h1 className="font-serif text-xl tracking-wide hidden md:block cursor-pointer text-[#D1D1D1] hover:text-ink transition-colors" onClick={goHome}>Sophia</h1>
          )}
      </div>
      
      {/* --- Floating Controls (Right) --- */}
      <div className="absolute top-4 right-6 z-[70] flex gap-4 items-center pointer-events-auto">
        
        {data && !loading && (
            <>
                {/* Augment Bar */}
                <div className={`
                    flex items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${showAugmentInput 
                        ? (isMobile 
                            ? 'absolute right-0 w-[calc(100vw-3rem)] z-50 bg-white shadow-lg border border-stone-200 rounded-full' 
                            : 'w-72 bg-white shadow-md border border-stone-200 rounded-full'
                          )
                        : 'relative w-10 justify-center'
                    }
                `}>
                    
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleAugment(); }}
                        className={`
                           transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center mb-0
                           ${showAugmentInput 
                               ? (isMobile ? 'flex-1 opacity-100 h-10 pl-4' : 'w-full opacity-100 h-10 pl-5 pr-1') 
                               : 'w-0 opacity-0 h-10 overflow-hidden'
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
                <div className="relative flex items-center export-container">
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

                 {/* SAVE BUTTON - Conditionally rendered */}
                 {folderHandle && (
                     <button 
                        onClick={handleManualSave}
                        className={`transition-colors ${isSaving ? 'text-accent' : 'text-[#D1D1D1] hover:text-ink'}`}
                        title="Mentés mappába"
                    >
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    </button>
                 )}

                {/* HOME BUTTON - Swapped position */}
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
                              A használat elég egyszerű: megadsz egy témát és a mesterséges intelligencia összeállítja neked a tartalmat. Ezután a bal egérgomb lenyomásával tudod mozgatni a térképet, a görgővel tudsz nagyítani, és a csomópontokra kattintva elolvashatod azok kifejtéseit.
                          </p>
                          <p>
                              A jobb felső sarokban található „+” gombbal kiegészítheted a gráfot új elemekkel, a letöltés ikonnal pedig esszé formátumban exportálhatod a tudástárat.
                          </p>
                          <p className="text-base text-secondary pt-4 font-sans">
                              0.3.5 verzió. 2025. november
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Storage Modal --- */}
      {showStorageModal && (
        <div className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStorageModal(false)}>
          <div 
            className="bg-paper max-w-lg w-full rounded-xl shadow-2xl overflow-hidden flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
             <div className="p-6 border-b border-stone-200 bg-paper shrink-0 flex justify-between items-center">
                  <h2 className="text-xl font-serif font-bold text-ink flex items-center gap-2">
                      <HardDrive className="w-5 h-5" />
                      Tárhely kezelés
                  </h2>
                  <button onClick={() => setShowStorageModal(false)} className="text-secondary hover:text-ink p-1">
                      <X size={20} /> 
                  </button>
             </div>
             
             <div className="p-6 space-y-6">
                {/* Option 1: Local Storage */}
                <div className={`p-4 rounded-lg border transition-colors ${!folderHandle ? 'bg-white border-accent shadow-sm' : 'bg-stone-50 border-stone-200 opacity-60 hover:opacity-100'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${!folderHandle ? 'bg-accent/10 text-accent' : 'bg-stone-200 text-stone-500'}`}>
                           <Cloud className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-ink text-sm uppercase tracking-wide">Böngésző memória</h3>
                                {!folderHandle && <CheckCircle className="w-4 h-4 text-accent" />}
                            </div>
                            <p className="text-sm text-secondary mb-2">A gráfokat a böngésződ tárolja. Gyors és automatikus.</p>
                            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                                <AlertCircle className="w-3 h-3" />
                                <span>Elveszhet, ha törlöd a böngészési adatokat.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Option 2: Folder Sync */}
                <div className={`p-4 rounded-lg border transition-colors ${folderHandle ? 'bg-white border-green-500 shadow-sm' : 'bg-stone-50 border-stone-200'}`}>
                    <div className="flex items-start gap-4">
                         <div className={`p-2 rounded-full ${folderHandle ? 'bg-green-100 text-green-600' : 'bg-stone-200 text-stone-500'}`}>
                           <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                             <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-ink text-sm uppercase tracking-wide">Helyi mappa szinkronizáció</h3>
                                {folderHandle && <CheckCircle className="w-4 h-4 text-green-600" />}
                            </div>
                            
                            {isEmbedded && !folderHandle && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>
                                            <strong>Korlátozott hozzáférés:</strong> Úgy tűnik, beágyazott ablakban (pl. előnézetben) futtatod az alkalmazást. 
                                            Biztonsági okokból a közvetlen mappahozzáférés itt nem engedélyezett.
                                        </span>
                                    </div>
                                    <div className="mt-3 text-xs font-mono ml-6">
                                        Tipp: Nyisd meg az alkalmazást önálló ablakban, vagy használd a lenti Import/Export gombokat.
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-secondary mb-3">
                                Válassz egy mappát a számítógépeden. A gráfok <span className="font-mono text-xs bg-stone-100 px-1 rounded">.json</span> fájlként kerülnek mentésre.
                            </p>
                            
                            {folderHandle ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-mono text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                        {`Csatlakoztatva: ${folderName || 'Mappa'}`}
                                    </div>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={disconnectFolder}
                                            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2"
                                        >
                                            Kapcsolat bontása
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    type="button"
                                    onClick={handleConnectFolder}
                                    className="px-4 py-2 bg-white border border-stone-300 rounded hover:border-accent hover:text-accent transition-colors text-sm font-sans flex items-center gap-2 shadow-sm"
                                >
                                    <FolderInput className="w-4 h-4" />
                                    Mappa kiválasztása
                                </button>
                            )}
                        </div>
                    </div>
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

                    <div className="w-full max-w-3xl text-left pb-20 transition-opacity duration-700">
                        <div className="flex justify-between items-end mb-6 border-b border-stone-200 pb-2">
                             <div className="flex items-center gap-3">
                                 <h3 className="font-serif text-2xl text-ink">Előzmények</h3>
                                 {folderHandle ? (
                                     <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        {folderName || 'Szinkronizálva'}
                                     </span>
                                 ) : null}
                             </div>
                             
                             <div className="flex items-center gap-2 md:gap-4">
                                 {/* Folder Connect Button - Shortcut */}
                                 <button
                                     type="button"
                                     onClick={() => setShowStorageModal(true)}
                                     className={`flex items-center gap-2 transition-colors text-sm font-sans cursor-pointer ${folderHandle ? 'text-secondary hover:text-accent' : 'text-secondary hover:text-accent'}`}
                                     title="Mappa beállítások"
                                 >
                                     {isSyncing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                     ) : (
                                        <FolderInput className="w-4 h-4" />
                                     )}
                                     <span className={isMobile ? "hidden" : ""}>
                                         {folderHandle ? "Beállítások" : "Mappa csatolása"}
                                     </span>
                                 </button>

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
                                        <span className={isMobile ? "hidden" : ""}>Importálás</span>
                                    </button>
                                 </div>
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
                            <div className="text-center py-8">
                                <p className="text-secondary/50 italic mb-2">
                                    {folderHandle 
                                        ? "A mappa üres."
                                        : "Még nincsenek mentett gráfjaid."}
                                </p>
                            </div>
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

        {/* Saving Overlay */}
        {isSaving && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm z-[150]">
                <Save className="w-10 h-10 text-accent mb-4 animate-pulse" />
                <p className="font-serif text-xl">Mentés mappába...</p>
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
        
        {/* --- Concept Graph Visualization --- */}
        {data && !loading && (
            <div className="flex-1 relative h-full w-full">
               <ConceptGraph 
                 ref={graphRef}
                 data={data} 
                 onNodeClick={handleNodeClick}
                 selectedNodeId={selectedNode?.id || null}
               />
            </div>
        )}

        {/* --- Detail Panel (Slide-in) --- */}
        <DetailPanel 
          node={selectedNode}
          allNodes={data?.nodes || []}
          onClose={() => setSelectedNode(null)}
          onNavigate={(nodeId) => focusOnNodeById(nodeId)}
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
