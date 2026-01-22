

import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export enum NodeType {
  ROOT = 'ROOT',        // The main topic
  CATEGORY = 'CATEGORY', // Major branches (e.g., metaphysics, ethics)
  CONCEPT = 'CONCEPT',   // Specific ideas
  WORK = 'WORK'         // Specific books or essays
}

export interface PhilosophicalNode {
  id: string;
  label: string;
  type: NodeType;
  shortSummary: string;
  longExplanation: string;
  conceptContext?: string; // New: Parallels or contrasts (for Concepts)
  connections: string[]; // IDs of other related nodes outside strict hierarchy
}

export interface PhilosophicalLink {
  source: string;
  target: string;
  relationLabel: string; // e.g., "részhalmaza", "ellentéte", "kritikája"
}

export interface GraphData {
  nodes: PhilosophicalNode[];
  links: PhilosophicalLink[];
  customOrder?: string[]; // Persisted order of node IDs for the Outline view
  metadata?: {
      title?: string;
      icon?: string;
      author?: string; // New: For online attribution
      version?: string;
  };
}

export interface SimulationNode extends SimulationNodeDatum, PhilosophicalNode {
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimulationLink extends SimulationLinkDatum<SimulationNode> {
    relationLabel: string;
    source: string | number | SimulationNode;
    target: string | number | SimulationNode;
}

export interface SavedGraph {
  id: string;
  topic: string;
  date: string;
  data: GraphData;
  path: string; // Directory path, e.g., "" or "Philosophy/German"
  icon?: string; // e.g. 'book', 'star', 'brain'
  isOnline?: boolean; // New: Identifies if this is from the read-only online library
  onlineSource?: string; // The filename/url
}

export interface LibraryItem {
    filename: string; // e.g., "aristotle_ethics.json"
    title: string;
    description: string;
    category: string;
    added: string;
    icon?: string;
}
