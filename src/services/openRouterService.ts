import type { DetectedObject, ObjectDetectionResult } from "../types/vision";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const DETECTION_PROMPT = `You are a vision analysis AI. Analyze this image carefully and identify EVERY object, item, tool, person, and element visible.

For each item found, provide a structured response in this EXACT format:
OBJECT: [name]
CATEGORY: [Electronics/Stationery/Food/Person/Furniture/Nature/Vehicle/Other]
CONFIDENCE: [0.0-1.0]
DESCRIPTION: [one sentence describing it and its state/position]
---

List ALL objects you can see, from most prominent to least prominent. Be thorough and specific (e.g. "ballpoint pen" not just "pen", "smartphone with cracked screen" not just "phone").`;

/**
 * Parse the structured text response from the LLM into DetectedObject[]
 */
function parseObjectsFromText(rawText: string): DetectedObject[] {
  const objects: DetectedObject[] = [];
  const blocks = rawText.split("---").map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const labelMatch = block.match(/OBJECT:\s*(.+)/i);
    const categoryMatch = block.match(/CATEGORY:\s*(.+)/i);
    const confidenceMatch = block.match(/CONFIDENCE:\s*([\d.]+)/i);
    const descriptionMatch = block.match(/DESCRIPTION:\s*(.+)/i);

    if (labelMatch) {
      objects.push({
        label: labelMatch[1].trim(),
        category: categoryMatch?.[1]?.trim(),
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.85,
        description: descriptionMatch?.[1]?.trim() ?? "",
      });
    }
  }

  // Fallback: if no structured output, try to parse free text
  if (objects.length === 0 && rawText.length > 10) {
    // Split on newlines and try to pick out item-like lines
    const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
    for (const line of lines.slice(0, 10)) {
      const clean = line.replace(/^[-•*\d.]+\s*/, "").trim();
      if (clean.length > 2) {
        objects.push({
          label: clean.slice(0, 60),
          confidence: 0.8,
          description: "",
        });
      }
    }
  }

  return objects;
}

/**
 * Send a base64-encoded image to OpenRouter (gpt-4o-mini) for object detection.
 * @param imageBase64 - A data URL or raw base64 string (JPEG or PNG).
 * @param apiKey - The user's OpenRouter API key.
 * @param imageSource - Whether the image came from the webcam or an upload.
 */
export async function detectObjectsInImage(
  imageBase64: string,
  apiKey: string,
  imageSource: "webcam" | "upload" = "webcam"
): Promise<ObjectDetectionResult> {
  // Ensure we have a proper data URL
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "VisionHand AI Object Scanner",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
            {
              type: "text",
              text: DETECTION_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `OpenRouter API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson?.error?.message ?? errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const rawText: string = data?.choices?.[0]?.message?.content ?? "";

  if (!rawText) {
    throw new Error("No response content from OpenRouter API.");
  }

  const objects = parseObjectsFromText(rawText);

  return {
    objects,
    rawText,
    model: MODEL,
    timestamp: Date.now(),
    imageSource,
  };
}

/**
 * Capture the current video frame to a base64 JPEG data URL.
 */
export function captureVideoFrame(video: HTMLVideoElement, quality = 0.92): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot get canvas 2D context");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
