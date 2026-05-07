"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="px-1 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 text-[13px] font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`${codeClassName ?? ""} block bg-gray-200 dark:bg-zinc-700 rounded p-2 my-1 text-[13px] font-mono overflow-x-auto`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <pre className="bg-gray-200 dark:bg-zinc-700 rounded p-2 my-1 overflow-x-auto text-[13px]">{children}</pre>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 underline hover:no-underline">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-1">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-zinc-600 text-[13px]">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-gray-300 dark:border-zinc-600 px-2 py-1 bg-gray-100 dark:bg-zinc-700 font-semibold text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-gray-300 dark:border-zinc-600 px-2 py-1">{children}</td>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-3 border-gray-300 dark:border-zinc-600 pl-3 my-1 text-gray-600 dark:text-zinc-400 italic">{children}</blockquote>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mt-1.5 mb-0.5">{children}</h3>;
          },
          p({ children }) {
            return <p className="my-1 leading-relaxed">{children}</p>;
          },
          hr() {
            return <hr className="my-2 border-gray-300 dark:border-zinc-600" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
