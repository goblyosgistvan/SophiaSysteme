
import { GraphData, LibraryItem } from '../types';

// This assumes you will create a 'library' folder in your public directory
// containing an 'index.json' and the graph files.
const LIBRARY_BASE_URL = './library'; 

export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    try {
        const response = await fetch(`${LIBRARY_BASE_URL}/index.json`);
        if (!response.ok) {
            // Silently fail if no index exists yet (local dev without setup)
            console.warn("Library index not found.");
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching library index:", error);
        return [];
    }
};

export const fetchOnlineGraph = async (filename: string): Promise<GraphData> => {
    try {
        // Handle both full URLs and relative filenames
        const url = filename.startsWith('http') || filename.startsWith('/') 
            ? filename 
            : `${LIBRARY_BASE_URL}/${filename}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load graph: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching online graph:", error);
        throw error;
    }
};

export const generateShareableLink = (filename: string): string => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?src=${encodeURIComponent(filename)}`;
};
