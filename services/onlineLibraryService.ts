
import { GraphData, LibraryItem } from '../types';

// Segédfüggvény a biztonságos JSON letöltéshez időbélyeggel (cache elkerülése)
const tryFetchJSON = async (url: string): Promise<any | null> => {
    try {
        const safeUrl = `${url}?t=${new Date().getTime()}`;
        console.log(`[Library] Fetching: ${safeUrl}`);
        
        const response = await fetch(safeUrl);
        const contentType = response.headers.get("content-type");
        
        if (!response.ok) {
            console.warn(`[Library] Hiba (${response.status}) itt: ${url}`);
            return null;
        }

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
    // Diagnosztika: Ha az index sem jön le, nagy valószínűséggel rossz helyen van a mappa
    const data = await tryFetchJSON('/library/index.json');
    if (!data) {
        console.error("KRITIKUS HIBA: A '/library/index.json' nem érhető el. Ellenőrizd, hogy a 'library' mappa a 'public' könyvtárban van-e!");
    }
    return data || [];
};

export const fetchOnlineGraph = async (filenameOrUrl: string): Promise<GraphData> => {
    try {
        const baseName = filenameOrUrl.replace(/\.json$/i, '');
        const candidates: string[] = [];

        // 1. ESET: Teljes URL
        if (filenameOrUrl.includes('/') || filenameOrUrl.startsWith('http')) {
            const url = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
            candidates.push(url);
        } 
        // 2. ESET: Csak fájlnév -> Generálunk lehetséges útvonalakat
        else {
            candidates.push(`/library/${baseName}.json`);
            candidates.push(`/library/${baseName.toLowerCase()}.json`);
        }

        // Végigpróbáljuk a jelölteket
        for (const url of candidates) {
            const data = await tryFetchJSON(url);
            if (data) return data;
        }

        // 3. ESET: FALLBACK és Diagnosztika
        // Ha nem találtuk a konkrét fájlt, megnézzük, hogy egyáltalán létezik-e a könyvtár
        const index = await fetchLibraryIndex();
        
        if (index.length === 0) {
            // Ha az index üres/nem elérhető, akkor strukturális hiba van
            throw new Error(`A teljes online könyvtár elérhetetlen. Ellenőrizd, hogy a "library" mappa a "public" mappán belül van-e!`);
        }

        // Ha az index elérhető, megpróbáljuk abban megkeresni (kisbetű/nagybetű eltérés kezelése)
        if (!filenameOrUrl.includes('/')) {
            const lowerBase = baseName.toLowerCase();
            const match = index.find(item => 
                item.filename.replace(/\.json$/i, '').toLowerCase() === lowerBase
            );

            if (match) {
                console.log(`[Library] Találat az indexben: ${match.filename}`);
                const matchUrl = `/library/${match.filename}`;
                const data = await tryFetchJSON(matchUrl);
                if (data) return data;
            }
        }

        throw new Error(`A fájl nem található: ${baseName}. (A könyvtár elérhető, de ez a fájl hiányzik.)`);

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
