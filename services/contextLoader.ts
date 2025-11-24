// src/services/contextLoader.ts

let cachedContext: string | null = null;

export const loadBookContext = async (): Promise<string> => {
  if (cachedContext) return cachedContext;

  try {
    const response = await fetch('/filozofia-content.txt');
    
    if (!response.ok) {
        console.warn("Nem található a filozofia-content.txt. A rendszer általános tudást fog használni.");
        return "";
    }
    
    const text = await response.text();
    console.log("Könyv kontextus sikeresen betöltve, hossza:", text.length);
    
    cachedContext = text;
    return text;
  } catch (error) {
    console.error("Hiba a könyv betöltésekor:", error);
    return "";
  }
};