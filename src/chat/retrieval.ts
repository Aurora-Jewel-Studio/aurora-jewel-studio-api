import { readFileSync } from "fs";
import path from "path";

export type KnowledgeChunk = {
  source: string;
  heading: string;
  category: "comparison" | "gemstone" | "policy" | "product" | "sizing" | "styling";
  content: string;
  productTitle?: string;
  collection?: string;
  score?: number;
};

const FILES = [
  ["aurora-comparison-guide.md", "comparison"],
  ["aurora-gemstone-education.md", "gemstone"],
  ["aurora-policies-and-customization.md", "policy"],
  ["aurora-product-catalog-consultant-ready.md", "product"],
  ["aurora-size-guide.html", "sizing"],
  ["aurora-styling-guide.md", "styling"],
] as const;

const STOP_WORDS = new Set(
  "a an and are as at be by can could do for from has have how i in is it me my of on or our please should that the their them they this to want what when where which who why with would you your".split(
    " ",
  ),
);

const SYNONYMS: Record<string, string[]> = {
  allergy: ["allergic", "nickel", "hypoallergenic", "sensitive"],
  allergic: ["allergy", "nickel", "hypoallergenic", "sensitive"],
  clean: ["care", "cleaning", "polish", "tarnish"],
  delivery: ["shipping", "ship", "dispatch"],
  gift: ["gifting", "birthday", "anniversary", "recipient"],
  refund: ["return", "exchange", "damaged"],
  return: ["refund", "exchange", "damaged"],
  ship: ["shipping", "delivery", "international"],
  size: ["sizing", "fit", "measure", "diameter"],
  wedding: ["bridal", "engagement", "occasion"],
};

function stem(token: string) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  const base = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return [...new Set(base.flatMap((token) => [stem(token), ...(SYNONYMS[token] || []).map(stem)]))];
}

function cleanContent(content: string, product = false) {
  let cleaned = content.replace(/OmbrÃ©/g, "Ombré").replace(/\s+/g, " ").trim();
  if (product) {
    cleaned = cleaned
      .replace(/\s*·\s*\$[\d,.]+/g, "")
      .replace(/\s*\(\$[\d,.]+\)/g, "");
  }
  return cleaned;
}

function splitMarkdown(source: string, category: KnowledgeChunk["category"], markdown: string) {
  if (category === "product") return splitProducts(source, markdown);

  const matches = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  return matches
    .map((match, index) => ({
      source,
      heading: match[2].trim(),
      category,
      content: cleanContent(markdown.slice(match.index! + match[0].length, matches[index + 1]?.index)),
    }))
    .filter((chunk) => chunk.content);
}

function splitProducts(source: string, markdown: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let collection = "Product catalog";
  let current: { title: string; start: number; collection: string } | null = null;

  for (const match of markdown.matchAll(/^(?:##\s+(.+)|\*\*([^*\n]+)\*\*\s*·.*)$/gm)) {
    if (match[1]) {
      if (current) {
        chunks.push(productChunk(source, markdown, current, match.index!));
        current = null;
      }
      collection = match[1].trim();
    } else if (match[2]) {
      if (current) chunks.push(productChunk(source, markdown, current, match.index!));
      current = { title: match[2].trim(), start: match.index!, collection };
    }
  }
  if (current) chunks.push(productChunk(source, markdown, current, markdown.length));
  return chunks;
}

function productChunk(
  source: string,
  markdown: string,
  product: { title: string; start: number; collection: string },
  end: number,
): KnowledgeChunk {
  return {
    source,
    heading: product.title,
    category: "product",
    productTitle: product.title,
    collection: product.collection,
    content: cleanContent(markdown.slice(product.start, end), true),
  };
}

function splitSizeGuide(source: string, html: string): KnowledgeChunk[] {
  const intro = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const chunks: KnowledgeChunk[] = [
    { source, heading: "Aurora size guide", category: "sizing", content: cleanContent(intro) },
  ];

  for (const match of html.matchAll(/const\s+(ring|bracelet|necklace|earring|brooch)Data\s*=\s*\[([\s\S]*?)\];/g)) {
    chunks.push({
      source,
      heading: `${match[1][0].toUpperCase()}${match[1].slice(1)} size guide`,
      category: "sizing",
      content: cleanContent(match[2].replace(/[{}'";,]/g, " ").replace(/:/g, ": ")),
    });
  }
  return chunks;
}

function loadChunks() {
  const directory = path.resolve(__dirname, "../../knowledge");
  return FILES.flatMap(([source, category]) => {
    const content = readFileSync(path.join(directory, source), "utf8");
    return source.endsWith(".html")
      ? splitSizeGuide(source, content)
      : splitMarkdown(source, category, content);
  });
}

const CHUNKS = loadChunks();

export function lexicalScore(query: string, content: string, heading = "") {
  const queryTerms = tokens(query);
  if (!queryTerms.length) return 0;
  const contentTerms = tokens(content);
  const headingTerms = new Set(tokens(heading));
  const counts = new Map<string, number>();
  for (const term of contentTerms) counts.set(term, (counts.get(term) || 0) + 1);

  return queryTerms.reduce(
    (score, term) => score + (headingTerms.has(term) ? 4 : 0) + Math.min(counts.get(term) || 0, 3),
    0,
  );
}

export function retrieveKnowledge(query: string, limit = 5): KnowledgeChunk[] {
  return CHUNKS.map((chunk) => ({
    ...chunk,
    score: lexicalScore(query, chunk.content, chunk.heading),
  }))
    .filter((chunk) => (chunk.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

export function productKnowledge(title: string) {
  return CHUNKS.find(
    (chunk) => chunk.category === "product" && chunk.productTitle?.toLowerCase() === title.toLowerCase(),
  );
}
