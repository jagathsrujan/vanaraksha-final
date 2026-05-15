// api.js — OpenRouter API communication layer

import { buildSystemPrompt } from "./utils/buildPrompt.js";
import { parseAIResponse } from "./utils/parseResult.js";

// --- Configuration ---
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-2.5-flash";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function getApiConfig() {
  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY || null;
  if (!openRouterKey) {
    throw new Error(
      "No API configuration found. Set VITE_OPENROUTER_API_KEY in your .env.local file."
    );
  }
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openRouterKey}`,
    "X-OpenRouter-Title": "VanaRaksha",
  };
  const siteUrl = import.meta.env.VITE_OPENROUTER_SITE_URL || window.location.origin;
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  return {
    url: OPENROUTER_CHAT_URL,
    headers,
    model: OPENROUTER_MODEL,
  };
}

function buildMessages(systemPrompt, userContent, imageBase64 = null) {
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];
  if (imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userContent },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: userContent });
  }
  return messages;
}

async function callOpenRouter(messages, model = OPENROUTER_MODEL, extraConfig = {}) {
  const { url, headers } = getApiConfig();
  const body = {
    model,
    messages,
    temperature: 0.3,
    top_p: 0.95,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    ...extraConfig,
  };
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} — ${errorText}`);
      }
      const json = await response.json();
      if (json.error) {
        throw new Error(`OpenRouter API error: ${json.error.message || JSON.stringify(json.error)}`);
      }
      const choice = json.choices?.[0];
      if (!choice) throw new Error("No choices in API response");
      if (choice.finish_reason === "content_filter") throw new Error("Content filter blocked the response");
      let text = choice.message?.content;
      if (!text) throw new Error("Empty response from API");
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`OpenRouter API attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`OpenRouter API failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

export async function analyzePhoto(photo, matchedWard) {
  if (!photo || !photo.base64) {
    return { success: false, error: "No photo data provided", data: null };
  }
  const systemPrompt = buildSystemPrompt(matchedWard);
  const annotations = [];
  if (photo.why) annotations.push(`Why taken: ${photo.why}`);
  if (photo.assessment) annotations.push(`User assessment: ${photo.assessment}`);
  if (photo.tags && photo.tags.length > 0) annotations.push(`Tags: ${photo.tags.join(", ")}`);
  const userContent =
    `Analyze this photo for urban climate risk signals in Bengaluru.\n` +
    `Return ONLY valid JSON matching this schema:\n` +
    `{\n` +
    `  "flood_signals": ["string \u2014 list of observed flood risk indicators"],\n` +
    `  "heat_signals": ["string \u2014 list of observed UHI indicators"],\n` +
    `  "water_signals": ["string \u2014 list of observed water stress indicators"],\n` +
    `  "key_observation": "one sentence summary",\n` +
    `  "confidence": "Low|Medium|High"\n` +
    `}\n` +
    (annotations.length > 0 ? `\nUser annotations:\n${annotations.join("\n")}\n\n` : "");
  try {
    const rawResponse = await callOpenRouter(
      buildMessages(systemPrompt, userContent, photo.base64),
      OPENROUTER_MODEL,
      { temperature: 0.2 }
    );
    return parseAIResponse(rawResponse, "photo");
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

export async function runSynthesis(
  matchedWard,
  photoAnalyses,
  testimonies,
  propertyType,
  userIntent,
  notes
) {
  const systemPrompt = buildSystemPrompt(matchedWard);
  const photoEvidence = photoAnalyses
    .filter((a) => a.success)
    .map((a, i) => ({
      photo_index: i + 1,
      flood_signals: a.data.flood_signals,
      heat_signals: a.data.heat_signals,
      water_signals: a.data.water_signals,
      key_observation: a.data.key_observation,
      confidence: a.data.confidence,
    }));
  const testimonyEvidence = testimonies
    .filter((t) => t.said && t.said.trim().length > 0)
    .map((t) => ({
      who: t.who || "Anonymous",
      statement: t.said,
      concern_level: t.concern,
      credibility_score: t.credibility,
    }));
  const userContent =
    `Synthesize a complete climate risk assessment for the following property.\n\n` +
    `PROPERTY CONTEXT:\n` +
    `- Property type: ${propertyType || "Not specified"}\n` +
    `- User intent: ${userIntent || "Not specified"}\n` +
    `- User notes: ${notes || "None"}\n` +
    `- Ward: ${matchedWard ? matchedWard.label : "Unknown/unmatched"}\n` +
    `- Zone: ${matchedWard ? matchedWard.zone : "N/A"}\n` +
    (matchedWard?.isInterpolated ? `\u26a0\ufe0f INTERPOLATED DATA \u2014 ward was not directly in database; proxied from nearest zone\n` : "") +
    `\n` +
    `PHOTO EVIDENCE (${photoEvidence.length} photos analyzed):\n` +
    `${photoEvidence.map((p) =>
      `Photo ${p.photo_index}: [Flood: ${p.flood_signals.length} signals, Heat: ${p.heat_signals.length} signals, Water: ${p.water_signals.length} signals, confidence: ${p.confidence}]`
    ).join("\n")}\n` +
    `${photoEvidence.length > 0 ? "\nDetailed photo signals:\n" + photoEvidence.map((p) =>
      `Photo ${p.photo_index} \u2014 Flood: ${p.flood_signals.join("; ") || "none"} | Heat: ${p.heat_signals.join("; ") || "none"} | Water: ${p.water_signals.join("; ") || "none"}`
    ).join("\n") : ""}\n` +
    `\nLOCAL TESTIMONY (${testimonyEvidence.length} entries):\n` +
    `${testimonyEvidence.map((t) =>
      `"${t.statement}" \u2014 ${t.who} (concern: ${t.concern_level}, credibility: ${t.credibility_score}/5)`
    ).join("\n")}\n` +
    (testimonyEvidence.length === 0 ? "(No testimonies provided)\n" : "") +
    `\nWARD BASELINE SUMMARY:\n` +
    (matchedWard
      ? `- Flood baseline: ${matchedWard.flood} (${matchedWard.flood_events_10yr || 0} events in 10yr)\n` +
        `- UHI baseline: ${matchedWard.uhi} (delta: ${matchedWard.uhi_delta || "N/A"})\n` +
        `- Water baseline: ${matchedWard.water} (table: ${matchedWard.water_table_depth_m || "N/A"}m, BWSSB: ${matchedWard.bwssb_sewer_coverage_pct || "N/A"}%)\n` +
        `- NDVI: ${matchedWard.ndvi || "N/A"}, Impervious: ${matchedWard.impervious_pct || "N/A"}%\n` +
        `- Lakes: ${matchedWard.lake_count || 0}, pop density: ${matchedWard.pop_density?.toLocaleString() || "N/A"}/sqkm`
      : "No ward data available \u2014 use Bengaluru city-wide baselines.") +
    `\n\nYour task: Produce a single, authoritative risk assessment that synthesizes ALL evidence (photographic, testimonial, ward baseline, and city context). Be specific, cite data points, and flag any data gaps or contradictions.\n`;
  try {
    const rawResponse = await callOpenRouter(
      buildMessages(systemPrompt, userContent),
      OPENROUTER_MODEL,
      { temperature: 0.2 }
    );
    return parseAIResponse(rawResponse, "synthesis");
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

export async function checkApiHealth() {
  try {
    const config = getApiConfig();
    const response = await fetch(config.url, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        max_tokens: 8,
        temperature: 0,
      }),
    });
    if (response.ok) return { ok: true, details: `OpenRouter API reachable (${config.model})` };
    const text = await response.text();
    return { ok: false, error: `${response.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
