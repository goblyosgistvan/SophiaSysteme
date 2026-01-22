
import { GraphData, LibraryItem } from '../types';

// Alapértelmezésben a gyökérben is kereshetünk, vagy a library mappában
// Ha a felhasználó csak bedobja a public mappába a fájlt, akkor a root-ban lesz.

export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    try {
        // Opcionális: Ha van library/index.json, betöltjük a katalógust
        const response = await fetch(`./library/index.json`);
        const contentType = response.headers.get("content-type");
        
        // Ha HTML-t kapunk vissza (Vercel SPA fallback), akkor nincs index fájl
        if (!response.ok || (contentType && contentType.includes("text/html"))) {
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

        // 1. Ha nem teljes URL, akkor relatív útvonalat építünk (alapértelmezés: gyökér)
        if (!url.startsWith('http') && !url.startsWith('/')) {
            // Ha nincs kiterjesztés, hozzáadjuk a .json-t
            const cleanName = url.endsWith('.json') ? url : `${url}.json`;
            url = `/${cleanName}`;
        }

        let response = await fetch(url);
        let contentType = response.headers.get("content-type");
        const isHtml = contentType && contentType.includes("text/html");

        // FONTOS JAVÍTÁS:
        // Ha a válasz nem OK, VAGY (és ez a Vercel SPA miatt kritikus) OK, de HTML-t kaptunk JSON helyett,
        // akkor a fájl nincs a gyökérben. Ilyenkor próbálkozzunk a 'library' mappával.
        if ((!response.ok || isHtml) && !filenameOrUrl.startsWith('http') && !filenameOrUrl.includes('/')) {
             console.log(`A fájl nem található a gyökérben (${url}), keresés a könyvtárban...`);
             
             const cleanName = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
             const libraryUrl = `/library/${cleanName}`;
             
             const libraryResponse = await fetch(libraryUrl);
             const libContentType = libraryResponse.headers.get("content-type");
             const libIsHtml = libContentType && libContentType.includes("text/html");
             
             if (libraryResponse.ok && !libIsHtml) {
                 return await libraryResponse.json();
             }
        }

        // Ha itt vagyunk, vagy sikerült az első kérés, vagy a fallback is sikertelen volt.
        if (!response.ok) {
            throw new Error(`Nem sikerült betölteni: ${url} (Státusz: ${response.status})`);
        }
        
        if (isHtml) {
             throw new Error("A kért fájl nem található (HTML választ kaptunk JSON helyett).");
        }

        return await response.json();
    } catch (error) {
        console.error("Hiba az online gráf betöltésekor:", error);
        throw error;
    }
};

export const generateShareableLink = (filename: string): string => {
    // Tiszta URL generálása: https://site.com/nietzsche
    const origin = window.location.origin;
    const cleanName = filename.replace('.json', '');
    return `${origin}/${cleanName}`;
};
