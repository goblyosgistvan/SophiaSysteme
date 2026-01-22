
import { GraphData, LibraryItem } from '../types';

// Segédfüggvény a biztonságos JSON letöltéshez
const tryFetchJSON = async (url: string): Promise<any | null> => {
    try {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");
        
        // Ha a válasz OK, és NEM HTML (404 redirect elkerülése)
        // Megengedjük a null content-type-ot is, vagy application/json-t
        if (response.ok && (!contentType || !contentType.includes("text/html"))) {
            return await response.json();
        }
    } catch (e) {
        // Hálózati hiba vagy JSON parse hiba esetén csendben null-t adunk
    }
    return null;
};

export const fetchLibraryIndex = async (): Promise<LibraryItem[]> => {
    // Próbáljuk először relatív, majd abszolút útvonalon
    let data = await tryFetchJSON('./library/index.json');
    if (!data) {
        data = await tryFetchJSON('/library/index.json');
    }
    return data || [];
};

export const fetchOnlineGraph = async (filenameOrUrl: string): Promise<GraphData> => {
    try {
        const baseName = filenameOrUrl.replace(/\.json$/i, '');
        const candidates: string[] = [];

        // 1. ESET: Teljes URL vagy útvonal
        if (filenameOrUrl.includes('/') || filenameOrUrl.startsWith('http')) {
            const url = filenameOrUrl.endsWith('.json') ? filenameOrUrl : `${filenameOrUrl}.json`;
            candidates.push(url);
        } 
        // 2. ESET: Csak fájlnév -> Generálunk lehetséges útvonalakat
        else {
            candidates.push(`/library/${baseName}.json`);
            candidates.push(`./library/${baseName}.json`); // Relatív útvonal próba
            candidates.push(`/${baseName}.json`); // Gyökér próba
        }

        // Végigpróbáljuk a jelölteket
        for (const url of candidates) {
            const data = await tryFetchJSON(url);
            if (data) return data;
        }

        // 3. ESET: SMART FALLBACK - Ha nem találtuk, megnézzük az indexben (kis/nagybetű eltérés kezelése)
        if (!filenameOrUrl.includes('/')) {
            console.log(`Közvetlen elérés sikertelen: ${baseName}. Keresés az indexben...`);
            const index = await fetchLibraryIndex();
            
            const lowerBase = baseName.toLowerCase();
            // Keresünk egyezést (kisbetűsítve, kiterjesztés nélkül)
            const match = index.find(item => 
                item.filename.replace(/\.json$/i, '').toLowerCase() === lowerBase
            );

            if (match) {
                console.log(`Találat az indexben: ${match.filename}`);
                // Próbáljuk a megtalált pontos fájlnévvel
                const matchUrl = `/library/${match.filename}`;
                const data = await tryFetchJSON(matchUrl);
                if (data) return data;
                
                // Végső próba relatív útvonallal
                const matchUrlRel = `./library/${match.filename}`;
                const dataRel = await tryFetchJSON(matchUrlRel);
                if (dataRel) return dataRel;
            }
        }

        throw new Error(`A kért gráf nem található: ${baseName}`);

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
