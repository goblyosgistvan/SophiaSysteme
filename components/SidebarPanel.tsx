
import React, { useState, useRef, useEffect } from 'react';
import { SavedGraph, LibraryItem } from '../types';
import { ChevronLeft, Folder, File, ChevronRight, ChevronDown, FolderPlus, Trash2, Edit2, FolderOpen, Upload, HardDrive, LogOut, Book, Star, Heart, Brain, Globe, Lightbulb, Zap, Feather, Anchor, Target, Music, Code, Smile, Coffee, Sun, Moon, Cloud, Snowflake, Umbrella, Rocket, Home, GraduationCap, Trophy, Crown, Diamond, Gavel, Scale, Sword, Shield, Scroll, Hourglass, Compass, Map, Key, Lock, Unlock, Eye, Fingerprint, Dna, Microscope, Telescope, Magnet, Calculator, Sigma, Pi, Box, Package, Layers, Grid, Circle, Triangle, Square, Hexagon, Scissors, Bell, Clock, Calendar, Camera, Video, Mic, Speaker, Headphones, Monitor, Smartphone, Watch, Printer, Wifi, Battery, Plug, Trash, Archive, Inbox, Mail, MessageCircle, User, Users, Spade, Club, Gamepad2, Ghost, Skull, Palette, FlaskConical, Atom, Leaf, Flame, Droplets, DownloadCloud, ExternalLink } from 'lucide-react';

interface SidebarPanelProps {
  savedGraphs: SavedGraph[];
  onlineLibrary: LibraryItem[]; // New prop
  isOpen: boolean;
  onToggle: () => void;
  onLoadGraph: (graph: SavedGraph) => void;
  onLoadOnlineGraph: (item: LibraryItem) => void; // New prop
  onDeleteGraph: (id: string) => void;
  onRenameGraph: (id: string, newName: string) => void;
  onUpdateIcon: (id: string, newIcon: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onMoveGraph: (graphId: string, targetPath: string) => void;
  folderName: string | null;
  isMobile: boolean;
  onConnectFolder: () => void;
  onDisconnectFolder: () => void;
  onImportGraph: () => void;
  isFolderConnected: boolean;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: FileNode[];
  data?: SavedGraph;
}

const AVAILABLE_ICONS = [
    { id: 'default', icon: File },
    { id: 'book', icon: Book },
    { id: 'star', icon: Star },
    { id: 'heart', icon: Heart },
    { id: 'brain', icon: Brain },
    { id: 'globe', icon: Globe },
    { id: 'lightbulb', icon: Lightbulb },
    { id: 'zap', icon: Zap },
    { id: 'feather', icon: Feather },
    { id: 'anchor', icon: Anchor },
    { id: 'target', icon: Target },
    { id: 'code', icon: Code },
    { id: 'music', icon: Music },
    { id: 'palette', icon: Palette },
    { id: 'flask', icon: FlaskConical },
    { id: 'atom', icon: Atom },
    { id: 'leaf', icon: Leaf },
    { id: 'flame', icon: Flame },
    { id: 'drop', icon: Droplets },
    { id: 'sun', icon: Sun },
    { id: 'moon', icon: Moon },
    { id: 'cloud', icon: Cloud },
    { id: 'snow', icon: Snowflake },
    { id: 'umbrella', icon: Umbrella },
    { id: 'smile', icon: Smile },
    { id: 'coffee', icon: Coffee },
    { id: 'rocket', icon: Rocket },
    { id: 'home', icon: Home },
    { id: 'grad', icon: GraduationCap },
    { id: 'trophy', icon: Trophy },
    { id: 'crown', icon: Crown },
    { id: 'diamond', icon: Diamond },
    { id: 'gavel', icon: Gavel },
    { id: 'scale', icon: Scale },
    { id: 'sword', icon: Sword },
    { id: 'shield', icon: Shield },
    { id: 'scroll', icon: Scroll },
    { id: 'hourglass', icon: Hourglass },
    { id: 'compass', icon: Compass },
    { id: 'map', icon: Map },
    { id: 'key', icon: Key },
    { id: 'lock', icon: Lock },
    { id: 'unlock', icon: Unlock },
    { id: 'eye', icon: Eye },
    { id: 'fingerprint', icon: Fingerprint },
    { id: 'dna', icon: Dna },
    { id: 'microscope', icon: Microscope },
    { id: 'telescope', icon: Telescope },
    { id: 'magnet', icon: Magnet },
    { id: 'calc', icon: Calculator },
    { id: 'sigma', icon: Sigma },
    { id: 'pi', icon: Pi },
    { id: 'box', icon: Box },
    { id: 'package', icon: Package },
    { id: 'layers', icon: Layers },
    { id: 'grid', icon: Grid },
    { id: 'circle', icon: Circle },
    { id: 'triangle', icon: Triangle },
    { id: 'square', icon: Square },
    { id: 'hexagon', icon: Hexagon },
    { id: 'scissors', icon: Scissors },
    { id: 'bell', icon: Bell },
    { id: 'clock', icon: Clock },
    { id: 'calendar', icon: Calendar },
    { id: 'camera', icon: Camera },
    { id: 'video', icon: Video },
    { id: 'mic', icon: Mic },
    { id: 'speaker', icon: Speaker },
    { id: 'headphone', icon: Headphones },
    { id: 'monitor', icon: Monitor },
    { id: 'phone', icon: Smartphone },
    { id: 'watch', icon: Watch },
    { id: 'printer', icon: Printer },
    { id: 'wifi', icon: Wifi },
    { id: 'battery', icon: Battery },
    { id: 'plug', icon: Plug },
    { id: 'trash', icon: Trash },
    { id: 'archive', icon: Archive },
    { id: 'inbox', icon: Inbox },
    { id: 'mail', icon: Mail },
    { id: 'msg', icon: MessageCircle },
    { id: 'user', icon: User },
    { id: 'users', icon: Users },
    { id: 'spade', icon: Spade },
    { id: 'club', icon: Club },
    { id: 'game', icon: Gamepad2 },
    { id: 'ghost', icon: Ghost },
    { id: 'skull', icon: Skull },
];

const SidebarPanel: React.FC<SidebarPanelProps> = ({
  savedGraphs,
  onlineLibrary,
  isOpen,
  onToggle,
  onLoadGraph,
  onLoadOnlineGraph,
  onDeleteGraph,
  onRenameGraph,
  onUpdateIcon,
  onCreateFolder,
  onMoveGraph,
  folderName,
  isMobile,
  onConnectFolder,
  onDisconnectFolder,
  onImportGraph,
  isFolderConnected
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([''])); // Root expanded by default
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedGraphId, setDraggedGraphId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'online'>('local');
  
  // Icon selector state
  const [showIconSelector, setShowIconSelector] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
        renameInputRef.current.focus();
    }
  }, [renamingId]);

  // Clean up icon selector when exiting rename mode
  useEffect(() => {
    if (!renamingId) {
        setShowIconSelector(null);
    }
  }, [renamingId]);

  // Build Tree Structure
  const buildTree = (graphs: SavedGraph[]): FileNode => {
    const root: FileNode = { name: 'Root', path: '', type: 'folder', children: [] };
    
    // Create folders explicitly if needed or implied from paths
    // For this implementation, we infer folders from the paths in SavedGraph
    
    graphs.forEach(graph => {
        const parts = graph.path ? graph.path.split('/') : [];
        let currentLevel = root.children;
        let currentPath = '';

        // Navigate/Create folders
        parts.forEach((part, index) => {
             currentPath = currentPath ? `${currentPath}/${part}` : part;
             let folder = currentLevel.find(n => n.name === part && n.type === 'folder');
             if (!folder) {
                 folder = { name: part, path: currentPath, type: 'folder', children: [] };
                 currentLevel.push(folder);
             }
             currentLevel = folder.children;
        });

        // Add File
        currentLevel.push({
            name: graph.topic,
            path: graph.path,
            type: 'file',
            children: [],
            data: graph
        });
    });

    // Sort: Folders first, then files, alphabetically
    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(root.children);
    return root;
  };

  const fileTree = buildTree(savedGraphs);

  const toggleFolder = (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedFolders);
      if (newSet.has(path)) {
          newSet.delete(path);
      } else {
          newSet.add(path);
      }
      setExpandedFolders(newSet);
  };

  const handleDragStart = (e: React.DragEvent, graphId: string) => {
      setDraggedGraphId(graphId);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
      e.preventDefault();
      if (draggedGraphId) {
          onMoveGraph(draggedGraphId, targetPath);
          setDraggedGraphId(null);
      }
  };
  
  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
      e.preventDefault();
      onRenameGraph(id, renameValue);
      setRenamingId(null);
  };

  const handleIconSelect = (graphId: string, iconId: string) => {
      onUpdateIcon(graphId, iconId);
      setShowIconSelector(null);
      // Return focus to input
      setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const getIconComponent = (iconId?: string) => {
      const found = AVAILABLE_ICONS.find(i => i.id === iconId);
      return found ? found.icon : File;
  }

  const renderNode = (node: FileNode) => {
     if (node.type === 'folder') {
         const isExpanded = expandedFolders.has(node.path);
         // Check if folder contains valid children (filter out placeholders for display count)
         const hasChildren = node.children.some(c => c.type === 'folder' || (c.type === 'file' && c.data?.topic !== '.keep'));
         
         return (
             <div key={node.path || 'root'} className="pl-2">
                 <div 
                    className={`
                        flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer select-none transition-colors
                        ${draggedGraphId ? 'hover:bg-accent/10 border border-transparent hover:border-accent/30' : 'hover:bg-stone-100'}
                    `}
                    onClick={(e) => toggleFolder(node.path, e)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, node.path)}
                 >
                     <span className="text-secondary">
                         {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                     </span>
                     <span className="text-accent/80">
                         {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                     </span>
                     <span className="text-sm font-medium text-ink truncate">{node.name}</span>
                 </div>
                 {isExpanded && (
                     <div className="pl-4 border-l border-stone-200 ml-3">
                         {hasChildren || node.children.length > 0 ? (
                             node.children.map(child => renderNode(child))
                         ) : (
                             <div className="py-1 px-2 text-xs text-stone-400 italic">Üres mappa</div>
                         )}
                     </div>
                 )}
             </div>
         );
     } else {
         const graph = node.data!;
         
         // Don't render placeholder files in the list
         if (graph.topic === '.keep') return null;

         const isRenaming = renamingId === graph.id;
         const IconComp = getIconComponent(graph.icon);
         
         return (
             <div 
                key={graph.id} 
                className="flex items-center justify-between group py-1.5 px-2 rounded-md hover:bg-stone-100 cursor-pointer pl-6 relative"
                onClick={() => onLoadGraph(graph)}
                draggable
                onDragStart={(e) => handleDragStart(e, graph.id)}
             >
                 <div className="flex items-center gap-2 min-w-0 flex-1 h-5">
                     
                     {/* Icon or Icon Selector */}
                     {isRenaming ? (
                         <div className="relative flex items-center">
                             <button 
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // CRITICAL: Prevents input blur
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowIconSelector(showIconSelector === graph.id ? null : graph.id);
                                }}
                                className="p-0.5 hover:bg-stone-200 rounded cursor-pointer"
                             >
                                 <IconComp size={14} className="text-accent" />
                             </button>
                             
                             {showIconSelector === graph.id && (
                                 <div className="absolute top-full left-0 mt-2 bg-white border border-stone-200 shadow-xl rounded-lg p-3 z-50 grid grid-cols-6 gap-2 min-w-[240px] h-[200px] overflow-y-auto custom-scrollbar">
                                     {AVAILABLE_ICONS.map(({id, icon: I}) => (
                                         <button
                                            key={id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()} // Keep focus
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleIconSelect(graph.id, id);
                                            }}
                                            className={`p-1.5 rounded hover:bg-stone-100 flex justify-center items-center ${graph.icon === id ? 'bg-accent/10 text-accent' : 'text-stone-500'}`}
                                            title={id}
                                         >
                                             <I size={16} />
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>
                     ) : (
                        <IconComp size={14} className={`shrink-0 ${graph.icon ? 'text-accent' : 'text-stone-400'}`} />
                     )}

                     {/* Name or Rename Input */}
                     {isRenaming ? (
                        <form onSubmit={(e) => handleRenameSubmit(e, graph.id)} onClick={e => e.stopPropagation()} className="flex-1 flex items-center">
                             <input 
                                ref={renameInputRef}
                                type="text" 
                                value={renameValue} 
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => { 
                                    // Only close if we are not interacting with the icon selector
                                    if(!showIconSelector) {
                                        setRenamingId(null);
                                    }
                                }}
                                className="w-full bg-white border border-accent rounded px-1 h-5 text-sm font-serif focus:outline-none leading-none m-0 mb-0 pb-0"
                             />
                        </form>
                     ) : (
                        <span className="text-sm font-serif text-ink truncate leading-tight" title={node.name}>{node.name}</span>
                     )}
                 </div>
                 
                 {!isRenaming && (
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setRenamingId(graph.id); setRenameValue(graph.topic); }}
                            className="p-1 hover:text-ink text-stone-400"
                        >
                            <Edit2 size={12} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteGraph(graph.id); }}
                            className="p-1 hover:text-red-500 text-stone-400"
                        >
                            <Trash2 size={12} />
                        </button>
                     </div>
                 )}
             </div>
         );
     }
  };

  const containerClasses = isOpen 
    ? "translate-x-0 opacity-100" 
    : "-translate-x-full opacity-0 pointer-events-none";

  const widthClass = isMobile ? "w-[85vw]" : "w-80";

  return (
      <div 
        className={`fixed top-0 bottom-0 left-0 bg-paper/95 backdrop-blur-sm border-r border-stone-200 shadow-2xl z-[80] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col ${widthClass} ${containerClasses}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
           <div>
               <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-ink mb-1">Fájlok</h3>
               {folderName && activeTab === 'local' && (
                   <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 flex items-center gap-1 w-fit">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                       {folderName}
                   </span>
               )}
           </div>
           <button 
             onClick={onToggle}
             className="p-1.5 hover:bg-stone-200 rounded-full text-secondary transition-colors"
           >
             <ChevronLeft className="w-5 h-5" />
           </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 border-b border-stone-200 bg-stone-50/50">
            <button
                onClick={() => setActiveTab('local')}
                className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${activeTab === 'local' ? 'bg-white shadow-sm text-ink text-accent' : 'text-secondary hover:bg-stone-200'}`}
            >
                Helyi
            </button>
            <button
                onClick={() => setActiveTab('online')}
                className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${activeTab === 'online' ? 'bg-white shadow-sm text-ink text-blue-600' : 'text-secondary hover:bg-stone-200'}`}
            >
                Online Könyvtár
            </button>
        </div>

        {activeTab === 'local' ? (
            <>
                <div className="p-2 border-b border-stone-200 flex gap-2">
                    <button 
                        onClick={() => onCreateFolder("")}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white border border-stone-300 rounded text-xs font-medium text-stone-600 hover:border-accent hover:text-accent transition-colors"
                    >
                        <FolderPlus size={14} />
                        Új Mappa
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {/* Render Root Children Directly */}
                    {fileTree.children.map(child => renderNode(child))}
                    
                    {savedGraphs.length === 0 && (
                        <div className="text-center py-8 text-stone-400 text-sm italic">
                            Nincs mentett gráf.
                        </div>
                    )}
                </div>

                {/* --- Sidebar Footer (Tools) --- */}
                <div className="p-4 border-t border-stone-200 bg-stone-50/50 space-y-2">
                    {!isFolderConnected ? (
                        <button 
                            onClick={onConnectFolder}
                            className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium text-ink hover:bg-white hover:shadow-sm rounded transition-all"
                        >
                            <HardDrive className="w-4 h-4 text-secondary" />
                            Mappa csatolása
                        </button>
                    ) : (
                        <button 
                            onClick={onDisconnectFolder}
                            className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Mappa leválasztása
                        </button>
                    )}
                    
                    <button 
                        onClick={onImportGraph}
                        className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium text-ink hover:bg-white hover:shadow-sm rounded transition-all"
                    >
                        <Upload className="w-4 h-4 text-secondary" />
                        Importálás (.json)
                    </button>
                </div>
            </>
        ) : (
            // --- ONLINE LIBRARY VIEW ---
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="mb-4 px-2 pt-2">
                    <p className="text-xs text-secondary leading-relaxed">
                        A GitHub-on tárolt közösségi tudástár elemei. Ezeket megnyitva mentheted őket a saját gépedre.
                    </p>
                </div>

                {onlineLibrary.length > 0 ? (
                    <div className="space-y-1">
                        {onlineLibrary.map((item, index) => {
                            const IconComp = getIconComponent(item.icon);
                            return (
                                <div 
                                    key={index}
                                    onClick={() => onLoadOnlineGraph(item)}
                                    className="group p-3 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md">
                                            <IconComp size={16} />
                                        </div>
                                        <h4 className="font-serif text-ink font-medium">{item.title}</h4>
                                    </div>
                                    <p className="text-xs text-secondary pl-[38px] line-clamp-2">{item.description}</p>
                                    <div className="flex items-center gap-2 pl-[38px] mt-2">
                                        <span className="text-[10px] uppercase tracking-wider text-blue-400 bg-white border border-blue-100 px-1.5 py-0.5 rounded">
                                            {item.category}
                                        </span>
                                        <span className="text-[10px] text-stone-400 ml-auto">
                                            {item.added}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     <div className="text-center py-12 px-4">
                        <DownloadCloud className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                        <p className="text-sm text-stone-500 font-medium">A könyvtár betöltése...</p>
                        <p className="text-xs text-stone-400 mt-1">Ha nem jelenik meg semmi, ellenőrizd, hogy a <code>public/library/index.json</code> elérhető-e.</p>
                    </div>
                )}
                
                <div className="mt-8 p-4 bg-stone-100 rounded-lg text-center">
                    <ExternalLink className="w-5 h-5 text-stone-400 mx-auto mb-2" />
                    <p className="text-xs text-stone-500 mb-2">Szeretnél hozzájárulni?</p>
                    <a href="https://github.com" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
                        Pull Request küldése GitHubon
                    </a>
                </div>
            </div>
        )}
      </div>
  );
};

export default SidebarPanel;
