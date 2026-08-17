import { ArrowUp, CircleNotch, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

interface ZhihuDirectPanelProps {
  petImage: string;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "error";
  content: string;
}

export function ZhihuDirectPanel({ petImage, onClose }: ZhihuDirectPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(1);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, submitting]);

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || submitting) {
      return;
    }

    const userMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: "user",
      content: question,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSubmitting(true);

    try {
      const result = await window.lookMe?.askZhihuDirect(question);
      const reply: ChatMessage = result?.ok
        ? {
            id: nextMessageId.current++,
            role: "assistant",
            content: result.answer,
          }
        : {
            id: nextMessageId.current++,
            role: "error",
            content:
              result?.error.message ??
              "当前预览环境未连接知乎 CLI，请在桌面应用中使用。",
          };
      setMessages((current) => [...current, reply]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId.current++,
          role: "error",
          content: "知乎直答暂时不可用，请稍后重试。",
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="zhihu-direct-panel" data-interactive aria-label="知乎直答聊天框">
      <header className="zhihu-direct-header">
        <span className="zhihu-direct-mode">zhihu cli</span>
        <strong>New chat</strong>
        <button
          className="zhihu-direct-close"
          type="button"
          title="关闭知乎直答"
          aria-label="关闭知乎直答"
          onClick={onClose}
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="zhihu-direct-messages" ref={messagesRef} aria-live="polite">
        {messages.length === 0 && !submitting && (
          <div className="zhihu-direct-watermark" aria-hidden>
            <img src={petImage} alt="" />
          </div>
        )}
        {messages.map((message) => (
          <p
            className={`zhihu-direct-message zhihu-direct-message--${message.role}`}
            key={message.id}
            role={message.role === "error" ? "alert" : undefined}
          >
            {message.content}
          </p>
        ))}
        {submitting && (
          <p className="zhihu-direct-message zhihu-direct-message--assistant zhihu-direct-message--loading">
            <CircleNotch size={14} weight="bold" aria-hidden />
            正在调用知乎直答
          </p>
        )}
      </div>

      <form className="zhihu-direct-composer" onSubmit={submitQuestion}>
        <label className="sr-only" htmlFor="zhihu-direct-question">
          输入问题
        </label>
        <input
          id="zhihu-direct-question"
          value={input}
          maxLength={1_000}
          placeholder="问知乎直答"
          autoComplete="off"
          autoFocus
          disabled={submitting}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          className={
            submitting
              ? "zhihu-direct-send zhihu-direct-send--loading"
              : "zhihu-direct-send"
          }
          type="submit"
          title="发送"
          aria-label="发送问题"
          disabled={!input.trim() || submitting}
        >
          {submitting ? (
            <CircleNotch size={16} weight="bold" aria-hidden />
          ) : (
            <ArrowUp size={16} weight="bold" aria-hidden />
          )}
        </button>
      </form>
    </section>
  );
}
