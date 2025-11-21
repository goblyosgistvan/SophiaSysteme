
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GraphData, NodeType } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const graphSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING, description: "The name of the concept or philosopher" },
          type: { type: Type.STRING, enum: [NodeType.ROOT, NodeType.CATEGORY, NodeType.CONCEPT, NodeType.WORK] },
          shortSummary: { type: Type.STRING, description: "A 1-2 sentence summary in Hungarian" },
          longExplanation: { type: Type.STRING, description: "A detailed explanation (markdown allowed) in Hungarian, focusing on systemic understanding." },
          conceptContext: { type: Type.STRING, description: "If the node is a CONCEPT/CATEGORY: Describe parallels or opposites from other schools in 1-2 sentences. If Person/Work, leave empty." },
          connections: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of other nodes this helps explain or relates to" }
        },
        required: ["id", "label", "type", "shortSummary", "longExplanation", "connections"]
      }
    },
    links: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING, description: "ID of the source node" },
          target: { type: Type.STRING, description: "ID of the target node" },
          relationLabel: { type: Type.STRING, description: "Label of relationship in Hungarian, e.g., 'magába foglalja', 'kritizálja'" }
        },
        required: ["source", "target", "relationLabel"]
      }
    }
  },
  required: ["nodes", "links"]
};

export const fetchPhilosophyData = async (topic: string): Promise<GraphData> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const model = "gemini-2.5-flash";
  const systemInstruction = `
    Te egy világszínvonalú filozófia professzor és tudás-rendszerező vagy.
    A feladatod, hogy a megadott filozófiai témát (legyen az egy fogalom, egy irányzat vagy egy személy) elegánsan rendszerbe szedd.
    
    FONTOS: A cél a mély, rendszerszintű megértés és a pontos terminológia.

    1. **STRUKTÚRA**:
       - Készíts egy gráf struktúrát.
       - A központi téma legyen a ROOT.
       - Bontsd főbb kategóriákra (CATEGORY), specifikus koncepciókra (CONCEPT) és konkrét MŰVEKRE (WORK).
       - SZIGORÚ TÍPUSOSSÁG: Könyv címe MINDIG 'WORK', filozófiai ág MINDIG 'CATEGORY'.
    
    2. **NYELVEZET ÉS HELYESÍRÁS (KRITIKUS)**:
       - Kizárólag MAGYAR nyelven válaszolj.
       - **IDÉZŐJELEK**: A magyar szabályoknak megfelelően használd a „ és ” jeleket (alul 99, felül 99). Például: „Idézet”.
       - **KISBETŰS FOGALMAK**: A filozófiai fogalmakat kisbetűvel írd (pl. "kategorikus imperatívusz", "akarat", "szubsztancia"), KIVÉVE, ha tulajdonnév (pl. "Platón", "Isten"). 
       - **KIEMELÉS**: Ha ki akarsz emelni egy fogalmat a szöveges leírásban, használd a standard Markdown dőlt betűt: _fogalom_. SOHA NE használj HTML tageket (mint az <em>), mert azok nyersen jelennek meg.
       - **MŰVEK CÍME**: A könyvek és művek címét magyar helyesírás szerint DŐLT BETŰVEL írd (_A tiszta ész kritikája_), NE idézőjelben.
       - **FORDÍTÁSOK**: Használd a KANONIKUS magyar fordításokat.
         - Pl. Nietzsche: _Így szólott Zarathustra_, _A morál genealógiája_, _a hatalom akarása_.
         - Kant: _A tiszta ész kritikája_.
         - Schopenhauer: _A világ mint akarat és képzet_.

    3. **TARTALOM ÉS MEZŐK**:
       - **conceptContext**: Ha a node FOGALOM vagy IRÁNYZAT, ide írj egy rövid, szöveges kitekintést: milyen más irányzatokkal/fogalmakkal áll párhuzamban vagy ellentétben?
       - A 'longExplanation' legyen esszéisztikus, folyó szöveg, ne listázás.
    
    4. **GENERÁLÁS**:
       - Generálj legalább 15-20 csomópontot.
       - Figyelj arra, hogy minden link érvényes forrásra és célra mutasson.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: graphSchema,
        temperature: 0.3, 
      },
      contents: [
        { role: "user", parts: [{ text: `Készíts átfogó fogalmi térképet erről a témáról, pontos magyar terminológiával: "${topic}"` }] }
      ]
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    
    const data = JSON.parse(text) as GraphData;
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
