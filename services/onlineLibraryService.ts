
import { GraphData, LibraryItem } from '../types';

// Alapértelmezésben a gyökérben is kereshetünk, vagy a library mappában
export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    try {
        const response = await fetch(`./library/index.json`);
        const contentType = response.headers.get("content-type");
        
        // Ha HTML-t kapunk vissza (Vercel SPA fallback), akkor nincs index fájl
        if (!response.ok || (contentType && contentType.includes("text/html"))) {
            return [];
        }
        return await response.json();
    } catch (error) {
        return [];
    }
};

export const fetchOnlineGraph = async (filenameOrUrl: string): Promise<GraphData> => {
    try {
        // Kiterjesztés normalizálása: levesszük, majd a logikában visszarakjuk
        const baseName = filenameOrUrl.replace(/\.json$/i, '');
        
        // Jelöltek listája (URL-ek, amiket megpróbálunk letölteni)
        const candidates: string[] = [];

        // 1. ESET: Ha teljes URL vagy útvonal (tartalmaz / jelet)
        if (filenameOrUrl.includes('/') || filenameOrUrl.startsWith('http')) {
            const url = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
            candidates.push(url);
        } 
        // 2. ESET: Csak fájlnév (pl. "arthur_schopenhauer")
        else {
            // Prioritás: Először a library mappában keressük!
            candidates.push(`/library/${baseName}.json`);
            // Fallback: Gyökérkönyvtár
            candidates.push(`/${baseName}.json`);
        }

        // Végigmegyünk a jelölteken
        for (const url of candidates) {
            try {
                const response = await fetch(url);
                const contentType = response.headers.get("content-type");
                
                // A Vercel a nem létező fájlokra (404) gyakran 200 OK + index.html-t ad vissza.
                // Ezért ellenőrizzük, hogy NEM HTML-t kaptunk-e.
                if (response.ok && contentType && !contentType.includes("text/html")) {
                    return await response.json();
                }
            } catch (e) {
                // Folytatjuk a következő jelölttel
                console.warn(`Nem sikerült betölteni innen: ${url}`);
            }
        }

        // Ha semmi nem sikerült
        throw new Error(`A kért gráf nem található: ${baseName}`);

    } catch (error) {
        console.error("Hiba az online gráf betöltésekor:", error);
        throw error;
    }
};

export const generateShareableLink = (filename: string): string => {
    // A felhasználó kérésére ?src= formátumot használunk a megosztáshoz
    const origin = window.location.origin;
    // Eltávolítjuk a .json kiterjesztést és az esetleges mappákat a tiszta névhez
    const cleanName = filename.split('/').pop()?.replace('.json', '') || filename;
    return `${origin}/?src=${cleanName}`;
};
