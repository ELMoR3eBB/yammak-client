import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, Send, X } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import { getAssetUrl } from "../utils/publicUrl";
import "../styles/global-chat-panel.css";

const CLOSE_ANIMATION_MS = 220;
const DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION = "chat.global.locked.send";
const GROUP_WINDOW_MS = 60 * 1000;
const FALLBACK_AVATAR = getAssetUrl("assets/avatar-fallback.webp");

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const idStr = (value) => (value == null ? "" : String(value));

function formatMessageDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarUrl(url) {
  return url || FALLBACK_AVATAR;
}

export default function GlobalChatPanel({ account, open, onOpen, onClose }) {
  const [exiting, setExiting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [globalConversationId, setGlobalConversationId] = useState("");
  const [globalChatLock, setGlobalChatLock] = useState({
    locked: false,
    permission: DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION,
  });

  const listReqRef = useRef(null);
  const messagesReqRef = useRef(null);
  const sendReqRef = useRef(null);
  const viewportRef = useRef(null);

  const myUserId = idStr(account?.id || account?._id);

  const closePanel = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      onClose?.();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  const requestConversations = useCallback(() => {
    if (!window.api?.wsSend) return;
    listReqRef.current = rid();
    window.api.wsSend({ type: "chat:conversations:list", requestId: listReqRef.current });
  }, []);

  const requestMessages = useCallback((conversationId) => {
    if (!conversationId || !window.api?.wsSend) return;
    messagesReqRef.current = rid();
    setLoading(true);
    window.api.wsSend({
      type: "chat:messages:list",
      requestId: messagesReqRef.current,
      payload: { conversationId, limit: 120 },
    });
  }, []);

  const requestGlobalLockState = useCallback(() => {
    if (!window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:global-lock:get", requestId: rid() });
  }, []);

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsMessage || !api?.wsSend) return undefined;

    const unsub = api.onWsMessage((msg) => {
      if (!msg?.type) return;

      if (msg.type === "chat:conversations:list" && msg.requestId === listReqRef.current) {
        const list = Array.isArray(msg.conversations) ? msg.conversations : [];
        const globalConversation = list.find((conversation) => conversation?.kind === "global");
        const nextGlobalId = idStr(globalConversation?._id);
        setGlobalConversationId(nextGlobalId);
        if (open && nextGlobalId) requestMessages(nextGlobalId);
        return;
      }

      if (msg.type === "chat:messages:list" && msg.requestId === messagesReqRef.current) {
        setLoading(false);
        if (msg.ok === false) return;
        setMessages(Array.isArray(msg.messages) ? msg.messages : []);
        requestAnimationFrame(() => {
          const el = viewportRef.current;
          if (!el) return;
          el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        });
        return;
      }

      if (msg.type === "chat:global-lock:get:result" && msg.ok) {
        setGlobalChatLock({
          locked: msg.locked === true,
          permission: String(msg.permission || "").trim() || DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION,
        });
        return;
      }

      if (msg.type === "chat:global-lock:changed") {
        setGlobalChatLock({
          locked: msg.locked === true,
          permission: String(msg.permission || "").trim() || DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION,
        });
        return;
      }

      if (msg.type === "chat:message:new" && msg.message) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId !== globalConversationId) return;
        setMessages((prev) => {
          if (prev.some((m) => idStr(m._id) === idStr(msg.message._id))) return prev;
          return [...prev, msg.message];
        });
        requestAnimationFrame(() => {
          const el = viewportRef.current;
          if (!el) return;
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
        return;
      }

      if (msg.type === "chat:message:removed" && msg.message?._id) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId !== globalConversationId) return;
        setMessages((prev) =>
          prev.map((m) =>
            idStr(m._id) === idStr(msg.message._id)
              ? { ...m, removed: true, text: "Removed Message", removedAt: msg.message.removedAt || new Date().toISOString() }
              : m
          )
        );
        return;
      }

      if (msg.type === "chat:message:send:result" && msg.requestId === sendReqRef.current) {
        setSending(false);
      }
    });

    return () => unsub?.();
  }, [globalConversationId, open, requestMessages]);

  useEffect(() => {
    if (!open) return;
    requestConversations();
    requestGlobalLockState();
  }, [open, requestConversations, requestGlobalLockState]);

  const hasGlobalChatBypassPermission = useMemo(() => {
    const perms = account?.role?.permissions || [];
    return (
      perms.includes("*") ||
      perms.includes(globalChatLock.permission || DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION)
    );
  }, [account, globalChatLock.permission]);

  const isGlobalChatLockedForMe = globalChatLock.locked && !hasGlobalChatBypassPermission;

  const sendMessage = () => {
    if (!window.api?.wsSend || !globalConversationId || sending || isGlobalChatLockedForMe) return;
    const text = String(composer || "").trim();
    if (!text) return;
    sendReqRef.current = rid();
    setSending(true);
    window.api.wsSend({
      type: "chat:message:send",
      requestId: sendReqRef.current,
      payload: { conversationId: globalConversationId, text },
    });
    setComposer("");
  };

  const messagesWithGrouping = useMemo(() => {
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) return [];
    return list.map((msg, i) => {
      const prev = list[i - 1];
      const sameSender = prev && idStr(prev.sender?._id) === idStr(msg.sender?._id);
      const prevTime = prev?.createdAt ? new Date(prev.createdAt).getTime() : 0;
      const currTime = msg?.createdAt ? new Date(msg.createdAt).getTime() : 0;
      const withinWindow = currTime - prevTime <= GROUP_WINDOW_MS;
      const showMessageHeader = !sameSender || !withinWindow;
      return { ...msg, showMessageHeader };
    });
  }, [messages]);

  const handleAvatarError = useCallback((event) => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied === "1") return;
    img.dataset.fallbackApplied = "1";
    img.src = FALLBACK_AVATAR;
  }, []);

  if (!account) return null;

  return (
    <>
      <Tippy content="Global chat" animation="shift-away" placement="left" delay={[200, 0]}>
        <button type="button" className="globalChatFab" onClick={onOpen}>
          <Megaphone size={20} />
        </button>
      </Tippy>

      {open && (
        <div
          className={`globalChatBackdrop ${exiting ? "globalChatBackdrop--exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && closePanel()}
        >
          <div className={`globalChatPanel ${exiting ? "globalChatPanel--exiting" : ""}`}>
            <header className="globalChatHeader">
              <div className="globalChatHeaderLeft">
                <span className="globalChatHeaderIcon">
                  <Megaphone size={16} />
                </span>
                <div>
                  <h2 className="globalChatTitle">Global chat</h2>
                  <p className="globalChatSubTitle">Broadcast channel for all users</p>
                </div>
              </div>
              <Tippy content="Close" animation="shift-away" placement="bottom" delay={[200, 0]}>
                <button type="button" className="globalChatClose" onClick={closePanel}>
                  <X size={20} />
                </button>
              </Tippy>
            </header>
            <div className="globalChatList" ref={viewportRef}>
              {loading && <div className="globalChatEmpty">Loading messages...</div>}
              {!loading && messages.length === 0 && (
                <div className="globalChatEmpty">No messages yet.</div>
              )}
              {!loading &&
                messagesWithGrouping.map((message) => {
                  const mine = idStr(message.sender?._id) === myUserId;
                  const removed = !!message.removed;
                  const showHeader = message.showMessageHeader !== false;
                  return (
                    <article
                      key={idStr(message._id)}
                      className={`globalChatMessageRow ${mine ? "is-mine" : "is-other"} ${!showHeader ? "is-grouped" : ""}`}
                    >
                      <div className="globalChatAvatarWrap">
                        {showHeader ? (
                          <div className="globalChatAvatar">
                            <img
                              src={avatarUrl(message.sender?.photoUrl)}
                              alt={message.sender?.name || "Employee"}
                              onError={handleAvatarError}
                              draggable={false}
                            />
                          </div>
                        ) : (
                          <div className="globalChatAvatar globalChatAvatar--spacer" />
                        )}
                      </div>
                      <div className="globalChatMessageBody">
                        <div className={`globalChatBubble ${removed ? "is-removed" : ""} ${showHeader ? "has-tail" : ""}`}>
                          {showHeader && (
                            <div className="globalChatMeta">
                              <span className="globalChatSender">{mine ? "You" : (message.sender?.name || "Employee")}</span>
                            </div>
                          )}
                          <p className="globalChatText">
                            {removed ? "Removed message" : message.text}
                          </p>
                          <div className="globalChatBubbleMeta">
                            <time>{formatMessageDateTime(message.createdAt)}</time>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
            <footer className="globalChatComposerWrap">
              <div className="globalChatComposer">
                <textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder={isGlobalChatLockedForMe ? "Global chat is locked for your role" : "Write a message..."}
                  rows={1}
                  disabled={isGlobalChatLockedForMe}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  className="globalChatSend"
                  onClick={sendMessage}
                  disabled={isGlobalChatLockedForMe || sending || !String(composer || "").trim()}
                >
                  <Send size={15} />
                  <span>{sending ? "Sending..." : "Send"}</span>
                </button>
              </div>
              {isGlobalChatLockedForMe && (
                <div className="globalChatLockNotice">
                  Global chat is currently locked. Contact an admin if you need send access.
                </div>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
