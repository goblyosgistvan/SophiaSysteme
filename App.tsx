
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Info, ChevronRight, ChevronLeft, X, Home, ArrowRight, Trash2, Edit2, Eye, Check, Download, Plus, Send } from 'lucide-react';
import ConceptGraph, { ConceptGraphHandle } from './components/ConceptGraph';
import DetailPanel from './components/DetailPanel';
import { fetchPhilosophyData, augmentPhilosophyData, enrichNodeData } from './services/geminiService';
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

// Mock data for testing (Schopenhauer)
const MOCK_DATA: GraphData = {
  "nodes": [
    {
      "id": "schopenhauer_main",
      "label": "Schopenhauer",
      "type": "ROOT" as NodeType,
      "shortSummary": "A 19. századi pesszimizmus és az akaratmetafizika atyja.",
      "longExplanation": "Arthur Schopenhauer (1788–1860) a német filozófia egyik legmeghatározóbb alakja, aki radikálisan szembehelyezkedett a korabeli német idealizmussal, különösen Hegellel. Központi gondolata, hogy a világ lényege nem az ész vagy a szellem, hanem egy vak, irracionális és kielégíthetetlen erő: az Akarat. Ez a felismerés vezette el híres pesszimizmusához, mely szerint az élet alapvetően szenvedés, mivel a vágyak sosem elégíthetők ki tartósan.\n\nRendszere nagy hatást gyakorolt a későbbi életfilozófiákra, a pszichoanalízisre (Freud), a művészetelméletre, valamint olyan gondolkodókra és művészekre, mint Nietzsche, Wagner, Wittgenstein vagy Thomas Mann. Filozófiája a keleti gondolkodás (buddhizmus, upanisadok) és a nyugati metafizika (Platón, Kant) egyedülálló szintézise.",
      "connections": ["akarat", "kepzet", "szenvedes", "reszvet", "esztetika", "aszkezis"]
    },
    {
      "id": "akarat",
      "label": "akarat",
      "type": "CONCEPT" as NodeType,
      "shortSummary": "A világ dologi magja (Kant magánvalója), egy vak ösztön.",
      "longExplanation": "Schopenhauer filozófiájában az „akarat” (Wille) nem a tudatos emberi szándékot jelenti, hanem egy kozmikus, metafizikai ős-erőt. Ez a világ „magánvalója” (Ding an sich), ami minden jelenség mögött meghúzódik. Ez az erő egységes, oszthatatlan, tér és idő nélküli, és minden létezőben (a gravitációtól az emberi vágyig) ez nyilvánul meg.\n\nAz akarat lényege a hiány és a törekvés. Mivel vak és céltalan, soha nem érhet el végső kielégülést. Ez a szüntelen, kielégíthetetlen hajtóerő okozza a világban tapasztalható küzdelmet és szenvedést. Az egyénben ez az életösztönként, a fajfenntartás ösztönében és az önzésben jelenik meg leginkább.",
      "conceptContext": "Szemben Hegel „Világszellemével”, ami racionális, Schopenhauer Akarata irracionális. Párhuzam vonható a freudi „Ösztön-én” (Id) fogalmával.",
      "connections": ["schopenhauer_main", "szenvedes", "kepzet", "test"]
    },
    {
      "id": "kepzet",
      "label": "képzet",
      "type": "CONCEPT" as NodeType,
      "shortSummary": "A világ, ahogyan az a tudatunkban megjelenik (jelenség).",
      "longExplanation": "A „képzet” (Vorstellung) a világ objektív oldala, vagyis az a mód, ahogyan a valóság a megismerő alany számára megjelenik. Ez a kanti „jelenségvilágnak” felel meg. A képzet világa alá van vetve az „elégséges alap elvének” (tér, idő, okság), tehát itt minden determinált és szükségszerű.\n\nAmikor a világot vizsgáljuk, tudományosan leírjuk, akkor a képzetek világában mozgunk. Schopenhauer szerint ez a világ azonban csak „Májá fátyla” (illúzió), amely elfedi előlünk a valóság igazi természetét, az egységes akaratot, és azt az illúziót kelti, hogy sok, egymástól elkülönült egyed (individuum) létezik.",
      "conceptContext": "Kant ismeretelméletére épül, de Schopenhauer egyszerűsíti Kant kategóriarendszerét az okságra.",
      "connections": ["schopenhauer_main", "akarat", "maja_fatyla"]
    },
    {
      "id": "szenvedes",
      "label": "szenvedés",
      "type": "CONCEPT" as NodeType,
      "shortSummary": "Az élet alapvető állapota az akarat kielégíthetetlensége miatt.",
      "longExplanation": "Mivel az ember lényege az akarat (vágy), és a vágy mindig valamilyen hiányból fakad, az emberi lét alapállapota a fájdalom. Ha egy vágy teljesül, az csak átmeneti enyhülést hoz, amit hamarosan felvált az unalom vagy egy újabb vágy. Így az élet egy inga, amely a fájdalom és az unalom között leng.\n\nA boldogság Schopenhauer szerint sosem pozitív állapot, hanem csak a szenvedés átmeneti hiánya (negatív jellegű). Ez a pesszimista diagnózis a kiindulópontja az etikai és esztétikai megváltástannak.",
      "conceptContext": "Erős párhuzam a buddhizmus Négy Nemes Igazságának első pontjával („minden élet szenvedés”).",
      "connections": ["schopenhauer_main", "akarat", "unalom"]
    },
    {
      "id": "esztetika",
      "label": "esztétikai szemlélődés",
      "type": "CATEGORY" as NodeType,
      "shortSummary": "Az ideiglenes megváltás a szenvedéstől a művészet által.",
      "longExplanation": "A művészet az a terület, ahol az ember képes – ha csak rövid időre is – megszabadulni az akarat uralmától. Az esztétikai élmény során „tiszta, akarat nélküli megismerő alannyá” válunk. Ilyenkor nem azt nézzük, hogy egy tárgy mire jó nekünk (érdek), hanem önmagában szemléljük azt.\n\nEbben az állapotban megszűnik a vágyakozás, és ezzel együtt a szenvedés is. A művészet tárgyai nem az egyedi dolgok, hanem a platóni ideák. A legmagasabb rendű művészet Schopenhauer szerint a zene, mert az nem az ideákat, hanem közvetlenül magát az akaratot fejezi ki.",
      "conceptContext": "Kant „érdek nélküli tetszés” fogalmának metafizikai kiterjesztése.",
      "connections": ["schopenhauer_main", "zene", "platoni_ideak"]
    },
    {
      "id": "aszkezis",
      "label": "aszkézis",
      "type": "CATEGORY" as NodeType,
      "shortSummary": "Az akarat tagadása, a végleges megváltás útja.",
      "longExplanation": "Míg a művészet csak átmeneti enyhülést ad, a végleges megszabadulás útja az „akarat tagadása” (Verneinung des Willens). Ez egy morális fordulat, ahol az ember felismeri, hogy minden szenvedés forrása az önzés és az élni akarás.\n\nAz aszkézis révén a szent ember tudatosan elfojtja magában az életösztönt, lemond a vágyakról, a szexualitásról és az egoizmusról. Ez az állapot a teljes lelki nyugalomhoz (nirvána) vezet, ahol az akarat elcsendesedik.",
      "conceptContext": "A keresztény misztika és a buddhista szerzetesi ideál filozófiai megfogalmazása.",
      "connections": ["schopenhauer_main", "reszvet", "nirvana"]
    },
    {
      "id": "reszvet",
      "label": "részvét",
      "type": "CONCEPT" as NodeType,
      "shortSummary": "Az erkölcs alapja: a másik szenvedésének átérzése.",
      "longExplanation": "Schopenhauer etikájának alapköve. Mivel metafizikai szinten minden egy (az Akarat egysége miatt), az egyéniség (principium individuationis) csak illúzió. A „Tat tvam asi” (Ez vagy te) ősi indiai elv alapján a másik ember szenvedése az én szenvedésem is.\n\nAz igazságosság és az emberbaráti szeretet forrása az a felismerés, hogy a másik emberrel lényegileg azonosak vagyunk. A részvét az, ami áttöri az önzés falát.",
      "conceptContext": "Kritikája Kant racionális kötelesséetikájának; az érzelemre alapozott etika.",
      "connections": ["schopenhauer_main", "aszkezis", "maja_fatyla"]
    },
    {
      "id": "mu",
      "label": "_A világ mint akarat és képzet_",
      "type": "WORK" as NodeType,
      "shortSummary": "Schopenhauer főműve (1818/1844).",
      "longExplanation": "Ebben a monumentális műben fejti ki Schopenhauer teljes rendszerét. A könyv négy könyvre oszlik: ismeretelmélet (világ mint képzet), metafizika (világ mint akarat), esztétika (művészet mint megváltás) és etika (akarat tagadása).\n\nA mű stílusa is híres: Schopenhauer kiváló író volt, aki a sötét tartalmat világos, irodalmi igényességű német nyelven fogalmazta meg.",
      "conceptContext": "",
      "connections": ["schopenhauer_main"]
    },
    {
      "id": "zene",
      "label": "zene",
      "type": "CONCEPT" as NodeType,
      "shortSummary": "A művészetek csúcsa, az akarat közvetlen képmása.",
      "longExplanation": "A többi művészet (építészet, szobrászat, festészet, költészet) csak az ideákat ábrázolja, amelyek az akarat objektivációi. A zene azonban kivétel: nem a jelenségvilágot másolja, hanem magának az akaratnak a mozgását, dinamikáját, örömét és fájdalmát fejezi ki közvetlenül.\n\nEzért van a zenének olyan elemi, mély hatása ránk. A zene a világ lényegének nyelve.",
      "conceptContext": "Ez az elmélet óriási hatással volt Richard Wagnerre.",
      "connections": ["esztetika", "akarat"]
    }
  ],
  "links": [
    { "source": "schopenhauer_main", "target": "akarat", "relationLabel": "alapfogalma" },
    { "source": "schopenhauer_main", "target": "kepzet", "relationLabel": "alapfogalma" },
    { "source": "akarat", "target": "szenvedes", "relationLabel": "okozza" },
    { "source": "szenvedes", "target": "unalom", "relationLabel": "váltakozik vele" },
    { "source": "schopenhauer_main", "target": "esztetika", "relationLabel": "megoldás 1" },
    { "source": "schopenhauer_main", "target": "aszkezis", "relationLabel": "megoldás 2" },
    { "source": "esztetika", "target": "zene", "relationLabel": "csúcspontja" },
    { "source": "aszkezis", "target": "reszvet", "relationLabel": "alapja" },
    { "source": "schopenhauer_main", "target": "mu", "relationLabel": "főműve" },
    { "source": "kepzet", "target": "akarat", "relationLabel": "takarja" },
    { "source": "reszvet", "target": "szenvedes", "relationLabel": "enyhíti" }
  ]
};

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhilosophicalNode | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  
  // Augment State
  const [showAugmentInput, setShowAugmentInput] = useState(false);
  const [augmentQuery, setAugmentQuery] = useState('');
  const [augmentLoading, setAugmentLoading] = useState(false);
  const augmentInputRef = useRef<HTMLInputElement>(null);

  // Node Regeneration State
  const [isRegeneratingNode, setIsRegeneratingNode] = useState(false);

  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Tour State
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourPath, setTourPath] = useState<string[]>([]);
  const [tourIndex, setTourIndex] = useState(-1);

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

  const getCleanFileName = (topic: string) => {
    return topic.replace(/[^a-z0-9áéíóöőúüű]/gi, '_').toLowerCase();
  };

  const handleExportMarkdown = () => {
    if (!data) return;

    const rootNode = data.nodes.find(n => n.type === NodeType.ROOT) || data.nodes[0];
    const categories = data.nodes.filter(n => n.type === NodeType.CATEGORY);
    const categorizedNodes: Record<string, PhilosophicalNode[]> = {};
    const uncategorizedNodes: PhilosophicalNode[] = [];
    const otherNodes = data.nodes.filter(n => n.type !== NodeType.ROOT && n.type !== NodeType.CATEGORY);

    otherNodes.forEach(node => {
        const parentCategory = categories.find(cat => 
            data.links.some(l => 
                (l.source === cat.id && l.target === node.id) || 
                (l.source === node.id && l.target === cat.id)
            )
        );
        if (parentCategory) {
            if (!categorizedNodes[parentCategory.id]) {
                categorizedNodes[parentCategory.id] = [];
            }
            categorizedNodes[parentCategory.id].push(node);
        } else {
            uncategorizedNodes.push(node);
        }
    });

    let content = `# ${rootNode.label.replace(/_/g, '')}\n\n`;
    content += `_Generálta: SophiaSysteme - ${new Date().toLocaleDateString('hu-HU')}_\n\n`;
    content += `${rootNode.shortSummary}\n\n`;
    content += `${rootNode.longExplanation}\n\n`;
    content += `---\n\n`;
    content += `## Tartalomjegyzék\n\n`;
    
    categories.forEach((cat, index) => {
        const cleanLabel = cat.label.replace(/_/g, '');
        const anchor = cleanLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        content += `- [${index + 1}. ${cleanLabel}](#${anchor})\n`;
        
        const children = categorizedNodes[cat.id] || [];
        children.forEach((child, childIndex) => {
             const childLabel = child.label.replace(/_/g, '');
             const childAnchor = childLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
             content += `\t- [${index + 1}.${childIndex + 1} ${childLabel}](#${childAnchor})\n`;
        });
    });
    
    content += `\n---\n\n`;

    categories.forEach((cat, index) => {
        const catNum = index + 1;
        const cleanLabel = cat.label.replace(/_/g, '');
        content += `### ${catNum}. ${cleanLabel}\n\n`;
        content += `**${cat.shortSummary}**\n\n`;
        content += `${cat.longExplanation}\n\n`;
        if (cat.conceptContext) {
             content += `> **Kontextus:** ${cat.conceptContext}\n\n`;
        }
        const children = categorizedNodes[cat.id] || [];
        children.forEach((child, childIndex) => {
            const childNum = `${catNum}.${childIndex + 1}`;
            const childLabel = child.label.replace(/_/g, '');
            content += `#### ${childNum} ${childLabel}\n\n`;
            content += `${child.longExplanation}\n\n`;
            if (child.conceptContext) {
                content += `> **Eszmetörténeti kontextus:**\n> ${child.conceptContext}\n\n`;
            }
        });
        content += `----\n\n`;
    });

    if (uncategorizedNodes.length > 0) {
        content += `### Egyéb kapcsolódó fogalmak\n\n`;
        uncategorizedNodes.forEach(node => {
             content += `#### ${node.label.replace(/_/g, '')}\n\n`;
             content += `${node.longExplanation}\n\n`;
        });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getCleanFileName(query)}_sophia_essze.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          // Optional: show specific error for augmentation
      } finally {
          setAugmentLoading(false);
      }
  };

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

  // --- Tour Logic (Robust Hermeneutic Sort) ---

  const generateTourPath = (graph: GraphData): string[] => {
    if (!graph.nodes.length) return [];

    const nodes = graph.nodes;
    const links = graph.links;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Helper to safely get ID from link source/target (which might be d3 objects or strings)
    const getId = (item: string | any) => typeof item === 'object' ? item.id : item;

    // 1. Build Adjacency List for BFS and Degree calculations
    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));
    links.forEach(l => {
        const s = getId(l.source);
        const t = getId(l.target);
        adj.get(s)?.push(t);
        adj.get(t)?.push(s);
    });

    // 2. Calculate Degree Centrality (Higher = More Fundamental/Central)
    const degrees = new Map<string, number>();
    nodes.forEach(n => degrees.set(n.id, (adj.get(n.id)?.length || 0)));

    // 3. Identify Structure (Root & Categories)
    const root = nodes.find(n => n.type === NodeType.ROOT);
    const categories = nodes.filter(n => n.type === NodeType.CATEGORY);
    
    // 4. Hermeneutic Clustering via BFS
    const assignments = new Map<string, { anchorId: string, distance: number }>();
    const queue: { id: string, anchorId: string, dist: number }[] = [];
    const visited = new Set<string>();

    // Priority: Categories define the contexts. Initialize BFS with all Categories.
    categories.forEach(c => {
        assignments.set(c.id, { anchorId: c.id, distance: 0 });
        queue.push({ id: c.id, anchorId: c.id, dist: 0 });
        visited.add(c.id);
    });

    // Run BFS to assign ownership
    while (queue.length > 0) {
        const { id, anchorId, dist } = queue.shift()!;
        const neighbors = adj.get(id) || [];

        for (const nextId of neighbors) {
             const nextNode = nodeMap.get(nextId);
             // Stop propagation at Root or other Categories (context boundaries)
             if (!nextNode || nextNode.type === NodeType.ROOT || nextNode.type === NodeType.CATEGORY) continue;

             if (!visited.has(nextId)) {
                 visited.add(nextId);
                 assignments.set(nextId, { anchorId, distance: dist + 1 });
                 queue.push({ id: nextId, anchorId, dist: dist + 1 });
             }
        }
    }

    // 5. Construct Path: Whole -> Parts -> Details (Hermeneutic Circle)
    const path: string[] = [];

    // A. The Whole (Root)
    if (root) path.push(root.id);

    // B. The Categories (Parts) - Sorted by Centrality
    const sortedCategories = [...categories].sort((a, b) => (degrees.get(b.id)||0) - (degrees.get(a.id)||0));

    sortedCategories.forEach(cat => {
        // 1. Visit the Category itself
        path.push(cat.id);
        
        // 2. Gather items belonging to this context
        const items = nodes.filter(n => {
            const assign = assignments.get(n.id);
            return assign && assign.anchorId === cat.id;
        });
        
        // 3. Sort items: Fundamental -> Complex
        items.sort((a, b) => {
            const distA = assignments.get(a.id)!.distance;
            const distB = assignments.get(b.id)!.distance;
            
            if (distA !== distB) return distA - distB; // Ascending distance
            
            if (a.type !== b.type) {
                if (a.type === NodeType.CONCEPT) return -1; // Concepts first
                return 1;
            }

            return (degrees.get(b.id)||0) - (degrees.get(a.id)||0); // Descending degree
        });

        path.push(...items.map(n => n.id));
    });

    // C. Orphans
    const orphans = nodes.filter(n => 
        n.type !== NodeType.ROOT && 
        n.type !== NodeType.CATEGORY && 
        !assignments.has(n.id)
    );
    orphans.sort((a, b) => (degrees.get(b.id)||0) - (degrees.get(a.id)||0));
    path.push(...orphans.map(n => n.id));

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
    setSelectedNode(null); // Close panel
    graphRef.current?.resetZoom(); // Center camera
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
          graphRef.current?.focusNode(id, { fitPadding: 480, scale: 0.9 });
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
        // Same as tour: Center in the top 40% with less zoom to show connections
        graphRef.current?.focusNode(pNode.id, { targetYRatio: 0.2, scale: 0.5 });
    } else {
        graphRef.current?.focusNode(pNode.id, { fitPadding: 480, scale: 0.9 });
    }
    setSelectedNode(pNode);

    if (isTourActive) {
        const indexInPath = tourPath.indexOf(pNode.id);
        if (indexInPath !== -1) {
            setTourIndex(indexInPath);
        } else {
            stopTour();
        }
    }
  }, [isTourActive, tourPath, isMobile]);

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

                {/* Simple Export Button */}
                <button 
                    onClick={handleExportMarkdown}
                    className="text-[#D1D1D1] hover:text-ink transition-colors"
                    title="Exportálás esszé formátumban (.md)"
                >
                    <Download className="w-6 h-6" />
                </button>

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
                              0.3 verzió. 2025. november
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
             <div 
                className={`absolute bottom-8 transform -translate-x-1/2 z-[100] bg-white/95 backdrop-blur shadow-lg border border-stone-200 rounded-full flex items-center transition-all duration-500 ease-in-out overflow-hidden ${isTourActive ? 'w-[280px] h-[52px]' : 'w-[150px] h-[44px]'}`}
                style={{
                    left: (selectedNode && windowWidth >= 768) ? 'calc((100% - 480px) / 2)' : '50%'
                }}
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
                   <div className={`absolute inset-0 flex items-center justify-between px-6 transition-opacity duration-300 ${isTourActive ? 'opacity-100 delay-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
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

                      <div className="w-px h-6 bg-stone-300 mx-0 shrink-0" />

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
                selectedNodeId={selectedNode?.id || null}
            />
        </div>

        <DetailPanel 
            node={selectedNode} 
            allNodes={data?.nodes || []}
            onClose={() => setSelectedNode(null)} 
            onNavigate={(id) => focusOnNodeById(id)}
            onRegenerate={handleRegenerateNode}
            isRegenerating={isRegeneratingNode}
            isMobile={isMobile}
        />

      </main>
    </div>
  );
};

export default App;
