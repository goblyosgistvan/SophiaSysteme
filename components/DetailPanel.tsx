
import React, { useState, useEffect, useRef } from 'react';
import { PhilosophicalNode, NodeType } from '../types';
import { X, ArrowRightCircle, GitGraph, Lightbulb, RefreshCw, Edit3, Save, PenTool } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DetailPanelProps {
  node: PhilosophicalNode | null;
  allNodes: PhilosophicalNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onRegenerate: (node: PhilosophicalNode) => void;
  onSave: (updatedNode: PhilosophicalNode) => void;
  isRegenerating: boolean;
  isMobile: boolean;
}

const AutoResizeTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [props.value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      {...props}
    />
  );
};


const DetailPanel: React.FC<DetailPanelProps> = ({ node, allNodes, onClose, onNavigate, onRegenerate, onSave, isRegenerating, isMobile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedExplanation, setEditedExplanation] = useState('');
  const [editedContext, setEditedContext] = useState('');

  // Reset edit state when node changes
  useEffect(() => {
    setIsEditing(false);
    if (node) {
        setEditedLabel(node.label);
        setEditedSummary(node.shortSummary);
        setEditedExplanation(node.longExplanation);
        setEditedContext(node.conceptContext || '');
    }
  }, [node]);

  const handleSave = () => {
      if (!node) return;
      const updatedNode: PhilosophicalNode = {
          ...node,
          label: editedLabel,
          shortSummary: editedSummary, // Preserve the summary even if hidden in edit mode
          longExplanation: editedExplanation,
          conceptContext: editedContext.trim() === '' ? undefined : editedContext
      };
      onSave(updatedNode);
      setIsEditing(false);
  };

  const handleCancel = () => {
      if (node) {
        setEditedLabel(node.label);
        setEditedSummary(node.shortSummary);
        setEditedExplanation(node.longExplanation);
        setEditedContext(node.conceptContext || '');
      }
      setIsEditing(false);
  };

  const getTypeLabel = (type: NodeType) => {
    switch (type) {
      case NodeType.ROOT: return "Központi Téma";
      case NodeType.CATEGORY: return "Filozófiai Irányzat";
      case NodeType.CONCEPT: return "Fogalom";
      case NodeType.WORK: return "Alapmű";
      default: return "Fogalom";
    }
  };

  const getTypeColor = (type: NodeType) => {
     switch (type) {
      case NodeType.ROOT: return "bg-accent text-white border-accent";
      case NodeType.CATEGORY: return "bg-gold text-white border-gold";
      case NodeType.WORK: return "bg-secondary text-white border-secondary";
      default: return "bg-stone-200 text-ink border-stone-300";
    }
  }

  const connectedNodes = node ? node.connections
    .map(id => allNodes.find(n => n.id === id))
    .filter((n): n is PhilosophicalNode => !!n) : [];

  // Dynamic classes for positioning and transition based on isMobile
  const positionClasses = isMobile 
    ? `fixed inset-x-0 bottom-0 h-[75vh] rounded-t-3xl border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${node ? 'translate-y-0' : 'translate-y-full'}`
    : `fixed inset-y-0 right-0 w-full md:w-[480px] border-l border-stone-200 ${node ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <div 
        className={`${positionClasses} bg-paper shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-[90] flex flex-col`}
    >
      {node && (
        <>
          {/* Header */}
          <div className={`sticky top-0 bg-paper/95 backdrop-blur-sm border-b border-stone-200 px-8 py-6 flex justify-between items-start z-10 flex-none ${isMobile ? 'rounded-t-3xl' : ''}`}>
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase border rounded ${getTypeColor(node.type)}`}>
                    {getTypeLabel(node.type)}
                </span>
                
                {/* Actions */}
                {!isEditing ? (
                    <>
                        <button 
                            onClick={() => onRegenerate(node)}
                            disabled={isRegenerating}
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-stone-300 rounded text-stone-500 hover:text-accent hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Szöveg pontosítása mesterséges intelligenciával"
                        >
                            <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                            {isRegenerating ? 'Generálás...' : 'Kifejtés'}
                        </button>
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-stone-300 rounded text-stone-500 hover:text-ink hover:border-ink transition-colors"
                            title="Szerkesztés"
                        >
                            <Edit3 className="w-3 h-3" />
                            Szerkesztés
                        </button>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-ink text-white border border-ink rounded hover:bg-stone-700 transition-colors"
                        >
                            <Save className="w-3 h-3" />
                            Mentés
                        </button>
                        <button 
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-stone-300 rounded text-stone-500 hover:text-red-500 hover:border-red-500 transition-colors"
                        >
                            <X className="w-3 h-3" />
                            Mégse
                        </button>
                    </>
                )}
              </div>

              {isEditing ? (
                  <input 
                    type="text"
                    value={editedLabel}
                    onChange={(e) => setEditedLabel(e.target.value)}
                    className="w-full text-2xl md:text-3xl font-serif text-ink font-medium leading-tight bg-white/50 border-b border-dashed border-stone-300 focus:border-accent focus:outline-none focus:ring-0 p-1 -ml-1 placeholder-stone-300"
                    placeholder="Cím..."
                  />
              ) : (
                <h2 className="text-2xl md:text-3xl font-serif text-ink font-medium leading-tight [&_em]:italic">
                    <ReactMarkdown 
                    components={{
                        p: ({children}) => <>{children}</>,
                        em: ({node, ...props}) => <em className="font-serif italic" {...props} />
                    }}
                    >
                    {node.label}
                    </ReactMarkdown>
                </h2>
              )}
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-200 rounded-full transition-colors text-secondary shrink-0"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 px-8 py-6 overflow-y-auto custom-scrollbar pb-24">
            
            {isEditing ? (
                 <div className="flex flex-col gap-6 mb-10 border-2 border-dashed border-stone-200 rounded-xl p-4 -mx-4 bg-stone-50/50">
                    {/* Main Explanation Editing - Seamless Look */}
                    <div className="relative">
                         <AutoResizeTextarea 
                            value={editedExplanation}
                            onChange={(e) => setEditedExplanation(e.target.value)}
                            className="w-full bg-transparent border-none p-0 font-serif text-lg leading-relaxed text-ink resize-none focus:ring-0 outline-none placeholder:text-stone-300"
                            placeholder="Kifejtés szövege..."
                        />
                    </div>
                    
                    {/* Context Editing - Seamless Look */}
                    <div className="mt-2 border-t border-stone-200 pt-6">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                            <Lightbulb className="w-4 h-4" />
                            Eszmetörténeti Kontextus
                        </h3>
                        <AutoResizeTextarea 
                            value={editedContext}
                            onChange={(e) => setEditedContext(e.target.value)}
                            className="w-full bg-transparent border-none p-0 font-serif text-lg leading-relaxed text-ink resize-none focus:ring-0 outline-none italic placeholder:text-stone-300"
                            placeholder="Ide írhatsz eszmetörténeti kontextust (opcionális)..."
                        />
                    </div>
                 </div>
            ) : (
                <>
                    <div className={`font-serif text-lg leading-relaxed text-ink mb-10 [&_p]:mb-4 [&_em]:italic transition-opacity duration-500 ${isRegenerating ? 'opacity-50' : 'opacity-100'}`}>
                    <ReactMarkdown components={{
                        em: ({node, ...props}) => <em className="font-serif italic text-ink" {...props} />
                    }}>
                        {node.longExplanation}
                    </ReactMarkdown>
                    </div>

                    {/* Logic: Show "Intellectual Context" ONLY if conceptContext exists */}
                    {node.conceptContext && (
                    <div className={`mb-8 border-t border-stone-200 pt-6 transition-opacity duration-500 ${isRegenerating ? 'opacity-50' : 'opacity-100'}`}>
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                        <Lightbulb className="w-4 h-4" />
                        Eszmetörténeti Kontextus
                        </h3>
                        <div className="font-serif text-lg leading-relaxed text-ink [&_em]:italic">
                        <ReactMarkdown components={{
                            em: ({node, ...props}) => <em className="font-serif italic text-ink" {...props} />
                        }}>
                            {node.conceptContext}
                        </ReactMarkdown>
                        </div>
                    </div>
                    )}
                </>
            )}

            {/* Interactive Connections (Only show in view mode) */}
            {!isEditing && connectedNodes.length > 0 && (
               <div className="mt-8 pt-6 border-t border-stone-200">
                 <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                   <GitGraph className="w-4 h-4" />
                   Kapcsolódó fogalmak
                 </h3>
                 <div className="flex flex-wrap gap-2">
                   {connectedNodes.map(connNode => (
                     <button
                       key={connNode.id}
                       onClick={() => onNavigate(connNode.id)}
                       className="group flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-full hover:border-accent hover:text-accent transition-all text-sm font-sans text-stone-600 shadow-sm"
                     >
                       <span className={connNode.label.includes('_') ? "italic" : ""}>
                         {connNode.label.replace(/_/g, '')}
                       </span>
                       <ArrowRightCircle className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                     </button>
                   ))}
                 </div>
               </div>
            )}
            
          </div>
        </>
      )}
    </div>
  );
};

export default DetailPanel;
