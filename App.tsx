
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Info, ChevronRight, ChevronLeft, X, Home, ArrowRight, Trash2, Edit2, Eye, Check, Download, Plus, Send, List, GripVertical, FileJson, FileText, Upload, MoreVertical, BookOpen, FolderInput, RefreshCw, Save, HardDrive, CheckCircle, AlertCircle, FolderOpen, Cloud, ExternalLink, RefreshCcw, Paperclip, File, Menu, Share2, Globe } from 'lucide-react';
import ConceptGraph, { ConceptGraphHandle } from './components/ConceptGraph';
import DetailPanel from './components/DetailPanel';
import OutlinePanel from './components/OutlinePanel';
import SidebarPanel from './components/SidebarPanel';
import { fetchPhilosophyData, augmentPhilosophyData, enrichNodeData, createConnectedNode, FileInput } from './services/geminiService';
import { exportJSON, exportMarkdown, getCleanFileName } from './services/exportService';
import { fetchLibraryIndex, fetchOnlineGraph, generateShareableLink } from './services/onlineLibraryService';
import { GraphData, PhilosophicalNode, NodeType, SavedGraph, LibraryItem } from './types';

declare global {
  interface Window {
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

const ALL_SUGGESTIONS = [
    'Sztoicizmus', 'Platón', 'Etika', 'Egzisztencializmus', 'Kategorikus imperatívusz',
    'Nietzsche', 'Arisztotelészi logika', 'Utilitarizmus', 'Fenomenológia', 'Heidegger',
    'Spinoza etikája', 'Schopenhauer', 'Metafizika', 'Episztemológia', 'Társadalmi szerződés'
];

// Helper to generate default hierarchy order
const generateDefaultOrder = (nodes: PhilosophicalNode[], links: any[]): string[] => {
    if (!nodes.length) return [];
    
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

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhilosophicalNode | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);
  const [onlineLibrary, setOnlineLibrary] = useState<LibraryItem[]>([]); // Online items
  const [isOnlineGraph, setIsOnlineGraph] = useState(false); // Track if current is online
  const [currentOnlineFilename, setCurrentOnlineFilename] = useState<string | null>(null);

  const [showInfo, setShowInfo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // File System Access State
  const [folderHandle, setFolderHandle] = useState<any>(null); // FileSystemDirectoryHandle
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // UI feedback for saving
  const [lastFileSave, setLastFileSave] = useState<Date | null>(null);
  
  // File Upload for Generation State
  const [uploadedFile, setUploadedFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Environment Detection
  const [isEmbedded, setIsEmbedded] = useState(false);

  // Panel state
  const [panelWidth, setPanelWidth] = useState(480);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Augment State
  const [showAugmentInput, setShowAugmentInput] = useState(false);
  const [augmentQuery, setAugmentQuery] = useState('');
  const [augmentLoading, setAugmentLoading] = useState(false);
  const augmentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // for JSON import
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // Search in Graph State
  const [showGraphSearch, setShowGraphSearch] = useState(false);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const graphSearchInputRef = useRef<HTMLInputElement>(null);

  // Node Regeneration State
  const [isRegeneratingNode, setIsRegeneratingNode] = useState(false);
  
  // Adding specific node connection state
  const [isAddingConnection, setIsAddingConnection] = useState(false);

  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  
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

    // Load Online Library Index (if exists)
    const loadLibrary = async () => {
        const items = await fetchLibraryIndex();
        setOnlineLibrary(items);
    };
    loadLibrary();

    // --- DEEP LINKING LOGIC (URL PATH or ?src=) ---
    // Safe path extraction: handles case where pathname might lack leading slash in some envs
    const rawPath = window.location.pathname;
    const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
    
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    
    // Priority: 1. Clean Path, 2. Query Param. 
    // Filter out common false positives like "index.html" or protocol fragments like "ttps:"
    if (path && path !== '' && path !== 'index.html' && !path.includes(':')) {
         handleLoadOnlineGraphByFilename(decodeURIComponent(path));
    } else if (src) {
         handleLoadOnlineGraphByFilename(src);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
      setCurrentSuggestions(shuffled.slice(0, 5));
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
        const key = e.key.toUpperCase();
        
        if (e.key === 'Escape') {
             if (showGraphSearch) {
                 setShowGraphSearch(false);
                 setGraphSearchQuery('');
                 return;
             }
             if (hasSearched) {
                 goHome();
                 return;
             }
             return;
        }

        if (isInput) return;
        
        if (key === 'Q') {
            if (hasSearched) {
                setIsOutlineOpen(prev => !prev);
            } else {
                setIsSidebarOpen(prev => !prev);
            }
        }
        
        if (key === 'F' && hasSearched && !loading) {
            e.preventDefault();
            setShowGraphSearch(true);
            setTimeout(() => graphSearchInputRef.current?.focus(), 50);
        }

        if (key === 'R') {
            if (selectedNode) {
                setSelectedNode(null);
            } else if (data) {
                 const root = data.nodes.find(n => n.type === NodeType.ROOT);
                 if (root) {
                     setSelectedNode(root);
                     if (isMobile) {
                        graphRef.current?.focusNode(root.id, { targetYRatio: 0.2, scale: 0.5 });
                     } else {
                        graphRef.current?.focusNode(root.id, { fitPadding: panelWidth, scale: 0.9 });
                     }
                 }
            }
        }
        
        if (data && data.customOrder && (key === 'W' || key === 'E')) {
            const order = data.customOrder;
            if (order.length === 0) return;
            
            let currentIndex = -1;
            if (selectedNode) {
                currentIndex = order.indexOf(selectedNode.id);
            }
            
            let nextIndex = currentIndex;
            
            if (key === 'W') { // Up / Back
                 if (currentIndex === -1) {
                     nextIndex = 0;
                 } else if (currentIndex > 0) {
                     nextIndex = currentIndex - 1;
                 }
            }
            
            if (key === 'E') { // Down
                if (currentIndex === -1) {
                    nextIndex = 0;
                } else if (currentIndex < order.length - 1) {
                    nextIndex = currentIndex + 1;
                }
            }
            
            if (nextIndex !== -1 && nextIndex !== currentIndex) {
                const nodeId = order[nextIndex];
                const node = data.nodes.find(n => n.id === nodeId);
                if (node) {
                    setSelectedNode(node);
                     if (isMobile) {
                        graphRef.current?.focusNode(node.id, { targetYRatio: 0.2, scale: 0.5 });
                    } else {
                        graphRef.current?.focusNode(node.id, { fitPadding: panelWidth, scale: 0.9 });
                    }
                }
            }
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, selectedNode, panelWidth, isMobile, hasSearched, showGraphSearch]);

  const handleGraphSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && data) {
        const lowerTerm = graphSearchQuery.toLowerCase();
        const matches = data.nodes.filter(n => n.label.toLowerCase().includes(lowerTerm));
        
        if (matches.length === 1) {
            const node = matches[0];
            setSelectedNode(node);
            if (isMobile) {
                graphRef.current?.focusNode(node.id, { targetYRatio: 0.2, scale: 0.8 });
            } else {
                graphRef.current?.focusNode(node.id, { fitPadding: panelWidth, scale: 1.2 });
            }
        }
    }
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (showExportMenu && !(event.target as Element).closest('.export-container')) {
              setShowExportMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
      if (showAugmentInput && augmentInputRef.current) {
          augmentInputRef.current.focus();
      }
  }, [showAugmentInput]);

  const verifyPermission = async (fileHandle: any, readWrite: boolean) => {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  };

  const getDirectoryHandleFromPath = async (rootHandle: any, path: string, create = false): Promise<any> => {
      if (!path) return rootHandle;
      const parts = path.split('/');
      let current = rootHandle;
      for (const part of parts) {
          if (!part) continue;
          current = await current.getDirectoryHandle(part, { create });
      }
      return current;
  };

  const saveToFolder = async (topic: string, graphData: GraphData, manual = false, specificPath?: string) => {
    if (!folderHandle) return;
    const path = typeof specificPath === 'string' ? specificPath : "";

    if (!manual && lastFileSave && (new Date().getTime() - lastFileSave.getTime() < 2000)) {
        return;
    }

    try {
        setIsSaving(true);
        const hasPermission = await verifyPermission(folderHandle, true);
        if (!hasPermission) {
             console.warn("Permission denied for folder access.");
             setIsSaving(false);
             return;
        }

        const fileName = `${getCleanFileName(topic)}.json`;
        const targetDirHandle = await getDirectoryHandleFromPath(folderHandle, path, true);
        
        const fileHandle = await targetDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(graphData, null, 2));
        await writable.close();
        
        setLastFileSave(new Date());
        
        const updatedDate = new Date().toLocaleDateString('hu-HU');
        setSavedGraphs(prev => prev.map(g => 
            g.topic.toLowerCase() === topic.toLowerCase() ? { ...g, date: updatedDate, data: graphData } : g
        ));
        
    } catch (err) {
        console.error("Error saving to folder:", err);
    } finally {
        setTimeout(() => setIsSaving(false), 500);
    }
  };

  const autoSaveGraph = (topic: string, graphData: GraphData) => {
    if (isOnlineGraph) return;

    const exists = savedGraphs.find(g => g.topic.toLowerCase() === topic.toLowerCase());
    let updatedGraphs: SavedGraph[];

    let dataToSave = {
        ...graphData,
        customOrder: graphData.customOrder || generateDefaultOrder(graphData.nodes, graphData.links)
    };

    if (exists) {
        dataToSave = {
            ...dataToSave,
            metadata: {
                ...exists.data.metadata,
                ...dataToSave.metadata
            }
        };

        updatedGraphs = savedGraphs.map(g => 
            g.topic.toLowerCase() === topic.toLowerCase() ? { ...g, data: dataToSave, date: new Date().toLocaleDateString('hu-HU'), icon: dataToSave.metadata?.icon || g.icon } : g
        );
    } else {
        const newGraph: SavedGraph = {
          id: Date.now().toString(),
          topic: topic,
          date: new Date().toLocaleDateString('hu-HU'),
          data: dataToSave,
          path: "", 
          icon: dataToSave.metadata?.icon
        };
        updatedGraphs = [newGraph, ...savedGraphs];
    }
    
    setSavedGraphs(updatedGraphs);
    if (data && data.nodes.length === dataToSave.nodes.length) {
       setData(dataToSave);
    }

    if (!folderHandle) {
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updatedGraphs));
    } else {
        saveToFolder(topic, dataToSave, false, exists?.path || "");
    }
  };

  const loadGraphsFromFolder = async (handle: any) => {
      setIsSyncing(true);
      const newGraphs: SavedGraph[] = [];

      const readDirectory = async (dirHandle: any, path: string) => {
          for await (const entry of dirHandle.values()) {
              if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                  try {
                      const file: any = await entry.getFile();
                      const text = await file.text();
                      const parsedData = JSON.parse(text);
                      
                      if (parsedData.nodes && parsedData.links) {
                          const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                          const topic = parsedData.metadata?.title || rootNode?.label || entry.name.replace('.json', '');
                          const icon = parsedData.metadata?.icon;

                          if (!parsedData.customOrder) {
                              parsedData.customOrder = generateDefaultOrder(parsedData.nodes, parsedData.links);
                          }

                          newGraphs.push({
                              id: `file-${entry.name}-${Date.now()}`,
                              topic: topic,
                              date: new Date(file.lastModified).toLocaleDateString('hu-HU'),
                              data: parsedData,
                              path: path,
                              icon: icon
                          });
                      }
                  } catch (e) {
                      console.warn(`Skipping invalid: ${entry.name}`);
                  }
              } else if (entry.kind === 'directory') {
                  const newPath = path ? `${path}/${entry.name}` : entry.name;
                  await readDirectory(entry, newPath);
              }
          }
      };

      try {
          await readDirectory(handle, "");
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
      const showDirectoryPicker = (window as any).showDirectoryPicker;

      if (showDirectoryPicker) {
          try {
              const handle = await showDirectoryPicker({ mode: 'readwrite' });
              setFolderHandle(handle);
              await loadGraphsFromFolder(handle);
          } catch (err: any) {
              if (err.name === 'AbortError') return;
              console.error("Folder access error:", err);
              if (err.name === 'SecurityError') {
                  alert("Biztonsági korlátozás: Beágyazott ablakban nem működik.");
              } else {
                 alert("Hiba a mappa csatlakoztatásakor.");
              }
          }
      } else {
           alert("A böngésződ nem támogatja a mappa közvetlen elérését.");
      }
  };

  const disconnectFolder = async () => {
      setFolderHandle(null);
      setFolderName(null);
      
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

  const handleCreateFolder = async (path: string) => {
      const newFolderName = prompt("Add meg a mappa nevét:");
      if (!newFolderName) return;

      if (!folderHandle) {
          const fullPath = path ? `${path}/${newFolderName}` : newFolderName;
          
          const placeholderGraph: SavedGraph = {
              id: `folder-${Date.now()}`,
              topic: ".keep", 
              date: new Date().toLocaleDateString('hu-HU'),
              data: { nodes: [], links: [] },
              path: fullPath
          };
          
          const updated = [...savedGraphs, placeholderGraph];
          setSavedGraphs(updated);
          localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
          return;
      }

      try {
          const parentDir = await getDirectoryHandleFromPath(folderHandle, path, true);
          await parentDir.getDirectoryHandle(newFolderName, { create: true });
          
          await loadGraphsFromFolder(folderHandle);
      } catch (err) {
          console.error("Failed to create folder", err);
          alert("Hiba a mappa létrehozásakor.");
      }
  }

  const handleMoveGraph = async (graphId: string, targetPath: string) => {
      const graph = savedGraphs.find(g => g.id === graphId);
      if (!graph) return;

      if (folderHandle) {
          try {
              const oldDir = await getDirectoryHandleFromPath(folderHandle, graph.path);
              const fileName = `${getCleanFileName(graph.topic)}.json`;
              const fileHandle = await oldDir.getFileHandle(fileName);
              const file = await fileHandle.getFile();
              const text = await file.text();

              const targetDir = await getDirectoryHandleFromPath(folderHandle, targetPath, true);
              const newFileHandle = await targetDir.getFileHandle(fileName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(text);
              await writable.close();

              await oldDir.removeEntry(fileName);
              
              await loadGraphsFromFolder(folderHandle);
          } catch (err) {
              console.error("Move failed", err);
              alert("Nem sikerült áthelyezni a fájlt.");
          }
      } else {
          const updated = savedGraphs.map(g => g.id === graphId ? { ...g, path: targetPath } : g);
          setSavedGraphs(updated);
          localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
      }
  }

  const deleteGraph = async (id: string) => {
    const graph = savedGraphs.find(g => g.id === id);
    if (!graph) return;

    if (folderHandle) {
         if(!confirm(`Biztosan törlöd a mappából: ${graph.topic}?`)) return;
         try {
             const dir = await getDirectoryHandleFromPath(folderHandle, graph.path);
             const fileName = `${getCleanFileName(graph.topic)}.json`;
             await dir.removeEntry(fileName);
             await loadGraphsFromFolder(folderHandle);
         } catch(err) {
             console.error("Delete failed", err);
         }
    } else {
        const updated = savedGraphs.filter(g => g.id !== id);
        setSavedGraphs(updated);
        localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
    }
  }

  const renameGraph = async (id: string, newName: string) => {
       const graph = savedGraphs.find(g => g.id === id);
       if (!graph) return;

       const oldTopic = graph.topic;
       const oldPath = graph.path;

       const updatedData = {
           ...graph.data,
           metadata: {
               ...graph.data.metadata,
               title: newName
           }
       };

       const updatedGraphs = savedGraphs.map(g => g.id === id ? { ...g, topic: newName, data: updatedData } : g);
       setSavedGraphs(updatedGraphs);
       
       if (!folderHandle) {
           localStorage.setItem('sophia_saved_graphs', JSON.stringify(updatedGraphs));
       } else {
           try {
               const oldFileName = `${getCleanFileName(oldTopic)}.json`;
               const newFileName = `${getCleanFileName(newName)}.json`;
               
               await saveToFolder(newName, updatedData, true, oldPath);
               
               if (oldFileName !== newFileName) {
                    const dir = await getDirectoryHandleFromPath(folderHandle, oldPath);
                    await dir.removeEntry(oldFileName);
               }
           } catch(e) {
                console.error("Rename filesystem error:", e);
                await loadGraphsFromFolder(folderHandle);
           }
       }
  }

  const updateGraphIcon = async (id: string, newIcon: string) => {
      const graph = savedGraphs.find(g => g.id === id);
      if(!graph) return;

      const updatedData = {
          ...graph.data,
          metadata: {
              ...graph.data.metadata,
              icon: newIcon
          }
      };

      const updatedGraphs = savedGraphs.map(g => g.id === id ? { ...g, icon: newIcon, data: updatedData } : g);
      setSavedGraphs(updatedGraphs);
      
      if (!folderHandle) {
           localStorage.setItem('sophia_saved_graphs', JSON.stringify(updatedGraphs));
      } else {
          await saveToFolder(graph.topic, updatedData, true, graph.path);
      }
  }

  const loadSavedGraph = (graph: SavedGraph) => {
    setQuery(graph.topic);
    setUploadedFile(null);
    const dataToLoad = { ...graph.data };
    if (!dataToLoad.customOrder) {
        dataToLoad.customOrder = generateDefaultOrder(dataToLoad.nodes, dataToLoad.links);
    }
    setData(dataToLoad);
    setHasSearched(true);
    setSelectedNode(null);
    setError(null);
    setIsOutlineOpen(false);
    setIsSidebarOpen(false);
    setIsOnlineGraph(false);
    setCurrentOnlineFilename(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleLoadOnlineGraphByFilename = async (filename: string) => {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      try {
          const graphData = await fetchOnlineGraph(filename);
          // Auto-infer title if missing
          const rootNode = graphData.nodes.find(n => n.type === NodeType.ROOT);
          const title = graphData.metadata?.title || rootNode?.label || "Online Gráf";
          
          setQuery(title);
          
          if (!graphData.customOrder) {
              graphData.customOrder = generateDefaultOrder(graphData.nodes, graphData.links);
          }
          setData(graphData);
          setIsOnlineGraph(true);
          setCurrentOnlineFilename(filename);
          setIsSidebarOpen(false);
          setIsOutlineOpen(false);
      } catch (err) {
          console.error("Error loading online graph", err);
          // More user friendly error
          setError("A keresett online gráf nem található. Lehet, hogy a link hibás, vagy a fájl törölve lett.");
      } finally {
          setLoading(false);
      }
  };

  const loadOnlineGraphItem = (item: LibraryItem) => {
      handleLoadOnlineGraphByFilename(item.filename);
      // Generate clean link (without .json) for sharing
      const newUrl = generateShareableLink(item.filename);
      window.history.pushState({}, '', newUrl);
  };

  const goHome = async () => {
    setData(null);
    setHasSearched(false);
    setQuery('');
    setUploadedFile(null);
    setSelectedNode(null);
    setIsOutlineOpen(false);
    setShowGraphSearch(false);
    setLastFileSave(null);
    setIsOnlineGraph(false);
    setCurrentOnlineFilename(null);
    window.history.pushState({}, '', window.location.pathname);
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 5));
  };

  const handleManualSave = async () => {
      if (!data || !query) return;
      if (!folderHandle) return;
      
      if (isOnlineGraph) {
          await saveToFolder(query, data, true, ""); 
          alert("Sikeres mentés a helyi mappába! Mostantól ez egy helyi másolat.");
          setIsOnlineGraph(false);
          await loadGraphsFromFolder(folderHandle);
      } else {
          const graph = savedGraphs.find(g => g.topic.toLowerCase() === query.toLowerCase());
          await saveToFolder(query, data, true, graph?.path || "");
      }
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

  const handleShareLink = () => {
      if (!currentOnlineFilename) return;
      const url = generateShareableLink(currentOnlineFilename);
      navigator.clipboard.writeText(url).then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
      });
      setShowExportMenu(false);
  }

  const handleImportGraph = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
            const parsedData = JSON.parse(content);
            if (parsedData.nodes && parsedData.links) {
                const rootNode = parsedData.nodes.find((n: any) => n.type === 'ROOT');
                const topic = rootNode ? rootNode.label : file.name.replace('.json', '');
                
                if (!parsedData.customOrder) {
                    parsedData.customOrder = generateDefaultOrder(parsedData.nodes, parsedData.links);
                }

                setIsOnlineGraph(false); 
                autoSaveGraph(topic, parsedData);
                const importedGraph: SavedGraph = {
                    id: Date.now().toString(),
                    topic: topic,
                    date: new Date().toLocaleDateString('hu-HU'),
                    data: parsedData,
                    path: ""
                };
                loadSavedGraph(importedGraph);
            } else {
                alert("A fájl formátuma nem megfelelő.");
            }
        } catch (err) {
            alert("Hiba a fájl beolvasásakor.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const triggerFileUpload = () => fileInputRef.current?.click();
  const triggerDocumentUpload = () => documentInputRef.current?.click();

  const handleDocumentSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { 
          alert("A fájl túl nagy. Kérlek használj 8MB-nál kisebb fájlt.");
          return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          const base64String = (e.target?.result as string).split(',')[1];
          setUploadedFile({
              name: file.name,
              data: base64String,
              mimeType: file.type || 'application/pdf'
          });
          if (!query.trim()) {
            setQuery(file.name.replace(/\.[^/.]+$/, ""));
          }
      };
      reader.readAsDataURL(file);
      event.target.value = '';
  };

  const clearUploadedFile = () => setUploadedFile(null);

  const handleAugment = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!augmentQuery.trim() || !data) return;
      setAugmentLoading(true);
      try {
          const newData = await augmentPhilosophyData(data, augmentQuery);
          const mergedNodes = [...data.nodes];
          const newIds: string[] = [];
          newData.nodes.forEach(newNode => {
              if (!mergedNodes.some(n => n.id === newNode.id)) {
                  mergedNodes.push(newNode);
                  newIds.push(newNode.id);
              }
          });
          const mergedLinks = [...data.links];
          newData.links.forEach(newLink => {
              const exists = mergedLinks.some(l => 
                l.source === newLink.source && l.target === newLink.target && l.relationLabel === newLink.relationLabel
              );
              if (!exists) mergedLinks.push(newLink);
          });
          const updatedData = { 
              nodes: mergedNodes, 
              links: mergedLinks, 
              customOrder: [...(data.customOrder || []), ...newIds] 
          };
          setData(updatedData);
          if (!isOnlineGraph) {
              autoSaveGraph(query, updatedData); 
          }
          setShowAugmentInput(false);
          setAugmentQuery('');
      } catch (err) { console.error(err); } finally { setAugmentLoading(false); }
  };

  const handleNodeUpdate = (updatedNode: PhilosophicalNode) => {
      if (!data) return;
      const updatedNodes = data.nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
      const updatedData = { ...data, nodes: updatedNodes };
      setData(updatedData);
      setSelectedNode(updatedNode);
      if (!isOnlineGraph) {
         autoSaveGraph(query, updatedData);
      }
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
          if (!isOnlineGraph) {
            autoSaveGraph(query, updatedData); 
          }
      } catch (error) { console.error("Failed to regenerate node:", error); } finally { setIsRegeneratingNode(false); }
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
      const newOrder = (data.customOrder || []).filter(id => id !== nodeId);
      const updatedData = { nodes: finalNodes, links: updatedLinks, customOrder: newOrder };
      setData(updatedData);
      setSelectedNode(null);
      if (!isOnlineGraph) {
        autoSaveGraph(query, updatedData);
      }
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
          const currentOrder = [...(data.customOrder || [])];
          const sourceIndex = currentOrder.indexOf(sourceNode.id);
          if (sourceIndex !== -1) {
              currentOrder.splice(sourceIndex + 1, 0, newNode.id);
          } else {
              currentOrder.push(newNode.id);
          }
          const updatedData = { nodes: finalNodes, links: updatedLinks, customOrder: currentOrder };
          setData(updatedData);
          const updatedSourceNode = finalNodes.find(n => n.id === sourceNode.id);
          if (updatedSourceNode) { setSelectedNode(updatedSourceNode); }
          if (!isOnlineGraph) {
            autoSaveGraph(query, updatedData);
          }
      } catch (err) { console.error("Failed to add connected node", err); } finally { setIsAddingConnection(false); }
  };

  const handleOrderChange = (newOrder: string[]) => {
      if (!data) return;
      const updatedData = { ...data, customOrder: newOrder };
      setData(updatedData);
      if (!isOnlineGraph) {
        autoSaveGraph(query, updatedData);
      }
  };

  const focusOnNodeById = (id: string) => {
    if (!data) return;
    const node = data.nodes.find(n => n.id === id);
    if (node) {
      setSelectedNode(node);
      if (isMobile) {
          graphRef.current?.focusNode(id, { targetYRatio: 0.2, scale: 0.5 });
      } else {
          graphRef.current?.focusNode(id, { fitPadding: panelWidth, scale: 0.9 });
      }
    }
  };

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() && !uploadedFile) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSelectedNode(null);
    setHasSearched(true);
    setIsOutlineOpen(false);
    setIsOnlineGraph(false);
    setCurrentOnlineFilename(null);
    window.history.pushState({}, '', window.location.pathname);

    try {
      let fileInputData: FileInput | undefined = undefined;
      if (uploadedFile) {
          fileInputData = {
              mimeType: uploadedFile.mimeType,
              data: uploadedFile.data
          };
      }
      const graphData = await fetchPhilosophyData(query, fileInputData);
      if (uploadedFile && (!query || query === uploadedFile.name)) {
          const rootNode = graphData.nodes.find(n => n.type === NodeType.ROOT);
          if (rootNode) setQuery(rootNode.label);
      }
      graphData.customOrder = generateDefaultOrder(graphData.nodes, graphData.links);
      setData(graphData);
      autoSaveGraph(query || uploadedFile?.name || "Névtelen dokumentum", graphData); 
    } catch (err: any) {
      console.error(err);
      setError("Hiba történt a generálás során. Kérlek, próbáld újra, vagy pontosítsd a témát.");
      setHasSearched(false); 
    } finally {
      setLoading(false);
    }
  }, [query, uploadedFile, savedGraphs, folderHandle]);

  const handleNodeClick = useCallback((node: any) => {
    const pNode = node as PhilosophicalNode;
    if (isMobile) {
        graphRef.current?.focusNode(pNode.id, { targetYRatio: 0.2, scale: 0.5 });
    } else {
        graphRef.current?.focusNode(pNode.id, { fitPadding: panelWidth, scale: 0.9 });
    }
    setSelectedNode(pNode);
  }, [isMobile, panelWidth]);

  return (
    <div className="h-screen w-screen flex flex-col bg-paper text-ink overflow-hidden relative">
      <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleImportGraph} 
          className="hidden"
          accept=".json"
      />
      
      <div className="absolute top-4 left-6 z-50 flex flex-col items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 bg-ink text-paper rounded-full flex items-center justify-center font-serif text-2xl cursor-pointer shadow-md hover:scale-105 transition-transform" onClick={goHome}>
              S
          </div>
          
          {!hasSearched && !loading && !isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-white rounded-full text-secondary hover:text-ink shadow-sm border border-stone-200 transition-colors"
                title="Előzmények (Q)"
              >
                  <Menu className="w-5 h-5" />
              </button>
          )}

          {hasSearched && !loading && !isOutlineOpen && (
              <button 
                onClick={() => setIsOutlineOpen(true)}
                className="p-2 bg-white rounded-full text-secondary hover:text-ink shadow-sm border border-stone-200 transition-colors"
                title="Vázlat (Q)"
              >
                  <List className="w-5 h-5" />
              </button>
          )}

          {hasSearched && !loading && (
            <h1 className="font-serif text-xl tracking-wide hidden md:block cursor-pointer text-[#D1D1D1] hover:text-ink transition-colors absolute left-14 top-1" onClick={goHome}>Sophia</h1>
          )}
      </div>

      {/* --- Online Indicator Pill --- */}
      {isOnlineGraph && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-sm font-medium">
                  <Globe className="w-4 h-4" />
                  <span>Online Olvasó Mód</span>
                  {data && folderHandle && (
                      <button 
                        onClick={handleManualSave} 
                        className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs transition-colors"
                      >
                          Mentés sajátként
                      </button>
                  )}
              </div>
          </div>
      )}

      {showGraphSearch && hasSearched && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-white/90 backdrop-blur-md shadow-2xl rounded-full border border-stone-200 pl-4 pr-2 py-2 flex items-center gap-2 w-[320px] md:w-[480px]">
                  <Search className="w-5 h-5 text-stone-400" />
                  <input 
                    ref={graphSearchInputRef}
                    type="text" 
                    value={graphSearchQuery}
                    onChange={(e) => setGraphSearchQuery(e.target.value)}
                    onKeyDown={handleGraphSearchKeyDown}
                    className="bg-transparent border-none focus:ring-0 focus:outline-none outline-none text-ink placeholder:text-stone-400 w-full text-sm font-sans"
                    placeholder="Keresés a gráfban..."
                    autoFocus
                  />
                  <button 
                    onClick={() => { setShowGraphSearch(false); setGraphSearchQuery(''); }}
                    className="p-1 hover:bg-stone-100 rounded-full text-secondary"
                  >
                      <X className="w-4 h-4" />
                  </button>
              </div>
          </div>
      )}
      
      <div className="absolute top-4 right-6 z-[70] flex gap-4 items-center pointer-events-auto">
        
        {data && !loading && (
            <>
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

                <div className="relative flex items-center export-container">
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className={`text-[#D1D1D1] hover:text-ink transition-colors ${showExportMenu ? 'text-ink' : ''}`}
                        title="Exportálás"
                    >
                        <Download className="w-6 h-6" />
                    </button>
                    
                    {showExportMenu && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                             {isOnlineGraph && (
                                <button 
                                    onClick={handleShareLink}
                                    className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-center gap-3 transition-colors text-blue-600"
                                >
                                    {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                    <span className="font-sans text-sm font-medium">
                                        {copiedLink ? "Link másolva!" : "Link másolása"}
                                    </span>
                                </button>
                             )}

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

                 {folderHandle && (
                     <button 
                        onClick={handleManualSave}
                        className={`transition-colors ${isSaving ? 'text-accent' : 'text-[#D1D1D1] hover:text-ink'}`}
                        title={isOnlineGraph ? "Mentés helyi másolatként" : "Mentés mappába"}
                    >
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    </button>
                 )}

                <button 
                onClick={goHome}
                className="text-[#D1D1D1] hover:text-ink transition-colors"
                title="Főoldal"
                >
                    <Home className="w-6 h-6" />
                </button>
            </>
        )}
        
        <button 
        onClick={() => setShowInfo(true)}
        className="text-[#D1D1D1] hover:text-ink transition-colors"
        title="Info"
        >
            <Info className="w-6 h-6" />
        </button>
      </div>

      <SidebarPanel 
        savedGraphs={savedGraphs}
        onlineLibrary={onlineLibrary}
        isOpen={isSidebarOpen && !hasSearched}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onLoadGraph={loadSavedGraph}
        onLoadOnlineGraph={loadOnlineGraphItem}
        onDeleteGraph={deleteGraph}
        onRenameGraph={renameGraph}
        onUpdateIcon={updateGraphIcon}
        onCreateFolder={handleCreateFolder}
        onMoveGraph={handleMoveGraph}
        folderName={folderName}
        isMobile={isMobile}
        onConnectFolder={handleConnectFolder}
        onDisconnectFolder={disconnectFolder}
        onImportGraph={triggerFileUpload}
        isFolderConnected={!!folderHandle}
      />

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
                              A SophiaSysteme a görög bölcsesség (sophia) és a francia rendszer (systéme) szó összegyúrásából keletkezett. Ez egy kísérleti tanulási felület.
                          </p>
                          <ul className="list-disc pl-5 space-y-2 text-base">
                              <li>Nyomd meg az <b>F</b> betűt a gráfban kereséshez.</li>
                              <li>Nyomd meg a <b>Q</b> betűt a vázlat/oldalsáv megnyitásához.</li>
                              <li>Csatlakoztass egy helyi mappát a mappák kezeléséhez.</li>
                              <li><b>Online Könyvtár:</b> Tölts be gráfokat a közösségi tárból a fájlok menüben!</li>
                          </ul>
                          <p className="text-base text-secondary pt-4 font-sans">
                              0.4.5 verzió (GitHub Online támogatás).
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <main className="flex-1 relative flex flex-row overflow-hidden">
        {!hasSearched && !loading && (
            <div className="absolute inset-0 overflow-y-auto bg-paper z-30">
                <div className="max-w-4xl mx-auto px-6 py-28 flex flex-col items-center text-center">
                    <div className="mb-16 w-full max-w-2xl">
                        <h2 className="text-5xl md:text-7xl font-serif text-ink mb-8 font-light">
                            A filozófia <span className="text-accent italic">rendszerei</span>
                        </h2>
                        
                        <div className="w-full relative group mb-4">
                             {uploadedFile && (
                                 <div className="absolute -top-10 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                     <div className="bg-stone-100 border border-stone-300 text-ink text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                                         <File className="w-4 h-4 text-accent" />
                                         <span className="font-medium max-w-[200px] truncate">{uploadedFile.name}</span>
                                         <button onClick={clearUploadedFile} className="hover:text-red-500 transition-colors">
                                             <X className="w-4 h-4" />
                                         </button>
                                     </div>
                                 </div>
                             )}

                             <form onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={uploadedFile ? "Opcionális: írj egy fókuszt a dokumentumhoz..." : "Írj ide egy filozófiai témát, vagy tölts fel egy könyvet..."}
                                    className="w-full pl-14 pr-24 py-4 bg-white border border-stone-300 rounded-full text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-serif shadow-lg transition-all hover:shadow-xl placeholder:text-stone-400 text-ink"
                                    autoFocus
                                />
                                <Search className="absolute left-5 top-5 w-6 h-6 text-stone-400 group-hover:text-accent transition-colors" />
                                
                                <div className="absolute right-3 top-3 flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        ref={documentInputRef}
                                        onChange={handleDocumentSelect}
                                        accept=".pdf,.txt,.md"
                                        className="hidden" 
                                    />
                                    <button 
                                        type="button"
                                        onClick={triggerDocumentUpload}
                                        className="p-2 text-stone-400 hover:text-ink hover:bg-stone-100 rounded-full transition-colors"
                                        title="Dokumentum csatolása (PDF, TXT)"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>

                                    <button 
                                        type="submit" 
                                        disabled={!query && !uploadedFile}
                                        className="p-2 bg-ink text-white rounded-full disabled:opacity-50 hover:bg-accent transition-colors shadow-md"
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
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
                </div>
            </div>
        )}

        {loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm z-50">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="font-serif text-xl animate-pulse">
                    {uploadedFile ? "Dokumentum elemzése..." : (isOnlineGraph ? "Online gráf betöltése..." : "Kapcsolatok létrehozása...")}
                </p>
                <p className="text-sm text-secondary mt-2 font-sans">
                    {uploadedFile ? "Nagyobb fájloknál ez eltarthat egy ideig." : ""}
                </p>
             </div>
        )}

        {error && (
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                 <div className="bg-white p-6 rounded-lg shadow-xl border border-red-100 max-w-md text-center pointer-events-auto">
                    <p className="text-accent font-medium mb-4">{error}</p>
                    <button 
                        onClick={() => { setError(null); setHasSearched(false); setIsOnlineGraph(false); }}
                        className="px-4 py-2 bg-ink text-white rounded hover:bg-stone-700 transition-colors font-sans text-sm"
                    >
                        Vissza a főoldalra
                    </button>
                 </div>
            </div>
        )}

        {data && !loading && (
           <OutlinePanel 
             nodes={data.nodes}
             order={data.customOrder || []}
             isOpen={isOutlineOpen}
             onToggle={() => setIsOutlineOpen(!isOutlineOpen)}
             onNodeClick={focusOnNodeById}
             onOrderChange={handleOrderChange}
             selectedNodeId={selectedNode?.id || null}
             isMobile={isMobile}
           />
        )}

        {data && !loading && (
            <div className={`flex-1 relative h-full w-full transition-all duration-300 ${isOutlineOpen && !isMobile ? 'ml-80' : ''}`}>
               <ConceptGraph 
                 ref={graphRef}
                 data={data} 
                 onNodeClick={handleNodeClick}
                 selectedNodeId={selectedNode?.id || null}
                 searchTerm={graphSearchQuery}
               />
            </div>
        )}

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
