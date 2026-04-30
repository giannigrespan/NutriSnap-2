import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FoodAnalysis {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: "Analizza questa immagine di cibo e restituisci un oggetto JSON con la descrizione del piatto, una stima delle calorie, proteine (g), carboidrati (g) e grassi (g). Indica anche il tipo di pasto più probabile tra 'breakfast', 'lunch', 'dinner', 'snack'. Rispondi SOLO in formato JSON valido.",
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
          mealType: { 
            type: Type.STRING,
            enum: ["breakfast", "lunch", "dinner", "snack"]
          },
        },
        required: ["description", "calories", "protein", "carbs", "fat", "mealType"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Nessuna risposta dal modello");
  
  return JSON.parse(text) as FoodAnalysis;
}

export async function analyzeFoodText(foodDescription: string): Promise<FoodAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: `Analizza questa descrizione di cibo: "${foodDescription}". Restituisci un oggetto JSON con una descrizione formattata del piatto (max 5 parole), una stima delle calorie, proteine (g), carboidrati (g) e grassi (g). Indica anche il tipo di pasto più probabile tra 'breakfast', 'lunch', 'dinner', 'snack'. Rispondi SOLO in formato JSON valido.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
          mealType: { 
            type: Type.STRING,
            enum: ["breakfast", "lunch", "dinner", "snack"]
          },
        },
        required: ["description", "calories", "protein", "carbs", "fat", "mealType"],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) throw new Error("Nessuna risposta dal modello");
  
  return JSON.parse(responseText) as FoodAnalysis;
}

export async function generatePlan(
  userProfile: any, 
  foodLogs: any[], 
  exerciseLogs: any[], 
  planType: 'meals' | 'workout' | 'both',
  specificRequest: string
): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  let instructions = "";
  if (planType === 'meals') {
    instructions = `Genera un piano alimentare personalizzato per domani (3 pasti + 1 snack). Basati su quanto ha mangiato e bruciato recentemente.`;
  } else if (planType === 'workout') {
    instructions = `Genera un piano di allenamento dettagliato per la prossima sessione. Seleziona gli esercizi in base ai log passati e all'obiettivo.`;
  } else {
    instructions = `Genera un piano giornaliero completo comprendente sia l'alimentazione (3 pasti + snack) sia la sessione di allenamento. Fai in modo che l'alimentazione supporti l'allenamento suggerito.`;
  }

  const prompt = `
    Sei un fitness e nutrition coach professionista.
    
    Profilo utente: ${JSON.stringify(userProfile)} 
    Log alimentari recenti: ${JSON.stringify(foodLogs)}
    Log allenamenti recenti: ${JSON.stringify(exerciseLogs)}
    
    Richiesta/Note dell'utente: "${specificRequest || "Nessuna nota specifica"}"

    ${instructions}

    Fornisci il risultato BEN FORMATTATO in Markdown, con intestazioni chiare, elenchi puntati per i pasti o gli esercizi (con set/reps se applicabile), e un breve paragrafo narrativo motivazionale basato sulle sue richieste. Usa un tono incoraggiante e da coach.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "Impossibile generare il piano al momento.";
}
