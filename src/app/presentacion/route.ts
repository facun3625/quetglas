import { readFile } from "node:fs/promises";
import path from "node:path";

const PRESENTATION_PATH = path.join(process.cwd(), "PRESENTACION_FUNCIONAL_Y_TECNICA.md");
const STORE_MANUAL_PATH = path.join(process.cwd(), "MANUAL_TIENDA.md");

type DocumentOptions = {
  browserTitle: string;
  headerLabel: string;
  firstHeadingId: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderMarkdown(markdown: string): { content: string; toc: string } {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  const headings: { level: number; text: string; id: string }[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(
        `<div class="code-block${language === "mermaid" ? " diagram" : ""}">` +
          `${language ? `<span class="code-label">${escapeHtml(language === "mermaid" ? "Diagrama" : language)}</span>` : ""}` +
          `<pre><code>${escapeHtml(code.join("\n"))}</code></pre></div>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/\*\*/g, "");
      const baseId = slugify(text);
      const repeated = headings.filter((item) => item.id === baseId || item.id.startsWith(`${baseId}-`)).length;
      const id = repeated > 0 ? `${baseId}-${repeated + 1}` : baseId;
      headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (line.trim().startsWith("|") && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1])) {
      const rows: string[][] = [];
      const splitRow = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = splitRow(line);
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      html.push(
        `<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      html.push(`<blockquote>${inlineMarkdown(quote.join(" "))}</blockquote>`);
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !lines[index].startsWith("```") &&
      !/^\s*(-|\d+\.)\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("|") &&
      !lines[index].startsWith("> ") &&
      !/^---+$/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }

  const toc = headings
    .filter((heading) => heading.level === 2)
    .map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
    .join("");

  return { content: html.join("\n"), toc };
}

function documentHtml(content: string, toc: string, options: DocumentOptions): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(options.browserTitle)}</title>
    <style>
      :root { --pink:#ef4f91; --pink-dark:#ca2d70; --ink:#26242a; --muted:#706874; --soft:#fff4f8; --line:#eadfe5; }
      * { box-sizing:border-box; }
      html { scroll-behavior:smooth; }
      body { margin:0; background:#f7f4f6; color:var(--ink); font:15px/1.7 Arial, Helvetica, sans-serif; }
      .top { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:14px 28px; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); backdrop-filter:blur(14px); }
      .brand { color:var(--ink); font-size:18px; font-weight:800; text-decoration:none; }
      .brand span { color:var(--pink); }
      .actions { display:flex; gap:10px; }
      button { border:0; border-radius:999px; padding:10px 16px; background:var(--pink); color:white; font-weight:700; cursor:pointer; }
      .layout { display:grid; grid-template-columns:260px minmax(0, 860px); justify-content:center; gap:34px; padding:34px 24px 80px; }
      nav { position:sticky; top:86px; align-self:start; max-height:calc(100vh - 110px); overflow:auto; padding:20px; border:1px solid var(--line); border-radius:18px; background:white; }
      nav strong { display:block; margin-bottom:10px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
      nav a { display:block; padding:6px 8px; border-radius:8px; color:var(--muted); font-size:13px; line-height:1.35; text-decoration:none; }
      nav a:hover { background:var(--soft); color:var(--pink-dark); }
      article { min-width:0; padding:50px 64px; border:1px solid var(--line); border-radius:22px; background:white; box-shadow:0 18px 50px rgba(54,28,42,.06); }
      h1 { margin:0 0 4px; font-size:42px; line-height:1.08; letter-spacing:-.04em; }
      h2 { margin:56px 0 18px; padding-top:8px; font-size:26px; line-height:1.25; letter-spacing:-.025em; }
      h3 { margin:34px 0 10px; font-size:19px; line-height:1.35; }
      h4 { margin:26px 0 8px; font-size:16px; }
      p { margin:10px 0 16px; }
      article > p:first-of-type { color:var(--muted); }
      strong { font-weight:750; }
      ul, ol { margin:10px 0 20px; padding-left:24px; }
      li { margin:6px 0; }
      hr { margin:34px 0; border:0; border-top:1px solid var(--line); }
      a { color:var(--pink-dark); }
      code { padding:2px 6px; border-radius:5px; background:#f5eef2; font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      blockquote { margin:18px 0; padding:18px 22px; border-left:4px solid var(--pink); border-radius:0 12px 12px 0; background:var(--soft); font-size:17px; }
      .table-wrap { margin:18px 0 28px; overflow:auto; border:1px solid var(--line); border-radius:12px; }
      table { width:100%; border-collapse:collapse; font-size:14px; }
      th, td { padding:11px 14px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
      th { background:var(--soft); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
      tr:last-child td { border-bottom:0; }
      .code-block { position:relative; margin:20px 0 28px; overflow:auto; border-radius:14px; background:#25232a; color:#f9f2f5; }
      .code-block pre { margin:0; padding:26px 22px 20px; }
      .code-block code { padding:0; background:transparent; color:inherit; white-space:pre; }
      .code-label { position:absolute; top:7px; right:12px; color:#d7cbd1; font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
      .diagram { background:#352a31; }
      @media (max-width: 900px) {
        .layout { display:block; padding:16px 12px 50px; }
        nav { position:static; max-height:none; margin-bottom:16px; }
        article { padding:34px 24px; border-radius:16px; }
        h1 { font-size:34px; }
        h2 { margin-top:44px; font-size:23px; }
        .top { padding:12px 16px; }
      }
      @media print {
        body { background:white; font-size:11pt; }
        .top, nav { display:none; }
        .layout { display:block; padding:0; }
        article { max-width:none; padding:0; border:0; box-shadow:none; }
        h2, h3 { break-after:avoid; }
        table, .code-block { break-inside:avoid; }
        @page { margin:1.7cm; }
      }
    </style>
  </head>
  <body>
    <header class="top">
      <a class="brand" href="#${escapeHtml(options.firstHeadingId)}">Cortopassi<span> - Tienda</span> · ${escapeHtml(options.headerLabel)}</a>
      <div class="actions"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>
    </header>
    <div class="layout">
      <nav aria-label="Índice"><strong>Contenido</strong>${toc}</nav>
      <article>${content}</article>
    </div>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const storeManual =
    request.headers.get("x-document-name") === "cortopassi-tienda" ||
    new URL(request.url).searchParams.get("documento") === "cortopassi-tienda";
  const documentPath = storeManual ? STORE_MANUAL_PATH : PRESENTATION_PATH;
  const options: DocumentOptions = storeManual
    ? {
        browserTitle: "Manual Cortopassi - Tienda | Cortopassi - Tienda",
        headerLabel: "Manual Cortopassi - Tienda",
        firstHeadingId: "manual-cortopassi-tienda",
      }
    : {
        browserTitle: "Presentación funcional y técnica | Cortopassi - Tienda",
        headerLabel: "Presentación",
        firstHeadingId: "cortopassi-tienda",
      };
  const markdown = await readFile(documentPath, "utf-8");
  const { content, toc } = renderMarkdown(markdown);

  return new Response(documentHtml(content, toc, options), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
