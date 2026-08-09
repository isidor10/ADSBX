import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's structured-output helper is built against the Zod v4 API, which
// zod@3.25+ exposes on this subpath.
import * as z from "zod/v4";
import { config } from "@/lib/config";
import type { OwnerKind } from "@/lib/types";
import type { SearchResult } from "@/lib/search/types";
import type { FaaOwnerRecord } from "./faa";

/**
 * Optional refinement pass: hand the gathered evidence to Claude and get back a
 * structured reading of it.
 *
 * This never replaces the evidence — the model is given only the search
 * snippets and (when available) the official registry record, and is
 * instructed to answer "not found" whenever those do not support a conclusion.
 * Its output is merged with the deterministic scorer in `service.ts`, which
 * keeps the source links as the ultimate authority.
 *
 * Disabled unless OWNERSHIP_LLM_ENABLED=true and ANTHROPIC_API_KEY is set.
 */

const OwnerKindEnum = z.enum([
  "REGISTERED_OWNER",
  "OPERATOR",
  "MANAGEMENT_COMPANY",
  "CHARTER_OPERATOR",
  "TRUSTEE",
  "BENEFICIAL_OWNER",
  "UNKNOWN",
]);

const AnalysisSchema = z.object({
  found: z
    .boolean()
    .describe("True only if the sources name an owner or operator for this exact registration."),
  owner: z
    .string()
    .describe("Registered owner exactly as named in the sources, or an empty string if not found."),
  owner_kind: OwnerKindEnum.describe("What the named party actually is, per the sources."),
  operator: z.string().describe("Operator if the sources name one distinctly, else empty string."),
  management_company: z.string().describe("Management company if named, else empty string."),
  charter_operator: z.string().describe("Charter operator if named, else empty string."),
  beneficial_owner_confirmed: z
    .boolean()
    .describe(
      "True only if a source explicitly identifies the ultimate beneficial owner behind the registered entity.",
    ),
  confidence: z.number().describe("0-100. Above 75 requires at least two independent sources."),
  evidence: z
    .string()
    .describe("Two or three sentences citing which source said what. No speculation."),
  source_urls: z.array(z.string()).describe("URLs from the provided list that support the answer."),
});

export type LlmAnalysis = z.infer<typeof AnalysisSchema>;

export interface LlmAnalysisResult {
  owner: string | null;
  ownerKind: OwnerKind;
  operator: string | null;
  managementCompany: string | null;
  charterOperator: string | null;
  beneficialOwnerConfirmed: boolean;
  confidence: number;
  evidence: string;
  sourceUrls: string[];
  model: string;
}

const SYSTEM_PROMPT = `You determine aircraft ownership from public sources for an aviation intelligence tool.

You are given a tail number and a set of web search results (title, URL, snippet), sometimes with an official civil aviation registry record.

Rules:
- Use only the supplied material. You have no other knowledge of this aircraft, and you must not infer an owner from the registration itself, from the aircraft type, or from what is plausible.
- The registered owner is frequently a bank trustee or a single-purpose LLC. Report what the sources say the entity is; do not resolve it to a person unless a source states that link explicitly.
- Set beneficial_owner_confirmed only when a source names the ultimate beneficial owner behind the registered entity. Reporting on a person "using", "linked to", or "associated with" a jet is not confirmation.
- A source that does not mention this exact registration is not evidence.
- If the material does not establish an owner, set found=false and leave the name fields empty. That is a correct and useful answer — a wrong name is not.
- Confidence above 75 requires agreement across at least two independent sources, or an official registry record.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.llm.apiKey, maxRetries: 1 });
  }
  return client;
}

export function llmEnabled(): boolean {
  return config.llm.enabled && Boolean(config.llm.apiKey);
}

function buildPrompt(
  registration: string,
  results: SearchResult[],
  faa: FaaOwnerRecord | null,
): string {
  const lines: string[] = [`Aircraft registration: ${registration}`, ""];

  if (faa) {
    lines.push("Official registry record (FAA Civil Aviation Registry):");
    lines.push(`  Registered owner: ${faa.registrantName}`);
    if (faa.registrantTypeLabel) lines.push(`  Registrant type: ${faa.registrantTypeLabel}`);
    if (faa.address) lines.push(`  Address: ${faa.address}`);
    if (faa.manufacturer || faa.model)
      lines.push(`  Aircraft: ${[faa.manufacturer, faa.model].filter(Boolean).join(" ")}`);
    lines.push(`  Source: ${faa.source.url}`);
    lines.push("");
  }

  lines.push("Web search results:");
  results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`    URL: ${r.url}`);
    lines.push(`    ${r.snippet.replace(/\s+/g, " ").slice(0, 400)}`);
  });

  if (results.length === 0) lines.push("  (none)");

  return lines.join("\n");
}

export async function analyzeWithLlm(
  registration: string,
  results: SearchResult[],
  faa: FaaOwnerRecord | null,
): Promise<LlmAnalysisResult | null> {
  if (!llmEnabled()) return null;

  try {
    const response = await getClient().messages.parse(
      {
        model: config.llm.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: "low",
          format: zodOutputFormat(AnalysisSchema),
        },
        messages: [{ role: "user", content: buildPrompt(registration, results, faa) }],
      },
      { timeout: config.llm.timeoutMs },
    );

    const parsed = response.parsed_output;
    if (!parsed || !parsed.found || !parsed.owner.trim()) return null;

    return {
      owner: parsed.owner.trim(),
      ownerKind: parsed.owner_kind as OwnerKind,
      operator: parsed.operator.trim() || null,
      managementCompany: parsed.management_company.trim() || null,
      charterOperator: parsed.charter_operator.trim() || null,
      // Never let the model alone assert beneficial ownership without sources.
      beneficialOwnerConfirmed:
        parsed.beneficial_owner_confirmed && parsed.source_urls.length >= 2,
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
      evidence: parsed.evidence.trim(),
      sourceUrls: parsed.source_urls.filter((u) => /^https?:\/\//.test(u)),
      model: config.llm.model,
    };
  } catch (error) {
    console.warn("[ownership:llm]", (error as Error).message);
    return null;
  }
}
