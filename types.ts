
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
