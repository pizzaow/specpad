/**
 * Markdown — the one renderer for every prose document SpecPad shows.
 *
 * The markdown *declares where diagrams go*: each `![alt](name.svg)` is replaced by the
 * matching SVG from the loaded diagram map, so a document places its own figures without
 * containing any markup. A reference that does not resolve is named rather than dropped,
 * because a missing diagram is information.
 *
 * Extracted from the architecture, detailed-design and security views, which had three
 * copies of it.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  md: string;
  diagrams?: Record<string, string>;
}

const Markdown: React.FC<MarkdownProps> = ({ md, diagrams }) => (
  <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src, alt }) => {
          const svg = src ? diagrams?.[src] : undefined;
          if (svg) {
            return (
              <span
                className="arch-diagram"
                role="img"
                aria-label={alt}
                style={{ display: 'block', overflow: 'auto', margin: '10px 0' }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            );
          }
          return <span className="text-muted">[diagram: {src}]</span>;
        },
      }}
    >
      {md}
    </ReactMarkdown>
  </div>
);

export default Markdown;
