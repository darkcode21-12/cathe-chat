import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileIcon, Download } from "lucide-react";

interface Props {
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
}

export const MessageAttachment = ({ fileUrl, fileType, fileName }: Props) => {
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.storage.from("chat-files").createSignedUrl(fileUrl, 3600).then(({ data }) => {
      if (active && data) setSigned(data.signedUrl);
    });
    return () => { active = false; };
  }, [fileUrl]);

  if (!signed) {
    return <div className="h-24 w-48 rounded-lg bg-muted/50 animate-pulse" />;
  }

  const safeImageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (fileType && safeImageTypes.includes(fileType)) {
    return (
      <img src={signed} alt={fileName || "attachment"} className="max-w-xs max-h-64 rounded-lg object-cover" loading="lazy" />
    );
  }

  if (fileType?.startsWith("audio/")) {
    return <audio controls src={signed} className="max-w-xs" />;
  }

  if (fileType?.startsWith("video/")) {
    return <video controls src={signed} className="max-w-xs max-h-64 rounded-lg" />;
  }

  return (
    <a href={signed} download={fileName || true} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 hover:bg-background/60 transition-colors max-w-xs">
      <FileIcon className="size-5 shrink-0" />
      <span className="truncate text-sm flex-1">{fileName || "Download file"}</span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
};