import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { AIMessage } from "@/types";

interface ChatMessageProps {
  message: AIMessage;
  streaming?: boolean;
}

export function ChatMessage({ message, streaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
          isUser ? "bg-primary/20 text-primary" : "bg-gradient-to-br from-brand-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? "Eu" : "IA"}
      </div>

      {/* Message */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-primary/20 text-foreground rounded-tr-sm"
              : "glass border-border/50 rounded-tl-sm"
          }`}
        >
          <MarkdownContent content={message.content} streaming={streaming} />
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
  if (!content) {
    return <span className="animate-pulse">●●●</span>;
  }

  // Simple markdown rendering (code blocks, bold, inline code)
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            return <CodeBlock key={i} language={match[1] ?? ""} code={match[2].trim()} />;
          }
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="bg-secondary/80 px-1.5 py-0.5 rounded text-xs font-mono text-primary">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }

        // Regular text with line breaks
        return (
          <span key={i}>
            {part.split("\n").map((line, j) => (
              <span key={j}>
                {line}
                {j < part.split("\n").length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
      {streaming && <span className="animate-pulse">▋</span>}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80">
        <span className="text-xs text-muted-foreground font-mono">{language || "code"}</span>
        <button
          onClick={copy}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-background/50">
        <code className="text-xs font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}
