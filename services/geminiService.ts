
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GraphData, NodeType, PhilosophicalNode } from '../types';
import { loadBookContext } from './contextLoader';

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
          longExplanation: { type: Type.STRING, description: "A detailed explanation (2 paragraphs) in Hungarian. Focus on depth." },
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

const singleNodeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shortSummary: { type: Type.STRING, description: "A concise, academic summary (2-3 sentences) in Hungarian." },
    longExplanation: { type: Type.STRING, description: "Informatív, fókuszált kifejtés (max 150 szó). Legyen tömör és lényegretörő." },
    conceptContext: { type: Type.STRING, description: "Historical and theoretical context, contrasting with other schools or philosophers." }
  },
  required: ["shortSummary", "longExplanation", "conceptContext"]
};

const systemInstructionBase = `
    Te egy világszínvonalú filozófia professzor és tudás-rendszerező vagy.
    A feladatod, hogy a megadott filozófiai témát (legyen az egy fogalom, egy irányzat vagy egy személy) elegánsan rendszerbe szedd.
    
    FONTOS: A cél a mély, rendszerszintű megértés és a pontos terminológia.

    1. **STRUKTÚRA**:
       - Készíts egy gráf struktúrát.
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
       - **longExplanation**: Ez legyen a legfontosabb rész. Két tartalmas bekezdésben fejtsd ki a fogalmat esszéisztikusan, összefüggéseiben. Ne felsorolás legyen, hanem folyó szöveg.
`;

const getAugmentedInstruction = async (baseInstruction: string): Promise<string> => {
    const bookText = await loadBookContext();
    
    if (!bookText) return baseInstruction;

    const limitedText = bookText.slice(0, 900000);

    return `${baseInstruction}

    4. **SZIGORÚ TERMINOLÓGIAI REFERENCIA**:
       A válaszok generálásakor HASZNÁLD az alábbi forrásszöveget (Boros Gábor: Filozófia) szótárként és terminológiai mankóként.
       
       SZABÁLYOK:
       - **Szóhasználat**: Ha a forrásszöveg egy fogalmat specifikusan fordít (pl. „elme” vs „szellem”, „magánvaló” vs „dolog önmagában”), akkor KÖTELEZŐEN a könyv változatát használd.
       - **Helyesírás**: Kövesd a könyvben használt nevek és címek írásmódját.
       - **Tudásbázis**: A tartalmi kifejtéshez használd az általános tudásodat is, de a struktúra és a fogalmak legyenek összhangban a könyvvel.

       *** FORRÁSSZÖVEG KEZDETE ***
       ${limitedText}
       *** FORRÁSSZÖVEG VÉGE ***
    `;
};

export const fetchPhilosophyData = async (topic: string): Promise<GraphData> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

const systemInstruction = await getAugmentedInstruction(`${systemInstructionBase}    4. **GENERÁLÁS**:
       - A központi téma legyen a ROOT.
       - Generálj legalább 15-20 csomópontot.
       - Figyelj arra, hogy minden link érvényes forrásra és célra mutasson.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: graphSchema,
        temperature: 0, 
      },
      contents: [
        { role: "user", parts: [{ text: `Készíts átfogó fogalmi térképet erről a témáról, a megadott forrásszöveg magyar terminológiájával: "${topic}"` }] }
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

export const augmentPhilosophyData = async (originalData: GraphData, request: string): Promise<GraphData> => {
    if (!apiKey) throw new Error("API Key is missing.");

    // Extract existing IDs to force Gemini to link to them
    const existingNodesList = originalData.nodes.map(n => `(ID: "${n.id}", Label: "${n.label}")`).join("\n");
    
    const systemInstruction = `${systemInstructionBase}
      5. **KIEGÉSZÍTÉS (AUGMENTATION)**:
         - A felhasználó kiegészítést kér a gráfhoz: "${request}".
         - Itt vannak a JELENLEGI CSOMÓPONTOK:
         ${existingNodesList}

         - A feladatod:
           1. Generálj 3-5 ÚJ csomópontot, ami releváns a kéréshez. A forrászöveget hívd segítségül a terminológiához.
           2. SZIGORÚ INTEGRÁCIÓ: Minden új csomópontnak kapcsolódnia KELL legalább egy, a fenti listában szereplő MEGLÉVŐ ID-hoz. Ne hozz létre elszigetelt szigeteket!
           3. A kapcsolatoknál használd a pontos ID-kat a fenti listából.
           4. Csak az új node-okat és az új linkeket küldd vissza.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: graphSchema,
                temperature: 0,
            },
            contents: [
                { role: "user", parts: [{ text: `Egészítsd ki a gráfot szervesen ezzel: "${request}". FONTOS: Kapcsold az új fogalmakat a releváns meglévőkhöz a pontos ID használatával!` }] }
            ]
        });

        const text = response.text;
        if (!text) throw new Error("No response text");

        const newData = JSON.parse(text) as GraphData;
        return newData;
    } catch (error) {
        console.error("Gemini Augment Error:", error);
        throw error;
    }
};

export const createConnectedNode = async (sourceNode: PhilosophicalNode, request: string): Promise<GraphData> => {
    if (!apiKey) throw new Error("API Key is missing.");

  const systemInstruction = await getAugmentedInstruction(`${systemInstructionBase}      4. **ÚJ KAPCSOLÓDÓ FOGALOM LÉTREHOZÁSA**:
         - A felhasználó egy új fogalmat akar kapcsolni közvetlenül ehhez a csomóponthoz: "${sourceNode.label}" (ID: "${sourceNode.id}").
         - A kérés: "${request}".
         - A feladatod:
           1. Generálj PONTOSAN EGY ÚJ csomópontot, ami tartalmilag releváns a kéréshez, terminológia a forrásszöveg alapján.
           2. Generálj hozzá egy kapcsolatot (link), ami az új csomópontot a "${sourceNode.id}" node-hoz köti.
           3. A válaszban csak az új node és az egyetlen új link szerepeljen.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: graphSchema,
                temperature: 0.1,
            },
            contents: [
                { role: "user", parts: [{ text: `Készíts egy új fogalmat, ami ehhez kapcsolódik: "${sourceNode.label}", a következő témában: "${request}".` }] }
            ]
        });

        const text = response.text;
        if (!text) throw new Error("No response text");

        return JSON.parse(text) as GraphData;
    } catch (error) {
        console.error("Gemini Add Node Error:", error);
        throw error;
    }
};

export const enrichNodeData = async (node: PhilosophicalNode, topicContext: string): Promise<Partial<PhilosophicalNode>> => {
  if (!apiKey) throw new Error("API Key is missing.");

  const systemInstruction = await getAugmentedInstruction(`
      Te egy szigorú és precíz filozófiai lexikon szerkesztője vagy.
      A feladatod, hogy a megadott fogalom leírását PONTOSÍTSD és elmélyítsd, a mellékelt forrásszöveg alapján, hogy a terminológia és szöveg pontosabb legyen.
      
      Elvárások:
      1. **Pontosság**: Használj szakmailag pontos, magyar akadémiai terminológiát.
      2. A "longExplanation" legyen a legfontosabb rész. Két tartalmas bekezdésben (köztük üres sor) fejtsd ki a fogalmat esszéisztikusan, összefüggéseiben. Ne felsorolás legyen, hanem folyó szöveg.
      3. **Kontextus**: Helyezd el a fogalmat a filozófiatörténetben.
      4. **Nyelvezet**: - Kizárólag MAGYAR nyelven válaszolj.
       - **IDÉZŐJELEK**: A magyar szabályoknak megfelelően használd a „ és ” jeleket.
       - **MŰVEK CÍME**: DŐLT BETŰVEL írd.
      
      A kimenet JSON legyen, ami tartalmazza a frissített mezőket.
  `);

  try {
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: singleNodeSchema,
              temperature: 0.4, 
          },
          contents: [
              { role: "user", parts: [{ text: `A téma kontextusa: "${topicContext}".
              
              Pontosítsd a következő node tartalmát:
              Label: ${node.label}
              Jelenlegi Summary: ${node.shortSummary}
              Jelenlegi Explanation: ${node.longExplanation}` }] }
          ]
      });

      const text = response.text;
      if (!text) throw new Error("No response text");

      return JSON.parse(text) as Partial<PhilosophicalNode>;
  } catch (error) {
      console.error("Gemini Enrich Error:", error);
      throw error;
  }
};
