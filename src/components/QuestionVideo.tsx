type EmbedKind =
  | { kind: "youtube"; id: string; start?: number }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; url: string }
  | { kind: "iframe"; url: string };

function parseVideoUrl(raw: string): EmbedKind | null {
  const url = raw.trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) {
      const t = u.searchParams.get("t") ?? u.searchParams.get("start");
      return { kind: "youtube", id, start: t ? parseTimeToSeconds(t) : undefined };
    }
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v");
    if (id) {
      const t = u.searchParams.get("t") ?? u.searchParams.get("start");
      return { kind: "youtube", id, start: t ? parseTimeToSeconds(t) : undefined };
    }
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
    if (m) return { kind: "youtube", id: m[1] };
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})/);
    if (m) return { kind: "vimeo", id: m[1] };
  }

  // Direct video file
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u.pathname)) {
    return { kind: "file", url };
  }

  // Fallback: assume embeddable iframe URL
  return { kind: "iframe", url };
}

function parseTimeToSeconds(t: string): number {
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0", 10) * 3600) + (parseInt(m[2] ?? "0", 10) * 60) + parseInt(m[3] ?? "0", 10);
}

export function QuestionVideo({
  url,
  className = "",
}: {
  url: string | null | undefined;
  className?: string;
}) {
  if (!url) return null;
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  const wrapperClass = `my-3 max-w-2xl ${className}`;
  const aspectClass = "relative w-full overflow-hidden rounded border bg-black aspect-video";

  if (parsed.kind === "file") {
    return (
      <div className={wrapperClass}>
        <video
          src={parsed.url}
          className="w-full max-h-[480px] rounded border bg-black"
          controls
          autoPlay
          muted
          playsInline
          loop={false}
        />
      </div>
    );
  }

  if (parsed.kind === "youtube") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
    });
    if (parsed.start) params.set("start", String(parsed.start));
    const src = `https://www.youtube-nocookie.com/embed/${parsed.id}?${params.toString()}`;
    return (
      <div className={wrapperClass}>
        <div className={aspectClass}>
          <iframe
            src={src}
            title="video"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (parsed.kind === "vimeo") {
    const src = `https://player.vimeo.com/video/${parsed.id}?autoplay=1&muted=1&playsinline=1`;
    return (
      <div className={wrapperClass}>
        <div className={aspectClass}>
          <iframe
            src={src}
            title="video"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className={aspectClass}>
        <iframe
          src={parsed.url}
          title="video"
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
