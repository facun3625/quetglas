// Enlaces de video de los slides. Se acepta siempre un LINK a un archivo de video (.mp4 / .webm): propio de la tienda
// (subido desde el panel), de Google Drive o Dropbox (se convierten al enlace de descarga directa) o de cualquier otro
// servidor. No se aceptan reproductores de YouTube/Vimeo: la portada reproduce el archivo en silencio y en bucle.

export type VideoCheck = { url: string; source: "propio" | "drive" | "dropbox" | "directo"; warning?: string } | { error: string };

const DRIVE_FILE = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/;
const DRIVE_ID = /^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]{10,})/;
const SAFE = /^https:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%\[\]]+$/;

export function checkVideoUrl(raw: string): VideoCheck {
  const input = (raw ?? "").trim();
  if (!input) return { error: "Pegá el enlace del video" };

  // Subido desde el panel de la tienda
  if (/^\/api\/uploads\/videos\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(input)) return { url: input, source: "propio" };

  if (!input.startsWith("https://")) return { error: "El enlace tiene que empezar con https://" };
  // Enlaces que llevan a una PÁGINA (álbum, carpeta, visor) y no al archivo del video
  if (/photos\.app\.goo\.gl|photos\.google\.com|goo\.gl\/photos/i.test(input)) {
    return { error: "Google Fotos no entrega el archivo del video (el enlace abre una página). Descargá el video y subilo desde acá, o ponelo en Google Drive y compartilo como “cualquiera con el enlace”." };
  }
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders|docs\.google\.com|1drv\.ms|onedrive\.live\.com|sharepoint\.com|wetransfer\.com|we\.tl/i.test(input)) {
    return { error: "Ese enlace abre una página o una carpeta, no el archivo del video. Usá el enlace al archivo (Drive: Compartir → “cualquiera con el enlace”) o subilo desde acá." };
  }
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(input)) {
    return { error: "YouTube y Vimeo no se pueden usar acá: usá el enlace a un archivo de video (.mp4) o subilo desde el panel." };
  }

  const drive = input.match(DRIVE_FILE) ?? input.match(DRIVE_ID);
  if (drive) {
    return {
      url: `https://drive.google.com/uc?export=download&id=${drive[1]}`,
      source: "drive",
      warning: "Google Drive limita los archivos grandes (más de unos 25 MB) y la cantidad de descargas: si el video no se ve, subilo desde el panel.",
    };
  }
  if (/^https:\/\/(www\.)?dropbox\.com\//i.test(input)) {
    const u = new URL(input);
    u.hostname = "dl.dropboxusercontent.com";
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return { url: u.toString(), source: "dropbox", warning: "Dropbox limita el tráfico de los archivos muy vistos: para una portada con mucha visita conviene subirlo desde el panel." };
  }
  if (!SAFE.test(input)) return { error: "El enlace tiene caracteres que no se pueden usar" };
  return { url: input, source: "directo" };
}

// Versión para guardar/mostrar: el enlace normalizado o vacío si no es válido
export function normalizeVideoUrl(raw: string): string {
  const r = checkVideoUrl(raw);
  return "url" in r ? r.url : "";
}
