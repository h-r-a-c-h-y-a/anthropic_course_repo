"use client";

import { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

function filename(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  return path.split("/").filter(Boolean).pop() ?? null;
}

function getToolLabel(toolName: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;

  if (toolName === "str_replace_editor") {
    const file = filename(args.path);
    switch (args.command) {
      case "create":    return file ? `Creating ${file}`  : "Creating file";
      case "str_replace":
      case "insert":    return file ? `Editing ${file}`   : "Editing file";
      case "view":      return file ? `Reading ${file}`   : "Reading file";
      case "undo_edit": return file ? `Reverting ${file}` : "Reverting file";
      default:          return file ? `Writing ${file}`   : "Writing file";
    }
  }

  if (toolName === "file_manager") {
    const file = filename(args.path);
    switch (args.command) {
      case "delete": return file ? `Deleting ${file}` : "Deleting file";
      case "rename": {
        const newFile = filename(args.new_path);
        return newFile ? `Renaming to ${newFile}` : file ? `Renaming ${file}` : "Renaming file";
      }
      default: return "Managing files";
    }
  }

  return toolName;
}

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6">
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={cn(
              "flex gap-4",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0">
                <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center">
                  <Bot className="h-4.5 w-4.5 text-neutral-700" />
                </div>
              </div>
            )}

            <div className={cn(
              "flex flex-col gap-2 max-w-[85%]",
              message.role === "user" ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "rounded-xl px-4 py-3",
                message.role === "user"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-neutral-900 border border-neutral-200 shadow-sm"
              )}>
                <div className="text-sm">
                  {message.parts ? (
                    <>
                      {message.parts.map((part, partIndex) => {
                        if (part.type === "text") {
                          return message.role === "user" ? (
                            <span key={partIndex} className="whitespace-pre-wrap">{part.text}</span>
                          ) : (
                            <MarkdownRenderer
                              key={partIndex}
                              content={part.text}
                              className="prose-sm"
                            />
                          );
                        }

                        if (part.type === "reasoning") {
                          return (
                            <div key={partIndex} className="mt-3 p-3 bg-white/50 rounded-md border border-neutral-200">
                              <span className="text-xs font-medium text-neutral-600 block mb-1">Reasoning</span>
                              <span className="text-sm text-neutral-700">{part.text}</span>
                            </div>
                          );
                        }

                        if (part.type === "dynamic-tool") {
                          const isDone = part.state === "output-available" || part.state === "output-error" || part.state === "output-denied";
                          const hasOutput = isDone && "output" in part && part.output != null;
                          return (
                            <div key={partIndex} className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
                              {hasOutput ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                  <span className="text-neutral-700">{getToolLabel(part.toolName, part.input)}</span>
                                </>
                              ) : (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                  <span className="text-neutral-700">{getToolLabel(part.toolName, part.input)}</span>
                                </>
                              )}
                            </div>
                          );
                        }

                        if (part.type === "source-url") {
                          return (
                            <div key={partIndex} className="mt-2 text-xs text-neutral-500">
                              Source: {part.url}
                            </div>
                          );
                        }

                        if (part.type === "step-start") {
                          return partIndex > 0 ? <hr key={partIndex} className="my-3 border-neutral-200" /> : null;
                        }

                        return null;
                      })}
                      {isLoading &&
                        message.role === "assistant" &&
                        messages.indexOf(message) === messages.length - 1 &&
                        message.parts.length === 0 && (
                          <div className="flex items-center gap-2 mt-3 text-neutral-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-sm">Generating...</span>
                          </div>
                        )}
                    </>
                  ) : (message as any).content ? (
                    message.role === "user" ? (
                      <span className="whitespace-pre-wrap">{(message as any).content}</span>
                    ) : (
                      <MarkdownRenderer content={(message as any).content} className="prose-sm" />
                    )
                  ) : isLoading &&
                    message.role === "assistant" &&
                    messages.indexOf(message) === messages.length - 1 ? (
                    <div className="flex items-center gap-2 text-neutral-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-sm">Generating...</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0">
                <div className="w-9 h-9 rounded-lg bg-blue-600 shadow-sm flex items-center justify-center">
                  <User className="h-4.5 w-4.5 text-white" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
