"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// pdfjs version pinned — loaded at runtime via <script> to bypass webpack ESM issues
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

export interface UploadedDoc {
  docId: string;
  fileName: string;
  objectUrl: string;
  fileType: "pdf" | "docx" | "txt";
  textContent?: string;
}

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  fileType?: UploadedDoc["fileType"];
  textContent?: string;
  highlightText?: string;
  onClose: () => void;
  allDocs?: UploadedDoc[];
  onSelectDoc?: (doc: UploadedDoc) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

// ── Load pdfjs once via a script tag — completely bypasses webpack ─────────────
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  const w = window as any;
  if (w.__pdfjsLib) return Promise.resolve(w.__pdfjsLib);
  if (w.__pdfjsLoading) return w.__pdfjsLoading;

  w.__pdfjsLoading = new Promise<any>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      w.__pdfjsLib = lib;
      resolve(lib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return w.__pdfjsLoading;
}

export default function PDFViewer({ fileUrl, fileName, fileType = "pdf", textContent, highlightText, onClose }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);          // loaded pdf document
  const renderTaskRef = useRef<any>(null);    // current render task (to cancel on re-render)

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showBadge, setShowBadge] = useState(false);
  const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
  const isPdf = fileType === "pdf";

  // ── Load the PDF document once ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPdf) {
      pdfRef.current = null;
      setNumPages(0);
      setCurrentPage(1);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    loadPdfJs().then(async (pdfjsLib) => {
      try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => { cancelled = true; };
  }, [fileUrl, isPdf]);

  // ── Render the current page to canvas ──────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number, sc: number) => {
    if (!pdfRef.current || !canvasRef.current) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    const page = await pdfRef.current.getPage(pageNum);
    const viewport = page.getViewport({ scale: sc });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;

    try {
      await task.promise;
    } catch (e: any) {
      if (e?.name === "RenderingCancelledException") return;
      return;
    }

    // After render, draw text highlights if needed
    if (highlightText) {
      await drawHighlights(page, viewport, ctx, highlightText);
    }
  }, [highlightText]);

  // Re-render whenever page or scale changes
  useEffect(() => {
    if (isPdf && status === "ready") renderPage(currentPage, scale);
  }, [currentPage, scale, status, renderPage, isPdf]);

  // ── Draw yellow highlight boxes over matching text items ───────────────────
  async function drawHighlights(page: any, viewport: any, ctx: CanvasRenderingContext2D, query: string) {
    const textContent = await page.getTextContent();
    const needle = query.toLowerCase().trim();
    if (!needle) return;

    // Build a flat string of all text items with their positions
    ctx.save();
    ctx.fillStyle = "rgba(251, 191, 36, 0.40)"; // amber-400 at 40% opacity
    ctx.strokeStyle = "rgba(245, 158, 11, 0.70)";
    ctx.lineWidth = 1;

    let foundAny = false;
    let firstMatchY: number | null = null;

    for (const item of textContent.items as any[]) {
      const text: string = item.str ?? "";
      if (!text.toLowerCase().includes(needle.slice(0, 20))) continue;

      // Transform PDF coordinates → canvas coordinates
      const tx = viewport.transform;
      // item.transform = [scaleX, skewX, skewY, scaleY, transX, transY]
      const [a, b, c, d, e, f] = item.transform;
      // Apply viewport transform
      const x = tx[0] * e + tx[2] * f + tx[4];
      const y = tx[1] * e + tx[3] * f + tx[5];
      const w = Math.abs(a * item.width * tx[0]);
      const h = Math.abs(d * item.height); // item.height is font size

      const rectX = x;
      const rectY = y - h;
      const rectW = w > 0 ? w : item.width * scale;
      const rectH = h > 0 ? h * 1.1 : 14 * scale;

      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
      foundAny = true;

      if (firstMatchY === null) firstMatchY = rectY;
    }

    ctx.restore();

    // Scroll the canvas container to show the first highlight
    if (foundAny && firstMatchY !== null && containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      containerRef.current.scrollTop = Math.max(0, firstMatchY - containerHeight / 3);
    }
  }

  // ── When highlightText changes: show badge, re-render current page, search across pages ──
  useEffect(() => {
    if (!highlightText || status !== "ready" || !pdfRef.current || !isPdf) return;

    setShowBadge(true);
    const t = setTimeout(() => setShowBadge(false), 6000);

    // Find which page contains the text, jump to it, then render with highlights
    (async () => {
      const needle = highlightText.toLowerCase().trim().slice(0, 30);
      for (let p = 1; p <= pdfRef.current.numPages; p++) {
        const page = await pdfRef.current.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = (textContent.items as any[]).map((i: any) => i.str ?? "").join(" ").toLowerCase();
        if (pageText.includes(needle)) {
          setCurrentPage(p);   // triggers renderPage via the useEffect above
          break;
        }
      }
    })();

    return () => clearTimeout(t);
  }, [highlightText, status, isPdf]);

  // ── Controls ────────────────────────────────────────────────────────────────
  const zoom = (delta: number) => setScale(s => Math.min(3, Math.max(0.5, +(s + delta).toFixed(1))));
  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(numPages, p + 1));

  const ctrlBtn = (label: string, onClick: () => void, disabled: boolean, content: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
        opacity: disabled ? 0.35 : 1,
        padding: "4px 6px", borderRadius: "var(--radius-sm)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background var(--transition-fast), color var(--transition-fast)",
        fontSize: 15, lineHeight: 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-3)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
        (e.currentTarget as HTMLButtonElement).style.color = disabled ? "var(--text-tertiary)" : "var(--text-secondary)";
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-surface)" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        flexShrink: 0, gap: 8,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent-teal, #0d9488)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
            {fileName || "Document Viewer"}
          </span>
          {showBadge && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: "2px 8px", borderRadius: "var(--radius-full)",
              background: "rgba(245,158,11,0.18)", color: "#f59e0b",
              border: "1px solid rgba(245,158,11,0.35)",
              flexShrink: 0, animation: "gk-fadein 0.25s ease",
              whiteSpace: "nowrap",
            }}>
              ✦ Source highlighted
            </span>
          )}
        </div>

        {/* Right: zoom + page nav + open + close */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {/* Zoom out */}
          {isPdf && ctrlBtn("Zoom out", () => zoom(-0.1), scale <= 0.5,
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          )}
          {isPdf && <span style={{ fontSize: 11, color: "var(--text-tertiary)", width: 32, textAlign: "center", userSelect: "none" }}>
            {Math.round(scale * 100)}%
          </span>}
          {/* Zoom in */}
          {isPdf && ctrlBtn("Zoom in", () => zoom(+0.1), scale >= 3,
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          )}

          {isPdf && <div style={{ width: 1, height: 16, background: "var(--border-medium)", margin: "0 4px" }} />}

          {/* Prev */}
          {isPdf && ctrlBtn("Previous page", prevPage, currentPage <= 1, "‹")}
          {isPdf && <span style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "0 3px", userSelect: "none", whiteSpace: "nowrap" }}>
            {currentPage} / {numPages || "–"}
          </span>}
          {/* Next */}
          {isPdf && ctrlBtn("Next page", nextPage, currentPage >= numPages, "›")}

          <div style={{ width: 1, height: 16, background: "var(--border-medium)", margin: "0 4px" }} />

          {/* Open in new tab */}
          {ctrlBtn("Open document in new tab", () => window.open(fileUrl, "_blank"), false,
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            title="Close document viewer"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-tertiary)", padding: "4px 6px",
              borderRadius: "var(--radius-sm)", display: "flex",
              alignItems: "center", justifyContent: "center",
              transition: "background var(--transition-fast), color var(--transition-fast)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflowY: "auto", overflowX: "auto",
          background: "var(--bg-base)",
          display: "flex", justifyContent: "center",
          padding: "16px 8px",
          position: "relative",
        }}
      >
        {status === "loading" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"
              style={{ animation: "gk-spin 0.9s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading PDF…</span>
          </div>
        )}

        {status === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span style={{ fontSize: 13, color: "#f87171" }}>Failed to load PDF.</span>
            <button onClick={() => window.open(fileUrl, "_blank")}
              style={{ fontSize: 12, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Open in browser tab instead
            </button>
          </div>
        )}

        {!isPdf && status === "ready" && (
          <pre style={{
            width: "100%",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 13,
            lineHeight: 1.65,
            color: "var(--text-primary)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "16px",
          }}>
            {textContent || "No extracted text is available for this document."}
          </pre>
        )}

        {/* The canvas pdfjs renders into */}
        <canvas
          ref={canvasRef}
          style={{
            display: isPdf && status === "ready" ? "block" : "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            borderRadius: 4,
            maxWidth: "100%",
          }}
        />
      </div>

      <style>{`
        @keyframes gk-spin   { from { transform: rotate(0deg)  } to { transform: rotate(360deg) } }
        @keyframes gk-fadein { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
