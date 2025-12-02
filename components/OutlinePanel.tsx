
import React, { useState, useRef, useEffect } from 'react';
import { PhilosophicalNode, NodeType } from '../types';
import { ChevronLeft, List, GripVertical } from 'lucide-react';

interface OutlinePanelProps {
  nodes: PhilosophicalNode[];
  order: string[];
  isOpen: boolean;
  onToggle: () => void;
  onNodeClick: (nodeId: string) => void;
  onOrderChange: (newOrder: string[]) => void;
  selectedNodeId: string | null;
  isMobile: boolean;
}

const OutlinePanel: React.FC<OutlinePanelProps> = ({
  nodes,
  order,
  isOpen,
  onToggle,
  onNodeClick,
  onOrderChange,
  selectedNodeId,
  isMobile
}) => {
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected node
  useEffect(() => {
    if (selectedNodeId && isOpen && scrollContainerRef.current) {
      const selectedEl = document.getElementById(`outline-node-${selectedNodeId}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedNodeId, isOpen]);

  const getBlockSize = (startIndex: number) => {
      const startId = order[startIndex];
      const startNode = nodes.find(n => n.id === startId);
      // Only CATEGORY or ROOT act as containers for subsequent items
      if (!startNode || (startNode.type !== NodeType.CATEGORY && startNode.type !== NodeType.ROOT)) {
          return 1;
      }
      
      let size = 1;
      for (let i = startIndex + 1; i < order.length; i++) {
          const nodeId = order[i];
          const node = nodes.find(n => n.id === nodeId);
          // Stop if we hit another Category or Root
          if (node && (node.type === NodeType.CATEGORY || node.type === NodeType.ROOT)) {
              break;
          }
          size++;
      }
      return size;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    
    // Set transparent image or default
    // e.dataTransfer.setDragImage(new Image(), 0, 0); 
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Auto-scroll logic
    const container = scrollContainerRef.current;
    if (container) {
        const { top, bottom } = container.getBoundingClientRect();
        const hoverY = e.clientY;
        const threshold = 60;
        if (hoverY < top + threshold) {
            container.scrollTop -= 5;
        } else if (hoverY > bottom - threshold) {
            container.scrollTop += 5;
        }
    }

    if (draggedItemIndex === null) return;
    
    // Calculate block to ensure we don't drop inside the dragged block
    const blockSize = getBlockSize(draggedItemIndex);
    if (index >= draggedItemIndex && index < draggedItemIndex + blockSize) {
        setDropTargetIndex(null);
        return;
    }

    // Determine if dropping above or below
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    // Visual target index logic
    if (e.clientY < midY) {
        setDropTargetIndex(index);
    } else {
        setDropTargetIndex(index + 1);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemIndex === null || dropTargetIndex === null) return;
    
    const blockSize = getBlockSize(draggedItemIndex);
    
    // Prevent dropping inside itself (double check)
    if (dropTargetIndex > draggedItemIndex && dropTargetIndex <= draggedItemIndex + blockSize) {
        setDraggedItemIndex(null);
        setDropTargetIndex(null);
        return;
    }

    const newOrder = [...order];
    // Extract the block
    const draggedBlock = newOrder.splice(draggedItemIndex, blockSize);
    
    // Calculate insertion index
    let insertionIndex = dropTargetIndex;
    if (draggedItemIndex < dropTargetIndex) {
        insertionIndex -= blockSize;
    }
    
    // Insert the block
    newOrder.splice(insertionIndex, 0, ...draggedBlock);
    
    onOrderChange(newOrder);
    
    setDraggedItemIndex(null);
    setDropTargetIndex(null);
  };

  const getNodeStyle = (node: PhilosophicalNode) => {
      // Indentation based on type
      let paddingLeft = "1rem";
      if (node.type === NodeType.CATEGORY) paddingLeft = "1.5rem";
      if (node.type === NodeType.CONCEPT || node.type === NodeType.WORK) paddingLeft = "2.5rem";

      return { paddingLeft };
  };

  // Determine container classes based on open state
  const containerClasses = isOpen 
    ? "translate-x-0 opacity-100" 
    : "-translate-x-full opacity-0 pointer-events-none";

  const widthClass = isMobile ? "w-[85vw]" : "w-80";

  return (
    <>
      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 bottom-0 left-0 bg-paper/95 backdrop-blur-sm border-r border-stone-200 shadow-2xl z-[80] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col ${widthClass} ${containerClasses}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
           <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-ink">Vázlat</h3>
           <button 
             onClick={onToggle}
             className="p-1.5 hover:bg-stone-200 rounded-full text-secondary transition-colors"
           >
             <ChevronLeft className="w-5 h-5" />
           </button>
        </div>

        {/* List */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-2">
           {order.map((nodeId, idx) => {
               const node = nodes.find(n => n.id === nodeId);
               if (!node) return null;

               const isActive = selectedNodeId === nodeId;
               const isDragging = draggedItemIndex !== null && idx >= draggedItemIndex && idx < draggedItemIndex + getBlockSize(draggedItemIndex);
               
               const showDropLineTop = dropTargetIndex === idx && !isDragging;
               // Only show bottom line if it's the last item and we are dropping after it
               const showDropLineBottom = dropTargetIndex === idx + 1 && !isDragging;

               return (
                   <div 
                     key={nodeId} 
                     id={`outline-node-${nodeId}`}
                     className="relative group mb-1"
                   >
                       {/* Drop Indicators */}
                       {showDropLineTop && <div className="absolute -top-1 left-4 right-4 h-0.5 bg-accent rounded-full z-10" />}
                       
                       <div
                         draggable
                         onDragStart={(e) => handleDragStart(e, idx)}
                         onDragOver={(e) => handleDragOver(e, idx)}
                         onDrop={handleDrop}
                         onClick={() => onNodeClick(nodeId)}
                         className={`
                            flex items-center gap-2 py-2 pr-2 rounded-lg cursor-pointer transition-all select-none
                            ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-ink hover:bg-stone-100'}
                            ${isDragging ? 'opacity-40 bg-stone-100' : 'opacity-100'}
                         `}
                         style={getNodeStyle(node)}
                       >
                           {/* Grip Handle */}
                           <div className="text-stone-300 group-hover:text-stone-400 cursor-grab active:cursor-grabbing p-1 -ml-1">
                               <GripVertical size={14} />
                           </div>

                           {/* Label */}
                           <span className={`text-sm truncate leading-tight ${node.type === NodeType.ROOT ? 'font-bold uppercase tracking-wide text-xs' : ''} ${node.type === NodeType.WORK ? 'italic' : ''}`}>
                               {node.label.replace(/_/g, '')}
                           </span>

                           {/* Active Indicator */}
                           {isActive && (
                               <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                           )}
                       </div>

                       {showDropLineBottom && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-accent rounded-full z-10" />}
                   </div>
               );
           })}
        </div>
      </div>
    </>
  );
};

export default OutlinePanel;
