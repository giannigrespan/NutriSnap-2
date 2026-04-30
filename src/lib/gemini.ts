export interface FoodAnalysis {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

async function callGroqAPI(systemPrompt: string, userMessage: string | any[], schema?: any) {
  const model = "llama-3.3-70b-versatile"; 

  const messages = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: userMessage });

  const payload: any = {
    model: model,
    messages: messages,
    temperature: 0.1,
  };

  if (schema) {
    payload.response_format = { type: "json_object" };
    messages[0].content += `\nRispondi unicamente con un JSON valido strutturato in questo modo: ${JSON.stringify(schema)}`;
  }

  const res = await fetch("/api/groq/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.error || "HTTP " + res.status);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Risposta vuota da Groq");

  return content;
}

export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysis> {
  // Llama models su Groq non supportano (tipicamente) la vision al momento, 
  // ma useremo un blocco try per simulare o potremmo usare una fallback.
  // Nel caso supporti array vision API:
  const messages = [
    { type: "text", text: "Analizza questa immagine di cibo e restituisci un oggetto JSON con la descrizione del piatto, una stima delle calorie, proteine (g), carboidrati (g) e grassi (g). Indica anche il tipo di pasto più probabile tra 'breakfast', 'lunch', 'dinner', 'snack'." },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
  ];

  const payload = {
    model: "llama-3.2-11b-vision-preview",
    messages: [
      { role: "user", content: messages }
    ],
    temperature: 0.1,
  };

  const res = await fetch("/api/groq/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.error || "HTTP " + res.status);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  
  try {
    const match = text.match(/\{.*\}/s);
    const jsonStr = match ? match[0] : text;
    return JSON.parse(jsonStr) as FoodAnalysis;
  } catch (e) {
    console.error("Failed to parse JSON from Groq:", text);
    throw new Error("Errore nel parsing della risposta.");
  }
}

export async function analyzeFoodText(foodDescription: string): Promise<FoodAnalysis> {
  const schema = {
    description: "string",
    calories: "number",
    protein: "number",
    carbs: "number",
    fat: "number",
    mealType: "breakfast | lunch | dinner | snack"
  };

  const content = await callGroqAPI(
    "Sei un assistente nutrizionale in grado di calcolare macronutrienti stimati partendo da testo.",
    `Analizza questa descrizione di cibo: "${foodDescription}". Restituisci una stima credibile per questi alimenti.`,
    schema
  );

  try {
    const match = content.match(/\{.*\}/s);
    return JSON.parse(match ? match[0] : content) as FoodAnalysis;
  } catch (e) {
    throw new Error("Errore nel parsing della risposta.");
  }
}

export async function generatePlan(
  userProfile: any, 
  foodLogs: any[], 
  exerciseLogs: any[], 
  planType: 'meals' | 'workout' | 'both',
  specificRequest: string
): Promise<string> {
  let instructions = "";
  if (planType === 'meals') {
    instructions = `Genera un piano alimentare personalizzato per domani (3 pasti + 1 snack). Basati su quanto ha mangiato e bruciato recentemente.`;
  } else if (planType === 'workout') {
    instructions = `Genera un piano di allenamento dettagliato per la prossima sessione. Seleziona gli esercizi in base ai log passati e all'obiettivo.`;
  } else {
    instructions = `Genera un piano giornaliero completo comprendente sia l'alimentazione (3 pasti + snack) sia la sessione di allenamento. Fai in modo che l'alimentazione supporti l'allenamento suggerito.`;
  }

  const userPrompt = `
    Profilo utente: ${JSON.stringify(userProfile)} 
    Log alimentari recenti: ${JSON.stringify(foodLogs)}
    Log allenamenti recenti: ${JSON.stringify(exerciseLogs)}
    
    Richiesta/Note dell'utente: "${specificRequest || "Nessuna nota specifica"}"

    ${instructions}
  `;

  const content = await callGroqAPI(
    "Sei un fitness e nutrition coach professionista. Fornisci il risultato BEN FORMATTATO in Markdown, con intestazioni chiare, elenchi puntati per i pasti o gli esercizi (con set/reps se applicabile), e un breve paragrafo narrativo motivazionale basato sulle richieste. Usa un tono incoraggiante e da coach.",
    userPrompt
  );

  return content || "Impossibile generare il piano al momento.";
}
