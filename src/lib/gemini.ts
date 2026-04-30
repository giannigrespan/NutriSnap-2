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

export async function generateMealPlan(userProfile: any, recentLogs: any[]): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    Basandoti sul profilo utente: ${JSON.stringify(userProfile)} 
    e sui log recenti: ${JSON.stringify(recentLogs)},
    genera un piano alimentare personalizzato per domani (3 pasti + 1 snack). 
    Includi consigli specifici per i suoi obiettivi fisici.
    Usa il formato Markdown.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "Impossibile generare il piano alimentare al momento.";
}
