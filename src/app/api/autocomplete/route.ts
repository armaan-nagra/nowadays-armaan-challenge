import { NextResponse } from "next/server";

// Proxies Places Autocomplete (New) so the Google key stays server-side.
export async function POST(req: Request) {
  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = (body.input ?? "").trim();
  if (input.length < 3) return NextResponse.json({ suggestions: [] });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing Google API key" }, { status: 500 });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    return NextResponse.json({ suggestions: [] });
  }
  const data = await res.json();
  const suggestions = (data.suggestions ?? [])
    .map((s: { placePrediction?: { text?: { text?: string } } }) => s.placePrediction?.text?.text)
    .filter((t: string | undefined): t is string => !!t)
    .slice(0, 5);
  return NextResponse.json({ suggestions });
}
