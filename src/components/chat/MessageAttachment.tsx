import { FileIcon, Download } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
}

export const MessageAttachment = ({ fileUrl, fileType, fileName }: Props) => {
  const signed = fileUrl.startsWith("http") ? fileUrl : api.fileUrl(fileUrl);

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