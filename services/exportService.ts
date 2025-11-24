
import { GraphData, NodeType, PhilosophicalNode } from '../types';

export const getCleanFileName = (topic: string) => {
    return topic.replace(/[^a-z0-9áéíóöőúüű]/gi, '_').toLowerCase();
};

const triggerDownload = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportJSON = (data: GraphData, topic: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    triggerDownload(`${getCleanFileName(topic)}_sophia_graph.json`, jsonString, 'application/json');
};

export const exportMarkdown = (data: GraphData, topic: string) => {
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

    triggerDownload(`${getCleanFileName(topic)}_sophia_essze.md`, content, 'text/markdown');
};
