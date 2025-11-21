
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Info, ChevronRight, ChevronLeft, X, Home, ArrowRight, Trash2, Edit2, Eye, Check } from 'lucide-react';
import ConceptGraph, { ConceptGraphHandle } from './components/ConceptGraph';
import DetailPanel from './components/DetailPanel';
import { fetchPhilosophyData } from './services/geminiService';
import { GraphData, PhilosophicalNode, NodeType } from './types';

interface SavedGraph {
  id: string;
  topic: string;
  date: string;
  data: GraphData;
}

const ALL_SUGGESTIONS = [
    'sztoicizmus', 'Platón', 'etika', 'egzisztencializmus', 'kategorikus imperatívusz',
    'Nietzsche', 'arisztotelészi logika', 'utilitarizmus', 'fenomenológia', 'Heidegger',
    'Spinoza etikája', 'Schopenhauer', 'metafizika', 'episztemológia', 'Társadalmi szerződés'
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
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Tour State
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourPath, setTourPath] = useState<string[]>([]);
  const [tourIndex, setTourIndex] = useState(-1);

  const graphRef = useRef<ConceptGraphHandle>(null);

  // Randomize suggestions on mount
  useEffect(() => {
      const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
      setCurrentSuggestions(shuffled.slice(0, 5));
  }, []);

  // Load saved graphs on mount
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

  const autoSaveGraph = (topic: string, graphData: GraphData) => {
    const exists = savedGraphs.some(g => g.topic.toLowerCase() === topic.toLowerCase());
    if (exists) return;

    const newGraph: SavedGraph = {
      id: Date.now().toString(),
      topic: topic.charAt(0).toUpperCase() + topic.slice(1),
      date: new Date().toLocaleDateString('hu-HU'),
      data: graphData
    };

    const updated = [newGraph, ...savedGraphs];
    setSavedGraphs(updated);
    localStorage.setItem('sophia_saved_graphs', JSON.stringify(updated));
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

  const generateTourPath = (graph: GraphData): string[] => {
    if (!graph.nodes.length) return [];
    
    const root = graph.nodes.find(n => n.type === NodeType.ROOT) || graph.nodes[0];
    const visited = new Set<string>();
    const path: string[] = [];
    
    const getChildren = (parentId: string) => {
      return graph.links
        .filter(l => l.source === parentId)
        .map(l => l.target);
    };

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      path.push(nodeId);
      
      const children = getChildren(nodeId);
      const childNodes = children
        .map(id => graph.nodes.find(n => n.id === id))
        .filter(n => n !== undefined) as PhilosophicalNode[];
        
      childNodes.sort((a, b) => {
        const typeScore = { [NodeType.CATEGORY]: 1, [NodeType.CONCEPT]: 2, [NodeType.WORK]: 3, [NodeType.ROOT]: 0 };
        return (typeScore[a.type] || 99) - (typeScore[b.type] || 99);
      });

      childNodes.forEach(child => traverse(child.id));
    };

    traverse(root.id);
    graph.nodes.forEach(n => {
      if (!visited.has(n.id)) path.push(n.id);
    });

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
    setTourIndex(-1);
    graphRef.current?.resetZoom();
  };

  const focusOnNodeById = (id: string) => {
    if (!data) return;
    const node = data.nodes.find(n => n.id === id);
    if (node) {
      setSelectedNode(node);
      // Calculate offset based on screen size. 
      // If screen width > 768px (md breakpoint), we assume detail panel is approx 480px.
      // Otherwise (mobile), panel covers screen or is distinct, standard centering often better, or 0 offset.
      const offset = window.innerWidth >= 768 ? 480 : 0;
      graphRef.current?.focusNode(id, offset);
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
    setSelectedNode(pNode);

    // When clicking manually, we assume the user wants to focus on it with the panel open.
    // Apply the offset logic same as focusOnNodeById
    const offset = window.innerWidth >= 768 ? 480 : 0;
    // We use a slight timeout or just call it to ensure visual focus shifts if we want that behavior on click
    // However, graph handles click internally for highlighting, but maybe not centering. 
    // If you want to center on click:
    // graphRef.current?.focusNode(pNode.id, offset);
    // For now, we just handle state.

    // Fix for Tour Mode: If user clicks a node during tour, sync index or stop tour
    if (isTourActive) {
        const indexInPath = tourPath.indexOf(pNode.id);
        if (indexInPath !== -1) {
            setTourIndex(indexInPath);
        } else {
            stopTour();
        }
    }
  }, [isTourActive, tourPath]);

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
      <div className="absolute top-4 right-6 z-50 flex gap-4 items-center pointer-events-auto">
        {data && !loading && (
                <button 
                  onClick={goHome}
                  className="text-[#D1D1D1] hover:text-ink transition-colors"
                  title="Főoldal"
                >
                    <Home className="w-6 h-6" />
                </button>
        )}
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
              {/* A doboz flex-col lett, hogy a fejléc és tartalom egymás alatt legyen, és max-h-[90vh]-t kapott */}
              <div 
                className="bg-paper max-w-lg w-full rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
              >
                  
                  {/* FEJLÉC: Ez mindig látszik, nem görög el. shrink-0 miatt nem nyomódik össze */}
                  <div className="p-6 md:p-8 flex justify-between items-center border-b border-stone-200 bg-paper shrink-0">
                      <h2 className="text-2xl font-serif font-bold text-ink">SophiaSysteme</h2>
                      <button onClick={() => setShowInfo(false)} className="text-secondary hover:text-ink p-1">
                          <X size={24} /> 
                      </button>
                  </div>

                  {/* TARTALOM: Ez a rész görgethető, ha nem fér ki a képernyőre */}
                  <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                      <div className="space-y-4 font-serif text-lg text-ink/80 leading-relaxed">
                          <p>
                              A SophiaSysteme a görög bölcsesség (sophia) és a francia rendszer (systéme) szó összegyúrásából keletkezett. Ez egy kísérleti tanulási felület, amely gráfok segítségével igyekszik vizualizálni az összetett filozófiai rendszerek kapcsolódási pontjait és összefüggéseit.
                          </p>
                          <p>
                              A használat elég egyszerű: megadsz egy témát és a mesterséges intelligencia összeállítja neked a tartalmat. Ezután a bal egérgomb lenyomásával tudod mozgatni a térképet, a görgővel tudsz nagyítani, és a csomópontokra kattintva elolvashatod azok kifejtéseit. Az „Áttekintés” gombra kattintva, hierarchikusan, egyesével végigvezet a fogalmakon és koncepciókon.
                          </p>
                          <p>
                              Mivel a tartalomgenerálás MI alapú, így vannak korlátjai. Előfordulhatnak szakirodalomba nem illő fordítások, helytelen formázások, hibás könyvcímek vagy szokatlan fogalmi meghatározások (pl. Nietzschénél „a hatalom akarása” helyett „akarni a hatalmat” és hasonlók). Az eddigi teszteléseim alatt úgy láttam, hogy míg a relációs kapcsolatokat eltalálja a rendszer, addig a legnagyobb kihívása az egységes nyelvezetben és fogalommegjelölésekben van. Ettől függetlenül értékes tanulási kiegészítő lehet.
                          </p>
                          <p className="text-base text-secondary pt-4 font-sans">
                              0.1 verzió. 2025. november
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

                    {savedGraphs.length > 0 && (
                        <div className="w-full max-w-3xl text-left animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                            <h3 className="font-serif text-2xl text-ink mb-6 border-b border-stone-200 pb-2">Előzmények</h3>
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
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Loading State */}
        {loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm z-50">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="font-serif text-xl animate-pulse">Kapcsolatok létrehozása...</p>
                <p className="text-sm text-secondary mt-2 font-sans">Ez körülbelül 30 másodpercet vesz igénybe.</p>
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
             <div 
                className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur shadow-lg border border-stone-200 rounded-full flex items-center transition-all duration-500 ease-in-out overflow-hidden ${isTourActive ? 'w-[280px] h-[52px]' : 'w-[150px] h-[44px]'}`}
             >
                 <div className="relative w-full h-full">
                    
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
                   <div className={`absolute inset-0 flex items-center justify-between px-2 transition-opacity duration-300 ${isTourActive ? 'opacity-100 delay-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                      <button 
                        onClick={prevStep} 
                        disabled={tourIndex === 0}
                        className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-30 transition-colors shrink-0"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      <span className="font-serif text-lg text-center whitespace-nowrap">
                        {tourIndex + 1} / {tourPath.length}
                      </span>

                      <button 
                        onClick={nextStep}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors shrink-0"
                      >
                          {tourIndex === tourPath.length - 1 ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>

                      <div className="w-px h-6 bg-stone-300 mx-2 shrink-0" />

                      <button 
                        onClick={stopTour}
                        className="px-2 py-1 text-xs uppercase tracking-wider text-secondary hover:text-ink hover:bg-stone-100 rounded transition-colors font-sans whitespace-nowrap"
                      >
                        Kilépés
                      </button>
                   </div>
                 </div>
            </div>
        )}

        <div className="flex-1 relative bg-paper h-full min-w-0">
            <ConceptGraph 
                ref={graphRef}
                data={data} 
                onNodeClick={handleNodeClick}
            />
        </div>

        <DetailPanel 
            node={selectedNode} 
            allNodes={data?.nodes || []}
            onClose={() => setSelectedNode(null)} 
            onNavigate={(id) => focusOnNodeById(id)}
        />

      </main>
    </div>
  );
};

export default App;
