import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Shared markdown renderer for AI chat messages.
 * Uses react-markdown + remark-gfm for full GFM support (tables, strikethrough, task lists, etc.)
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn("space-y-1.5 text-sm leading-relaxed", className)}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-3 mb-1 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-2.5 mb-1 text-foreground border-b border-border pb-0.5">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-0.5 text-foreground">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        code: ({ className: codeClassName, children, ...props }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={codeClassName} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-zinc-900 text-zinc-100 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="my-1 space-y-0.5 list-disc list-inside">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1 space-y-0.5 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-blue-500 pl-3 my-1 text-sm text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-2" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 text-left font-semibold text-xs">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1 text-xs">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
