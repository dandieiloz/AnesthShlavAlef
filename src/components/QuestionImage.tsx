import Image from "next/image";

export function QuestionImage({
  url,
  alt,
  className = "",
}: {
  url: string | null | undefined;
  alt: string | null | undefined;
  className?: string;
}) {
  if (!url) return null;
  return (
    <div className={`my-3 ${className}`}>
      <Image
        src={url}
        alt={alt ?? ""}
        width={800}
        height={600}
        className="max-h-[420px] w-auto rounded border bg-muted/30 object-contain"
        unoptimized
      />
    </div>
  );
}
