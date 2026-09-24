export type VideoSource =
  | { kind: "youtube"; id: string; embed: string; thumb: string }
  | { kind: "vimeo"; id: string; embed: string; thumb: null }
  | { kind: "file-url"; src: string; thumb: null }
  | { kind: "link"; href: string; thumb: null };

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

/** Works out how to play a pasted link: embedded player, direct video file, or plain external link. */
export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (/^[\w-]{6,}$/.test(id)) {
      return { kind: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg` };
    }
  }
  if (host.endsWith("vimeo.com")) {
    const id = u.pathname.split("/").filter(Boolean).find((s) => /^\d+$/.test(s));
    if (id) return { kind: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumb: null };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: "file-url", src: raw, thumb: null };
  return { kind: "link", href: raw, thumb: null };
}

export const MAX_VIDEO_MB = 50;
