/**
 * Venue website fetching: pull the homepage, find private-dining / events pages,
 * and return cleaned text per page for the extraction step.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const PD_LINK_RE =
  /private|event|group|part(y|ies)|banquet|celebrat|buyout|gather|occasion|function|meeting|reception|venue-hire|book/i;
const MENU_LINK_RE = /menu/i;

const PAGE_CHAR_CAP = 14000;
const MAX_PD_PAGES = 4;

export interface FetchedPage {
  url: string;
  text: string;
}

export interface SiteContent {
  pages: FetchedPage[]; // homepage first, then private-dining/events pages
  menuUrls: string[];
  pdfUrls: string[]; // linked PDFs from PD-ish anchors (likely PD kits / menus)
  emails: string[];
  phones: string[];
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;|&ndash;/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractLinks(html: string, baseUrl: string): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const raw = m[1].split("#")[0];
      if (!raw) continue;
      const href = new URL(raw, baseUrl).toString();
      const label = htmlToText(m[2]).slice(0, 120);
      links.push({ href, label });
    } catch {
      // unparseable href — skip
    }
  }
  return links;
}

function sameSite(url: string, base: string): boolean {
  try {
    const a = new URL(url).hostname.replace(/^www\./, "");
    const b = new URL(base).hostname.replace(/^www\./, "");
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
  } catch {
    return false;
  }
}

export async function fetchSiteContent(website: string): Promise<SiteContent> {
  const empty: SiteContent = { pages: [], menuUrls: [], pdfUrls: [], emails: [], phones: [] };
  const homeHtml = await fetchHtml(website);
  if (!homeHtml) return empty;

  const links = extractLinks(homeHtml, website);
  const emails = new Set<string>();
  const phones = new Set<string>();
  const menuUrls = new Set<string>();
  const pdfUrls = new Set<string>();
  const pdCandidates: string[] = [];

  const collectContacts = (html: string) => {
    for (const m of html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g))
      emails.add(m[1].toLowerCase());
    for (const m of html.matchAll(/tel:\+?([\d\-().\s]{7,20})/g)) phones.add(m[1].trim());
  };
  collectContacts(homeHtml);

  const seen = new Set<string>();
  for (const { href, label } of links) {
    if (seen.has(href)) continue;
    seen.add(href);
    const matchesPd = PD_LINK_RE.test(href) || PD_LINK_RE.test(label);
    const matchesMenu = MENU_LINK_RE.test(href) || MENU_LINK_RE.test(label);
    if (href.toLowerCase().endsWith(".pdf")) {
      if (matchesPd) pdfUrls.add(href);
      if (matchesMenu) menuUrls.add(href);
      continue;
    }
    if (!sameSite(href, website)) continue;
    if (matchesMenu) menuUrls.add(href);
    if (matchesPd) pdCandidates.push(href);
  }

  // Prefer the most explicitly private-dining-ish URLs first
  pdCandidates.sort((a, b) => {
    const score = (u: string) => (/private/i.test(u) ? 0 : /event/i.test(u) ? 1 : 2);
    return score(a) - score(b);
  });

  const pages: FetchedPage[] = [
    { url: website, text: htmlToText(homeHtml).slice(0, PAGE_CHAR_CAP) },
  ];
  for (const url of pdCandidates.slice(0, MAX_PD_PAGES)) {
    const html = await fetchHtml(url);
    if (!html) continue;
    collectContacts(html);
    // pick up menu/PDF links on PD pages too — that's where PD kits live
    for (const { href, label } of extractLinks(html, url)) {
      if (href.toLowerCase().endsWith(".pdf")) {
        if (PD_LINK_RE.test(href) || PD_LINK_RE.test(label)) pdfUrls.add(href);
        if (MENU_LINK_RE.test(href) || MENU_LINK_RE.test(label)) menuUrls.add(href);
      }
    }
    pages.push({ url, text: htmlToText(html).slice(0, PAGE_CHAR_CAP) });
  }

  return {
    pages,
    menuUrls: [...menuUrls].slice(0, 6),
    pdfUrls: [...pdfUrls].slice(0, 6),
    emails: [...emails].slice(0, 6),
    phones: [...phones].slice(0, 4),
  };
}
