export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Host of the result, used for source-authority scoring. */
  displayUrl: string;
  rank: number;
  query: string;
}

export interface SearchProvider {
  readonly name: string;
  readonly configured: boolean;
  search(query: string, limit: number): Promise<SearchResult[]>;
}

export class SearchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
  ) {
    super(message);
    this.name = "SearchError";
  }
}
