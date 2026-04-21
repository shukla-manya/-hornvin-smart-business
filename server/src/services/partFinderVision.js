/**
 * Optional OpenAI vision for Part Finder. Returns null if not configured or on failure.
 */
export async function analyzePartImageWithOpenAI(dataUrl) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const body = {
    model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You help automotive parts buyers. Look at the photo (part, packaging, or vehicle area). Reply with ONE JSON object only, no markdown, keys: partSummary (one sentence), searchQuery (short space-separated keywords good for marketplace search), categoryHint (short). Use English.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") return null;

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    parsed = JSON.parse(m[0]);
  }

  const searchQuery = typeof parsed.searchQuery === "string" ? parsed.searchQuery.trim() : "";
  const partSummary = typeof parsed.partSummary === "string" ? parsed.partSummary.trim() : "";
  const categoryHint = typeof parsed.categoryHint === "string" ? parsed.categoryHint.trim() : "";

  if (!searchQuery && !partSummary) return null;
  return {
    searchQuery: searchQuery || partSummary.split(/\s+/).slice(0, 8).join(" "),
    partSummary: partSummary || searchQuery,
    categoryHint,
  };
}
