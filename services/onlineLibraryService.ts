
import { GraphData, LibraryItem } from '../types';

// Alapértelmezésben a gyökérben is kereshetünk, vagy a library mappában
// Ha a felhasználó csak bedobja a public mappába a fájlt, akkor a root-ban lesz.

export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    try {
        // Opcionális: Ha van library/index.json, betöltjük a katalógust
        const response = await fetch(`./library/index.json`);
        if (!response.ok) {
            return [];
        }
        return await response.json();
    } catch (error) {
        // Nem hiba, ha nincs index, csak üres a könyvtár menü
        return [];
    }
};

export const fetchOnlineGraph = async (filenameOrUrl: string): Promise<GraphData> => {
    try {
        let url = filenameOrUrl;

        // 1. Ha nem teljes URL, akkor relatív útvonalat építünk
        if (!url.startsWith('http') && !url.startsWith('/')) {
            // Ha nincs kiterjesztés, hozzáadjuk a .json-t
            const cleanName = url.endsWith('.json') ? url : `${url}.json`;
            
            // Közvetlenül a gyökérből próbáljuk betölteni (pl. /nietzsche.json)
            url = `/${cleanName}`;
        }

        const response = await fetch(url);
        
        // Ha a gyökérben nem találjuk, tehetünk egy próbát a library mappában is fallback-ként
        if (!response.ok && !filenameOrUrl.startsWith('http') && !filenameOrUrl.includes('/')) {
             const cleanName = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
             const libraryResponse = await fetch(`/library/${cleanName}`);
             if (libraryResponse.ok) {
                 return await libraryResponse.json();
             }
             // Ha ott sincs, akkor eldobjuk az eredeti hibát
             throw new Error(`Nem található a fájl: ${url} (Státusz: ${response.status})`);
        }

        if (!response.ok) {
            throw new Error(`Nem sikerült betölteni: ${url} (Státusz: ${response.status})`);
        }
        return await response.json();
    } catch (error) {
        console.error("Hiba az online gráf betöltésekor:", error);
        throw error;
    }
};

export const generateShareableLink = (filename: string): string => {
    const baseUrl = window.location.origin + window.location.pathname;
    // Eltávolítjuk a .json-t a linkből, hogy szebb legyen (a fetcher úgyis visszateszi)
    const cleanName = filename.replace('.json', '');
    return `${baseUrl}?src=${encodeURIComponent(cleanName)}`;
};
