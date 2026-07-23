import React, { useEffect } from 'react';
import { escapeRegExp } from '../../utils/helpers';

interface MarkdownViewerProps {
  markdown: string;
  highlightQuery?: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ markdown, highlightQuery }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightQuery && containerRef.current) {
      setTimeout(() => {
        const firstMark = containerRef.current?.querySelector("mark");
        if (firstMark) {
          firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }
  }, [markdown, highlightQuery]);

  if (!markdown || typeof markdown !== "string") {
    return <div className="text-gray-400 italic p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">Không có nội dung Markdown được trích xuất cho giáo án này.</div>;
  }

  const renderTextWithHighlight = (text: string) => {
    if (!text || typeof text !== "string") return "";
    if (!highlightQuery || !highlightQuery.trim()) {
      return text;
    }

    try {
      const queryClean = highlightQuery.trim();
      const escapedQuery = escapeRegExp(queryClean);
      if (!escapedQuery) return text;
      const regex = new RegExp("(" + escapedQuery + ")", "gi");
      const parts = text.split(regex);
      if (parts.length > 1) {
        return parts.map((part, i) =>
          part.toLowerCase() === queryClean.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 border border-yellow-300 rounded px-1 text-slate-900 font-extrabold shadow-sm animate-pulse mx-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        );
      }
    } catch (e) {
      console.error("Lỗi regex highlight:", e);
    }
    return text;
  };

  let renderedElements: React.ReactNode[] = [];
  try {
    const lines = markdown.split("\n");
    let inList = false;
    let listItems: string[] = [];
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        renderedElements.push(
          <ul key={key} className="list-disc pl-6 my-4 space-y-2 text-gray-700 text-sm">
            {listItems.map((item, idx) => (
              <li key={idx}>{renderTextWithHighlight(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const renderCellContent = (cellText: string) => {
      if (!cellText || typeof cellText !== "string") return "";
      const lines = cellText.split(/<br\s*\/?>/i);
      return lines.map((subLine, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <br />}
          {renderTextWithHighlight(subLine)}
        </React.Fragment>
      ));
    };

    const flushTable = (key: string) => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        renderedElements.push(
          <div key={key} className="overflow-x-auto my-5 border border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="w-full min-w-[600px] divide-y divide-gray-200 text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-gray-200">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-4 py-3.5 font-bold text-slate-800 bg-slate-100/70 border-r border-slate-200/60 last:border-r-0 whitespace-nowrap">{renderCellContent(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-700 bg-white">
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/70 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3.5 align-top leading-relaxed border-r border-slate-150/50 last:border-r-0" title={cell.replace(/<br\s*\/?>/gi, ' ')}>{renderCellContent(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const key = "line-" + index;

      if (trimmed.startsWith("|")) {
        flushList(key + "-pre-tbl");
        inTable = true;
        const cells = trimmed
          .split("|")
          .map(c => c.trim())
          .filter((c, i, arr) => i > 0 && i < arr.length - 1);

        if (trimmed.includes("---")) {
          return;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else {
        flushTable(key + "-pre-non-tbl");
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•")) {
        inList = true;
        const cleanText = trimmed.replace(/^[-*•]\s*/, "");
        listItems.push(cleanText);
        return;
      } else {
        flushList(key + "-pre-non-list");
      }

      if (trimmed.startsWith("# ")) {
        renderedElements.push(<h1 key={key} className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-4 border-b pb-2 border-slate-100">{renderTextWithHighlight(trimmed.slice(2))}</h1>);
      } else if (trimmed.startsWith("## ")) {
        renderedElements.push(<h2 key={key} className="text-lg font-bold text-slate-800 mt-5 mb-3">{renderTextWithHighlight(trimmed.slice(3))}</h2>);
      } else if (trimmed.startsWith("### ")) {
        renderedElements.push(<h3 key={key} className="text-sm sm:text-base font-bold text-blue-600 mt-4 mb-2.5">{renderTextWithHighlight(trimmed.slice(4))}</h3>);
      } else if (trimmed === "---") {
        renderedElements.push(<hr key={key} className="my-6 border-slate-200" />);
      } else if (trimmed) {
        let text = trimmed;
        const parts = text.split("**");
        if (parts.length > 1) {
          const lineContent: React.ReactNode[] = [];
          parts.forEach((part, pIdx) => {
            if (pIdx % 2 === 1) {
              lineContent.push(<strong key={pIdx} className="font-bold text-gray-950">{renderTextWithHighlight(part)}</strong>);
            } else {
              lineContent.push(renderTextWithHighlight(part));
            }
          });
          renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{lineContent}</p>);
        } else {
          renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{renderTextWithHighlight(trimmed)}</p>);
        }
      }
    });

    flushList("final-list");
    flushTable("final-table");
  } catch (err) {
    console.error("Lỗi parse markdown:", err);
    renderedElements = [<p key="err" className="text-sm text-red-500 italic">Đã xảy ra lỗi khi hiển thị nội dung tài liệu.</p>];
  }

  return (
    <div ref={containerRef} className="bg-slate-50/50 rounded-xl border border-gray-150 p-4 leading-relaxed max-w-none text-slate-800 shadow-inner">
      <div className="bg-white rounded-lg border border-gray-200/80 p-4 sm:p-5 shadow-sm">
        {renderedElements}
      </div>
    </div>
  );
};

export default MarkdownViewer;
