"use client";

import dynamic from "next/dynamic";
import type { PdfViewerProps } from "./pdf-viewer";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[400px]">
      <div className="w-10 h-10 border-[3px] border-surface-2 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

export default function PdfViewerLazy(props: PdfViewerProps) {
  return <PdfViewer {...props} />;
}
