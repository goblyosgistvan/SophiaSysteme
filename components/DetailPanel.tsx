
import React, { useState, useEffect, useRef } from 'react';
import { PhilosophicalNode, NodeType } from '../types';
import { X, ArrowRightCircle, GitGraph, Lightbulb, RefreshCw, Edit3, Save, PenTool, GripVertical, Trash2, Plus, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DetailPanelProps {
  node: PhilosophicalNode | null;
  allNodes: PhilosophicalNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onRegenerate: (node: PhilosophicalNode) => void;
  onSave: (updatedNode: PhilosophicalNode) => void;
  onDelete: (nodeId: string) => void;
  onAddConnectedNode: (sourceNode: PhilosophicalNode, topic: string) => Promise<void>;
  isRegenerating: boolean;
  isAddingNode: boolean;
  isMobile: boolean;
  width: number;
  onResize: (width: number) => void;
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


const DetailPanel: React.FC<DetailPanelProps> = ({ 
  node, 
  allNodes, 
  onClose, 
  onNavigate, 
  onRegenerate, 
  onSave, 
  onDelete, 
  onAddConnectedNode, 
  isRegenerating, 
  isAddingNode,
  isMobile, 
  width, 
  onResize 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedExplanation, setEditedExplanation] = useState('');
  const [editedContext, setEditedContext] = useState('');
  
  const [newConnectionTopic, setNewConnectionTopic] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const isResizing = useRef(false);

  // Reset states when node changes
  useEffect(() => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setNewConnectionTopic('');
    if (node) {
        setEditedLabel(node.label);
        setEditedSummary(node.shortSummary);
        setEditedExplanation(node.longExplanation);
        setEditedContext(node.conceptContext || '');
    }
  }, [node]);

  // Resize Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = window.innerWidth / 2;
      const minWidth = 320;
      
      onResize(Math.max(minWidth, Math.min(newWidth, maxWidth)));
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  const startResizing = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSave = () => {
      if (!node) return;
      const updatedNode: PhilosophicalNode = {
          ...node,
          label: editedLabel,
          shortSummary: editedSummary,
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

  const handleAddConnection = async () => {
      if (!node || !newConnectionTopic.trim()) return;
      await onAddConnectedNode(node, newConnectionTopic);
      setNewConnectionTopic('');
  }

  const getTypeLabel = (type: NodeType) => {
    switch (type) {
      case NodeType.ROOT: return "Központi Téma";
      case NodeType.CATEGORY: return "Téma"; // Changed from "Filozófiai Irányzat"
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

  const positionClasses = isMobile 
    ? `fixed inset-x-0 bottom-0 h-[80vh] rounded-t-3xl border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${node ? 'translate-y-0' : 'translate-y-full'}`
    : `fixed inset-y-0 right-0 border-l border-stone-200 ${node ? 'translate-x-0' : 'translate-x-full'}`;
  
  const desktopStyle = !isMobile ? { width: `${width}px` } : {};

  return (
    <div 
        className={`${positionClasses} bg-paper shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-[90] flex flex-col`}
        style={desktopStyle}
    >
      
      {/* Resize Handle (Desktop Only) */}
      {!isMobile && (
        <div 
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/30 active:bg-accent transition-colors z-[100] flex flex-col justify-center items-center group"
            onMouseDown={startResizing}
        >
             <div className="h-8 w-0.5 bg-stone-300 group-hover:bg-accent/50 rounded-full transition-colors delay-100" />
        </div>
      )}

      {node && (
        <>
          {/* Header */}
          <div className={`sticky top-0 bg-paper/95 backdrop-blur-sm border-b border-stone-200 px-8 py-6 flex justify-between items-start z-10 flex-none ${isMobile ? 'rounded-t-3xl' : ''}`}>
            {isEditing && (
                 <div className={`absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,transparent_0%,#000_50%,transparent_100%)] opacity-10`} />
            )}
            
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-1 mb-3 flex-wrap">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase border rounded ${getTypeColor(node.type)}`}>
                    {getTypeLabel(node.type)}
                </span>
                
                {/* Actions */}
                {!isEditing ? (
                    <>
                        <div className="h-4 w-px bg-stone-300 mx-2"></div>
                        
                        <button 
                            onClick={() => onRegenerate(node)}
                            disabled={isRegenerating}
                            className="p-1.5 text-stone-400 hover:text-accent hover:bg-stone-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Szöveg pontosítása mesterséges intelligenciával"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                        </button>
                        
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 text-stone-400 hover:text-ink hover:bg-stone-100 rounded-md transition-colors"
                            title="Szerkesztés"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                         <div className="h-4 w-px bg-stone-300 mx-2"></div>
                         
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
          <div className={`flex-1 px-8 py-6 overflow-y-auto custom-scrollbar pb-10 ${isEditing ? 'bg-stone-50/30' : ''}`}>
            
            {isEditing ? (
                 <div className="flex flex-col gap-6 mb-10 border-2 border-dashed border-stone-200 rounded-xl p-4 -mx-4 bg-stone-50/50">
                    <div className="relative">
                         <AutoResizeTextarea 
                            value={editedExplanation}
                            onChange={(e) => setEditedExplanation(e.target.value)}
                            className="w-full bg-transparent border-none p-0 font-serif text-lg leading-relaxed text-ink resize-none focus:ring-0 outline-none placeholder:text-stone-300"
                            placeholder="Kifejtés szövege..."
                        />
                    </div>
                    
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

            {/* Interactive Connections */}
            {!isEditing && (
               <div className="mt-8 pt-6 border-t border-stone-200">
                 <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                   <GitGraph className="w-4 h-4" />
                   Kapcsolódó fogalmak
                 </h3>
                 
                 {/* Existing Connections */}
                 {connectedNodes.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-6">
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
                 ) : (
                     <p className="text-sm text-secondary italic mb-6">Nincs közvetlen kapcsolat.</p>
                 )}

                 {/* Add New Connection Input */}
                 <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-full p-1 pl-4 transition-all focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent">
                    <input 
                        type="text" 
                        value={newConnectionTopic}
                        onChange={(e) => setNewConnectionTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddConnection()}
                        placeholder="Új kapcsolódó fogalom..." 
                        className="bg-transparent border-none text-sm font-sans text-ink placeholder:text-stone-400 focus:outline-none focus:ring-0 w-full"
                        disabled={isAddingNode}
                    />
                    <button 
                        onClick={handleAddConnection}
                        disabled={!newConnectionTopic.trim() || isAddingNode}
                        className="p-2 bg-white rounded-full text-secondary hover:text-accent hover:bg-stone-100 disabled:opacity-50 transition-colors shadow-sm"
                        title="Hozzáadás"
                    >
                        {isAddingNode ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                    </button>
                 </div>

               </div>
            )}
            
            {/* Delete Node Section */}
            {!isEditing && (
                <div className="mt-6 pt-8 border-t border-stone-200 flex justify-center">
                    {!showDeleteConfirm ? (
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Csomópont törlése
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                             <span className="text-xs font-sans text-stone-500">Biztosan törlöd?</span>
                             <button 
                                onClick={() => onDelete(node.id)}
                                className="px-3 py-1 bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-red-600 transition-colors"
                             >
                                 Igen
                             </button>
                             <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3 py-1 bg-stone-200 text-stone-600 text-xs font-bold uppercase tracking-widest rounded hover:bg-stone-300 transition-colors"
                             >
                                 Mégse
                             </button>
                        </div>
                    )}
                </div>
            )}
            
          </div>
        </>
      )}
    </div>
  );
};

export default DetailPanel;
