import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import "../styles/ai-chat.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CLOSE_ANIMATION_MS = 220;

export default function AIChatPanel({ account }) {
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(null);
  const listRef = useRef(null);

  function closePanel() {
    setExiting(true);
    setTimeout(() => {
      setOpen(false);
      setExiting(false);
    }, CLOSE_ANIMATION_MS);
  }

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "ai:chat:result" && msg?.requestId === reqIdRef.current) {
        setLoading(false);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "user") {
            next.push({
              role: "assistant",
              reply: msg.reply || "No response.",
              analysis: msg.analysis || null,
              employees: msg.employees || [],
              drivers: msg.drivers || [],
              error: msg.ok === false ? (msg.error || "Error") : null,
            });
          }
          return next;
        });
      }
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  function send() {
    const text = input.trim();
    if (!text || !window.api?.wsSend) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    reqIdRef.current = rid();
    window.api.wsSend({
      type: "ai:chat",
      requestId: reqIdRef.current,
      payload: { message: text },
    });
  }

  if (!account) return null;

  return (
    <>
      <Tippy content="AI Assistant" animation="shift-away" placement="left" delay={[200, 0]}>
        <button
          type="button"
          className="aiChatFab"
          onClick={() => setOpen(true)}
          aria-label="Open AI Assistant"
        >
          <MessageCircle size={20} />
        </button>
      </Tippy>

      {open && (
        <div
          className={`aiChatBackdrop ${exiting ? "aiChatBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="AI Assistant"
          onClick={(e) => e.target === e.currentTarget && closePanel()}
        >
          <div className={`aiChatPanel ${exiting ? "aiChatPanel--exiting" : ""}`}>
            <header className="aiChatHeader">
              <h2 className="aiChatTitle">AI Assistant</h2>
              <Tippy content="Close" animation="shift-away" placement="bottom" delay={[200, 0]}>
                <button
                  type="button"
                  className="aiChatClose"
                  onClick={closePanel}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </Tippy>
            </header>
            <p className="aiChatHint">Try: &quot;Show me employees with low rating&quot;, &quot;Drivers with most cash in hand&quot;, or ask for analysis.</p>
            <div className="aiChatList" ref={listRef}>
              {messages.length === 0 && (
                <div className="aiChatEmpty">Ask about employees (ratings, departments, salary) or drivers (cash in hand, balance, earnings, by period).</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`aiChatMessage aiChatMessage--${m.role} aiChatMessage--animate`}>
                  {m.role === "user" && <div className="aiChatBubble aiChatBubble--user">{m.text}</div>}
                  {m.role === "assistant" && (
                    <>
                      <div className="aiChatBubble aiChatBubble--assistant">
                        {m.error ? <span className="aiChatError">{m.error}</span> : m.reply}
                      </div>
                      {m.analysis && (
                        <div className="aiChatAnalysis">{m.analysis}</div>
                      )}
                      {Array.isArray(m.employees) && m.employees.length > 0 && (
                        <div className="aiChatTableWrap aiChatTableWrap--animate">
                          <table className="aiChatTable">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                {m.employees.some((e) => e.rating != null) && <th>Rating</th>}
                                {m.employees.some((e) => e.salary != null) && <th>Salary</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {m.employees.slice(0, 20).map((emp) => (
                                <tr key={emp._id}>
                                  <td>{emp.name}</td>
                                  <td>{emp.workEmail || emp.email}</td>
                                  <td>{emp.department}</td>
                                  {m.employees.some((e) => e.rating != null) && (
                                    <td>{emp.rating != null ? emp.rating : "—"}</td>
                                  )}
                                  {m.employees.some((e) => e.salary != null) && (
                                    <td>{emp.salary != null ? emp.salary : "—"}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {m.employees.length > 20 && (
                            <p className="aiChatTableMore">… and {m.employees.length - 20} more</p>
                          )}
                        </div>
                      )}
                      {Array.isArray(m.drivers) && m.drivers.length > 0 && (
                        <div className="aiChatTableWrap aiChatTableWrap--animate">
                          <table className="aiChatTable">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Cash in hand</th>
                                <th>Balance</th>
                                <th>Total earnings</th>
                                <th>Orders</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.drivers.slice(0, 20).map((d) => (
                                <tr key={d._id || d.id}>
                                  <td>{d.name || "—"}</td>
                                  <td>{d.phone || "—"}</td>
                                  <td>{typeof d.cashInHands === "number" ? d.cashInHands.toLocaleString() : "—"}</td>
                                  <td>{typeof d.balance === "number" ? d.balance.toLocaleString() : "—"}</td>
                                  <td>{typeof d.totalEarnings === "number" ? d.totalEarnings.toLocaleString() : "—"}</td>
                                  <td>{typeof d.totalOrders === "number" ? d.totalOrders : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {m.drivers.length > 20 && (
                            <p className="aiChatTableMore">… and {m.drivers.length - 20} more</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {loading && (
                <div className="aiChatMessage aiChatMessage--assistant aiChatMessage--animate">
                  <div className="aiChatBubble aiChatBubble--assistant aiChatLoading">Thinking…</div>
                </div>
              )}
            </div>
            <div className="aiChatInputWrap">
              <input
                type="text"
                className="aiChatInput"
                placeholder="Ask about employees or drivers…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                disabled={loading}
              />
              <Tippy content="Send" animation="shift-away" placement="top" delay={[200, 0]}>
                <button
                  type="button"
                  className="aiChatSend"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </Tippy>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
