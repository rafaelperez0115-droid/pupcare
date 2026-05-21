// ═══════════════════════════════════════════════════════════════════
//  PupCare — Netlify Function: generar-reporte.js
//  Analiza la foto mensual del cachorro con Gemini 1.5 Pro
//  y devuelve un reporte de desarrollo personalizado.
//
//  Endpoint: POST /.netlify/functions/generar-reporte
//  Body:     { mes, datosExtra, fotoBase64 }
// ═══════════════════════════════════════════════════════════════════

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// URL Y MODELO CON MÁXIMA COMPATIBILIDAD (Usando la versión estable v1)
const GEMINI_MODEL   = "gemini-1.5-pro";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

exports.handler = async (event) => {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Método no permitido. Usa POST." }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY no configurada en las variables de entorno.");
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Configuración del servidor incompleta." }),
    };
  }

  let mes, datosExtra, fotoBase64;
  try {
    ({ mes, datosExtra, fotoBase64 } = JSON.parse(event.body || "{}"));
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "JSON inválido en el body de la petición." }),
    };
  }

  if (!mes || !fotoBase64) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Faltan campos requeridos: mes y fotoBase64." }),
    };
  }

  const prompt = `
Eres un experto veterinario y criador profesional especializado en la raza American Bully 
y perros de tipo Molosoide/Bull. Tienes más de 20 años de experiencia analizando el 
desarrollo físico, muscular y óseo de cachorros de esta raza mes a mes.

Se te proporciona:
- La foto del cachorro en su mes: ${mes}
- Datos adicionales del registro: ${datosExtra || "No especificados"}

Analiza la imagen con atención a:
• Desarrollo muscular (especialmente cuello, hombros y cuartos traseros)
• Proporciones óseas y estructura corporal para la edad indicada
• Condición corporal general (ni muy delgado ni obeso)
• Desarrollo del cráneo y maseteros (característica clave de la raza)
• Postura, aplomo y ángulos articulares

Responde ÚNICAMENTE con este formato HTML exacto, sin texto adicional antes ni después,
sin bloques de código markdown, sin \`\`\`html:

<div class="reporte-seccion">
  <span class="reporte-icono">🚀</span>
  <div>
    <strong class="reporte-titulo">Cambio Significativo</strong>
    <p class="reporte-texto">[Tu análisis visual del desarrollo para el ${mes}. Máximo 2 oraciones claras y específicas para esta raza.]</p>
  </div>
</div>
<div class="reporte-seccion">
  <span class="reporte-icono">🦴</span>
  <div>
    <strong class="reporte-titulo">Consejo de Cuidado</strong>
    <p class="reporte-texto">[Un tip concreto y accionable de nutrición, ejercicio o salud específico para el ${mes} en un American Bully. Máximo 2 oraciones.]</p>
  </div>
</div>
`.trim();

  let mimeType = "image/jpeg";
  let imageData = fotoBase64;

  if (fotoBase64.startsWith("data:")) {
    const match = fotoBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType  = match[1];
      imageData = match[2];
    }
  }

  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data:     imageData,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature:     0.4,   
      maxOutputTokens: 512,   
      topP:            0.9,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_NONE" },
    ],
  };

  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("❌ Error de Gemini API:", geminiRes.status, errText);
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Error de la API de Gemini (${geminiRes.status}). Intenta de nuevo.`,
        }),
      };
    }

    const geminiData = await geminiRes.json();
    const reporte = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!reporte.trim()) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          reporte: `<div class="reporte-seccion">
            <span class="reporte-icono">⚠️</span>
            <div>
              <strong class="reporte-titulo">Sin análisis disponible</strong>
              <p class="reporte-texto">No se pudo generar el análisis esta vez. Intenta de nuevo al guardar.</p>
            </div>
          </div>`,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ reporte: reporte.trim() }),
    };

  } catch (err) {
    console.error("❌ Error inesperado en generar-reporte:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Error interno del servidor. Revisa los logs de Netlify.",
      }),
    };
  }
};
