import { config } from "@/lib/config";
import { SearchError, type SearchProvider, type SearchResult } from "./types";

/**
 * Web-search providers behind one interface. All calls happen server-side —
 * API keys never reach the browser — and every provider is swappable through
 * the SEARCH_PROVIDER environment variable.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function getJson<T>(url: string, headers: Record<string, string>, provider: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.search.timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SearchError(
        `Search request failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        provider,
      );
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof SearchError) throw error;
    const message =
      (error as Error).name === "AbortError"
        ? "Search request timed out"
        : `Search request failed: ${(error as Error).message}`;
    throw new SearchError(message, undefined, provider);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- Google CSE
interface GoogleResponse {
  items?: Array<{ title?: string; link?: string; snippet?: string; displayLink?: string }>;
}

export class GoogleCseProvider implements SearchProvider {
  readonly name = "google_cse";
  get configured() {
    return Boolean(config.search.googleApiKey && config.search.googleCx);
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", config.search.googleApiKey);
    url.searchParams.set("cx", config.search.googleCx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(10, limit)));
    const data = await getJson<GoogleResponse>(url.toString(), {}, this.name);
    return (data.items ?? [])
      .filter((i) => i.link)
      .map((i, idx) => ({
        title: i.title ?? "",
        url: i.link!,
        snippet: i.snippet ?? "",
        displayUrl: i.displayLink ?? hostOf(i.link!),
        rank: idx + 1,
        query,
      }));
  }
}

// ------------------------------------------------------------------- SerpAPI
interface SerpApiResponse {
  organic_results?: Array<{ title?: string; link?: string; snippet?: string; displayed_link?: string }>;
}

export class SerpApiProvider implements SearchProvider {
  readonly name = "serpapi";
  get configured() {
    return Boolean(config.search.serpApiKey);
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(20, limit)));
    url.searchParams.set("api_key", config.search.serpApiKey);
    const data = await getJson<SerpApiResponse>(url.toString(), {}, this.name);
    return (data.organic_results ?? [])
      .filter((i) => i.link)
      .map((i, idx) => ({
        title: i.title ?? "",
        url: i.link!,
        snippet: i.snippet ?? "",
        displayUrl: i.displayed_link ?? hostOf(i.link!),
        rank: idx + 1,
        query,
      }));
  }
}

// ---------------------------------------------------------------------- Bing
interface BingResponse {
  webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> };
}

export class BingProvider implements SearchProvider {
  readonly name = "bing";
  get configured() {
    return Boolean(config.search.bingKey);
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL(config.search.bingEndpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(20, limit)));
    url.searchParams.set("responseFilter", "Webpages");
    const data = await getJson<BingResponse>(
      url.toString(),
      { "Ocp-Apim-Subscription-Key": config.search.bingKey },
      this.name,
    );
    return (data.webPages?.value ?? [])
      .filter((i) => i.url)
      .map((i, idx) => ({
        title: i.name ?? "",
        url: i.url!,
        snippet: i.snippet ?? "",
        displayUrl: hostOf(i.url!),
        rank: idx + 1,
        query,
      }));
  }
}

// --------------------------------------------------------------------- Brave
interface BraveResponse {
  web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
}

export class BraveProvider implements SearchProvider {
  readonly name = "brave";
  get configured() {
    return Boolean(config.search.braveKey);
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(20, limit)));
    const data = await getJson<BraveResponse>(
      url.toString(),
      { "X-Subscription-Token": config.search.braveKey },
      this.name,
    );
    return (data.web?.results ?? [])
      .filter((i) => i.url)
      .map((i, idx) => ({
        title: i.title ?? "",
        url: i.url!,
        snippet: i.description ?? "",
        displayUrl: hostOf(i.url!),
        rank: idx + 1,
        query,
      }));
  }
}

// -------------------------------------------------------------- Null provider
export class NullSearchProvider implements SearchProvider {
  readonly name = "none";
  readonly configured = false;
  async search(): Promise<SearchResult[]> {
    throw new SearchError(
      "No web search provider is configured. Set SEARCH_PROVIDER and the matching API key.",
      503,
      "none",
    );
  }
}

let cached: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  switch (config.search.provider) {
    case "google_cse":
      cached = new GoogleCseProvider();
      break;
    case "serpapi":
      cached = new SerpApiProvider();
      break;
    case "bing":
      cached = new BingProvider();
      break;
    case "brave":
      cached = new BraveProvider();
      break;
    default:
      cached = new NullSearchProvider();
  }
  return cached;
}


export type { SearchProvider, SearchResult };
export { SearchError };
