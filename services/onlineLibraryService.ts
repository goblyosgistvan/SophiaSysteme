
import { GraphData, LibraryItem } from '../types';

// Segédfüggvény a biztonságos JSON letöltéshez időbélyeggel (cache elkerülése)
const tryFetchJSON = async (url: string): Promise<any | null> => {
    try {
        // Cache-busting: hozzáadjuk az időt, hogy biztosan friss verziót kapjunk
        const safeUrl = `${url}?t=${new Date().getTime()}`;
        console.log(`[Library] Fetching: ${safeUrl}`);
        
        const response = await fetch(safeUrl);
        const contentType = response.headers.get("content-type");
        
        // Debug infó a konzolra
        if (!response.ok) {
            console.warn(`[Library] Hiba (${response.status}) itt: ${url}`);
            return null;
        }

        // Ha HTML-t kapunk vissza, az nem jó (Vercel fallback)
        if (contentType && contentType.includes("text/html")) {
            console.warn(`[Library] HTML választ kaptunk JSON helyett innen: ${url}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error(`[Library] Hálózati hiba itt: ${url}`, e);
        return null;
    }
};

export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    // Szigorúan abszolút útvonalat használunk a gyökérből
    const data = await tryFetchJSON('/library/index.json');
    return data || [];
};

export const fetchOnlineGraph = async (filenameOrUrl: string): Promise<GraphData> => {
    try {
        const baseName = filenameOrUrl.replace(/\.json$/i, '');
        const candidates: string[] = [];

        // 1. ESET: Teljes URL vagy útvonal (ha tartalmaz / jelet)
        if (filenameOrUrl.includes('/') || filenameOrUrl.startsWith('http')) {
            const url = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
            candidates.push(url);
        } 
        // 2. ESET: Csak fájlnév -> Generálunk lehetséges útvonalakat
        else {
            // Prioritás: Abszolút útvonal a public/library mappába
            candidates.push(`/library/${baseName}.json`);
            // Esetleg kisbetűs verzió, ha a fájlnév csupa kisbetűs a szerveren
            candidates.push(`/library/${baseName.toLowerCase()}.json`);
        }

        // Végigpróbáljuk a jelölteket
        for (const url of candidates) {
            const data = await tryFetchJSON(url);
            if (data) return data;
        }

        // 3. ESET: SMART FALLBACK - Ha nem találtuk, megnézzük az indexben
        // Ez segít, ha a fájlnév pl. "Arthur_Schopenhauer.json" de a link "arthur_schopenhauer"
        if (!filenameOrUrl.includes('/')) {
            console.log(`[Library] Közvetlen elérés sikertelen: ${baseName}. Keresés az indexben...`);
            const index = await fetchLibraryIndex();
            
            const lowerBase = baseName.toLowerCase();
            // Keresünk egyezést (kisbetűsítve, kiterjesztés nélkül)
            const match = index.find(item => 
                item.filename.replace(/\.json$/i, '').toLowerCase() === lowerBase
            );

            if (match) {
                console.log(`[Library] Találat az indexben: ${match.filename}`);
                // Próbáljuk a megtalált pontos fájlnévvel (abszolút útvonalon)
                const matchUrl = `/library/${match.filename}`;
                const data = await tryFetchJSON(matchUrl);
                if (data) return data;
            }
        }

        throw new Error(`A kért gráf nem található sem a megadott néven (${baseName}), sem az index alapján.`);

    } catch (error) {
        console.error("Hiba az online gráf betöltésekor:", error);
        throw error;
    }
};

export const generateShareableLink = (filename: string): string => {
    const origin = window.location.origin;
    const cleanName = filename.split('/').pop()?.replace('.json', '') || filename;
    return `${origin}/?src=${cleanName}`;
};
