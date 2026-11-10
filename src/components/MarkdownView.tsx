import { renderMarkdown } from "../lib/markdown";

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}

export function Poem({ text }: { text: string }) {
  const stanzas = text.split(/\n{2,}/);
  return (
    <div className="poem">
      {stanzas.map((stanza) => (
        <p key={stanza.slice(0, 24)}>
          {stanza.split("\n").map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < stanza.split("\n").length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
