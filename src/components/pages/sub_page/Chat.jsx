import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, LogOut, MessageCircle, Plus, Search, Send, Smile, Trash2, UserRound, Users, X } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import { getAssetUrl } from "../../../utils/publicUrl";
import ConfirmDeleteModal from "../../modals/ConfirmDeleteModal";
import "../../../styles/pages/chat/chat.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const FALLBACK_AVATAR = getAssetUrl("assets/avatar-fallback.webp");

const GROUP_WINDOW_MS = 60 * 1000; // 1 minute — same sender within this: hide avatar/details (Instagram-style)

// Discord-style: smileys, people, gestures, hearts, nature, food, activities, objects, symbols
const EMOJIS = [
  "\u{1F600}", "\u{1F601}", "\u{1F602}", "\u{1F603}", "\u{1F604}", "\u{1F605}", "\u{1F606}", "\u{1F607}",
  "\u{1F608}", "\u{1F609}", "\u{1F60A}", "\u{1F60B}", "\u{1F60C}", "\u{1F60D}", "\u{1F60E}", "\u{1F60F}",
  "\u{1F610}", "\u{1F611}", "\u{1F612}", "\u{1F613}", "\u{1F614}", "\u{1F615}", "\u{1F616}", "\u{1F617}",
  "\u{1F618}", "\u{1F619}", "\u{1F61A}", "\u{1F61B}", "\u{1F61C}", "\u{1F61D}", "\u{1F61E}", "\u{1F61F}",
  "\u{1F620}", "\u{1F621}", "\u{1F622}", "\u{1F623}", "\u{1F624}", "\u{1F625}", "\u{1F626}", "\u{1F627}",
  "\u{1F628}", "\u{1F629}", "\u{1F62A}", "\u{1F62B}", "\u{1F62C}", "\u{1F62D}", "\u{1F62E}", "\u{1F62F}",
  "\u{1F630}", "\u{1F631}", "\u{1F632}", "\u{1F633}", "\u{1F634}", "\u{1F635}", "\u{1F636}", "\u{1F637}",
  "\u{1F923}", "\u{1F924}", "\u{1F925}", "\u{1F92D}", "\u{1F92E}", "\u{1F92F}", "\u{1F970}", "\u{1F971}",
  "\u{1F973}", "\u{1F974}", "\u{1F975}", "\u{1F976}", "\u{1F978}", "\u{1F979}", "\u{1F97A}", "\u{1F64C}",
  "\u{1F44D}", "\u{1F44E}", "\u{1F44A}", "\u{1F44B}", "\u{1F44C}", "\u{1F44F}", "\u{1F450}", "\u{1F91D}",
  "\u{1F91E}", "\u{1F91F}", "\u{1F918}", "\u{1F919}", "\u{1F590}", "\u{270A}", "\u{270B}", "\u{270C}",
  "\u{2764}\u{FE0F}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F5A4}", "\u{1F90D}", "\u{1F90E}",
  "\u{1F4AF}", "\u{2728}", "\u{1F525}", "\u{1F4AB}", "\u{1F4A5}", "\u{1F4A4}", "\u{1F4A2}", "\u{1F4A3}",
  "\u{1F389}", "\u{1F38A}", "\u{1F38B}", "\u{26A1}", "\u{1F31F}", "\u{1F4AA}", "\u{1F9BE}", "\u{1F9BF}",
  "\u{1F436}", "\u{1F431}", "\u{1F42D}", "\u{1F430}", "\u{1F98A}", "\u{1F43B}", "\u{1F43C}", "\u{1F428}",
  "\u{1F42F}", "\u{1F981}", "\u{1F984}", "\u{1F993}", "\u{1F992}", "\u{1F414}", "\u{1F427}", "\u{1F426}",
  "\u{1F424}", "\u{1F423}", "\u{1F425}", "\u{1F986}", "\u{1F985}", "\u{1F419}", "\u{1F41B}", "\u{1F41C}",
  "\u{1F41D}", "\u{1F41E}", "\u{1F997}", "\u{1F577}", "\u{1F578}", "\u{1F982}", "\u{1F980}", "\u{1F99C}",
  "\u{1F4A7}", "\u{2600}\u{FE0F}", "\u{1F319}", "\u{1F31A}", "\u{1F31B}", "\u{2614}\u{FE0F}", "\u{2744}\u{FE0F}", "\u{26C4}\u{FE0F}",
  "\u{1F34E}", "\u{1F34F}", "\u{1F350}", "\u{1F351}", "\u{1F352}", "\u{1F353}", "\u{1F96D}", "\u{1F95D}",
  "\u{1F355}", "\u{1F354}", "\u{1F35F}", "\u{1F356}", "\u{1F357}", "\u{1F969}", "\u{1F96A}", "\u{1F37F}",
  "\u{1F377}", "\u{1F378}", "\u{1F379}", "\u{1F37A}", "\u{1F37B}", "\u{1F942}", "\u{1F943}", "\u{2615}\u{FE0F}",
  "\u{1F3C6}", "\u{1F3C0}", "\u{26BD}\u{FE0F}", "\u{1F3C8}", "\u{1F3BE}", "\u{1F3D0}", "\u{1F3C9}", "\u{1F3B1}",
  "\u{1F3B3}", "\u{1F9E9}", "\u{1F3AE}", "\u{1F3B2}", "\u{1F3B8}", "\u{1F3BA}", "\u{1F3BB}", "\u{1F4F1}",
  "\u{1F4F2}", "\u{1F4BB}", "\u{2328}\u{FE0F}", "\u{1F5A5}", "\u{1F5A8}", "\u{1F4FA}", "\u{1F4FB}", "\u{1F4FC}",
  "\u{2702}\u{FE0F}", "\u{1F4CF}", "\u{1F4D1}", "\u{1F4DA}", "\u{1F4CA}", "\u{1F4C8}", "\u{1F4C9}", "\u{2712}\u{FE0F}",
  "\u{270F}\u{FE0F}", "\u{1F4DD}", "\u{1F4D3}", "\u{1F4D2}", "\u{1F4D4}", "\u{1F4D5}", "\u{1F4D6}", "\u{1F4D7}",
  "\u{1F4D8}", "\u{1F4D9}", "\u{1F4DA}", "\u{1F517}", "\u{1F527}", "\u{1F528}", "\u{1F529}", "\u{1F6E0}",
  "\u{1F5E1}", "\u{2694}\u{FE0F}", "\u{1F4A3}", "\u{1F6AC}", "\u{26B0}\u{FE0F}", "\u{267B}\u{FE0F}", "\u{2695}\u{FE0F}", "\u{267E}\u{FE0F}",
];

function idStr(value) {
  return value == null ? "" : String(value);
}

function formatConversationTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
}

function formatMessageDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortConversations(a, b) {
  const ta = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
  const tb = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
  if (tb !== ta) return tb - ta;
  const ua = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const ub = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return ub - ua;
}

function upsertConversation(list, incoming) {
  if (!incoming?._id) return list;
  const idx = list.findIndex((x) => idStr(x._id) === idStr(incoming._id));
  if (idx === -1) return [...list, incoming].sort(sortConversations);
  const next = [...list];
  next[idx] = { ...next[idx], ...incoming };
  return next.sort(sortConversations);
}

function avatarUrl(url) {
  return url || FALLBACK_AVATAR;
}

export default function Chat({ account, navigationIntent, onConsumeIntent }) {
  const notify = useNotification();
  const myUserId = idStr(account?.id || account?._id);

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiExiting, setEmojiExiting] = useState(false);
  const [sending, setSending] = useState(false);
  const [removingMessageId, setRemovingMessageId] = useState(null);

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startMode, setStartMode] = useState("direct");
  const [memberQuery, setMemberQuery] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [leaveGroupModalOpen, setLeaveGroupModalOpen] = useState(false);

  const [animatedMessageIds, setAnimatedMessageIds] = useState(new Set());

  const listReqRef = useRef(null);
  const usersReqRef = useRef(null);
  const msgsReqRef = useRef(null);
  const sendReqRef = useRef(null);
  const removeReqRef = useRef(null);
  const directReqRef = useRef(null);
  const directIntentReqRef = useRef(null);
  const groupReqRef = useRef(null);
  const leaveReqRef = useRef(null);
  const viewportRef = useRef(null);
  const emojiPanelRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const animTimersRef = useRef(new Map());

  const requestConversations = useCallback(() => {
    if (!window.api?.wsSend) return;
    listReqRef.current = rid();
    window.api.wsSend({ type: "chat:conversations:list", requestId: listReqRef.current });
  }, []);

  const requestUsers = useCallback(() => {
    if (!window.api?.wsSend) return;
    usersReqRef.current = rid();
    window.api.wsSend({ type: "chat:users:list", requestId: usersReqRef.current });
  }, []);

  const requestMessages = useCallback((conversationId) => {
    if (!conversationId || !window.api?.wsSend) return;
    msgsReqRef.current = rid();
    setLoadingMessages(true);
    window.api.wsSend({ type: "chat:messages:list", requestId: msgsReqRef.current, payload: { conversationId, limit: 150 } });
  }, []);

  const markRead = useCallback((conversationId) => {
    if (!conversationId || !window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:mark-read", requestId: rid(), payload: { conversationId } });
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const animateMessage = useCallback((messageId) => {
    if (!messageId) return;
    setAnimatedMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });

    const prevTimer = animTimersRef.current.get(messageId);
    if (prevTimer) clearTimeout(prevTimer);

    const timer = setTimeout(() => {
      setAnimatedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      animTimersRef.current.delete(messageId);
    }, 420);

    animTimersRef.current.set(messageId, timer);
  }, []);

  const closeStartModal = useCallback(() => {
    setStartModalOpen(false);
  }, []);

  const openStartModal = useCallback((mode) => {
    setStartMode(mode === "group" ? "group" : "direct");
    setMemberQuery("");
    setGroupTitle("");
    setSelectedMemberIds([]);
    setStartModalOpen(true);
  }, []);

  const handleAvatarError = useCallback((event) => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied === "1") return;
    img.dataset.fallbackApplied = "1";
    img.src = FALLBACK_AVATAR;
  }, []);

  const ensureDirectConversation = useCallback(
    (targetUserId) => {
      const normalizedTarget = idStr(targetUserId);
      if (!normalizedTarget || normalizedTarget === myUserId || !window.api?.wsSend) return false;

      const existing = conversations.find(
        (c) => c.kind === "direct" && idStr(c.directPeer?._id) === normalizedTarget
      );

      if (existing?._id) {
        setActiveConversationId(idStr(existing._id));
        setEmojiOpen(false);
        return true;
      }

      directIntentReqRef.current = rid();
      window.api.wsSend({
        type: "chat:direct:ensure",
        requestId: directIntentReqRef.current,
        payload: { userId: normalizedTarget },
      });
      return true;
    },
    [conversations, myUserId]
  );

  useEffect(() => {
    const intentUserId = idStr(
      navigationIntent?.directUserId || navigationIntent?.userId || navigationIntent?._id
    );
    if (!intentUserId) return;
    const consumed = ensureDirectConversation(intentUserId);
    if (!consumed) return;
    onConsumeIntent?.();
  }, [ensureDirectConversation, navigationIntent, onConsumeIntent]);

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsMessage || !api?.wsSend) return undefined;

    const unsub = api.onWsMessage((msg) => {
      if (!msg?.type) return;

      if (msg.type === "chat:conversations:list" && msg.requestId === listReqRef.current) {
        const list = Array.isArray(msg.conversations) ? msg.conversations : [];
        setConversations(list.slice().sort(sortConversations));
        setLoadingConversations(false);
        return;
      }

      if (msg.type === "chat:users:list" && msg.requestId === usersReqRef.current) {
        setUsers(Array.isArray(msg.users) ? msg.users : []);
        return;
      }

      if (msg.type === "chat:messages:list" && msg.requestId === msgsReqRef.current) {
        if (msg.ok === false) {
          setLoadingMessages(false);
          notify?.error?.("Failed to load chat messages.", "Chat");
          return;
        }
        setActiveConversation(msg.conversation || null);
        setMessages(Array.isArray(msg.messages) ? msg.messages : []);
        setLoadingMessages(false);
        requestConversations();
        requestUsers();
        requestAnimationFrame(() => scrollToBottom(false));
        return;
      }

      if (msg.type === "chat:conversation:new" && msg.conversation) {
        setConversations((prev) => upsertConversation(prev, msg.conversation));
        return;
      }

      if (msg.type === "chat:conversation:updated" && msg.conversation) {
        setConversations((prev) => upsertConversation(prev, msg.conversation));
        if (idStr(msg.conversation._id) === idStr(activeConversationId)) {
          setActiveConversation((prev) => ({ ...(prev || {}), ...msg.conversation }));
        }
        return;
      }

      if (msg.type === "chat:conversation:left" && msg.conversationId) {
        const gone = idStr(msg.conversationId);
        setConversations((prev) => prev.filter((x) => idStr(x._id) !== gone));
        if (idStr(activeConversationId) === gone) {
          setActiveConversationId(null);
          setActiveConversation(null);
          setMessages([]);
        }
        return;
      }

      if (msg.type === "chat:message:new" && msg.message) {
        if (msg.conversation) setConversations((prev) => upsertConversation(prev, msg.conversation));
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) => {
            if (prev.some((m) => idStr(m._id) === idStr(msg.message._id))) return prev;
            return [...prev, msg.message];
          });
          animateMessage(idStr(msg.message._id));
          if (idStr(msg.message?.sender?._id) !== myUserId) markRead(convId);
          requestAnimationFrame(() => scrollToBottom(true));
        }
        return;
      }

      if (msg.type === "chat:message:removed" && msg.message?._id) {
        if (msg.conversation) setConversations((prev) => upsertConversation(prev, msg.conversation));
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) =>
            prev.map((m) =>
              idStr(m._id) === idStr(msg.message._id)
                ? { ...m, removed: true, text: "Removed Message", removedAt: msg.message.removedAt || new Date().toISOString() }
                : m
            )
          );
        }
        return;
      }

      if (msg.type === "chat:message:send:result" && msg.requestId === sendReqRef.current) {
        setSending(false);
        if (!msg.ok) notify?.error?.("Message failed to send.", "Chat");
        return;
      }

      if (msg.type === "chat:message:remove:result" && msg.requestId === removeReqRef.current) {
        setRemovingMessageId(null);
        if (!msg.ok) notify?.error?.("Message could not be removed.", "Chat");
        return;
      }

      if (
        msg.type === "chat:direct:ensure:result" &&
        (msg.requestId === directReqRef.current || msg.requestId === directIntentReqRef.current)
      ) {
        const isModalRequest = msg.requestId === directReqRef.current;
        if (isModalRequest) setCreatingConversation(false);
        if (!msg.ok || !msg.conversationId) {
          if (isModalRequest) notify?.error?.("Could not start direct chat.", "Chat");
          directIntentReqRef.current = null;
          return;
        }
        if (isModalRequest) setStartModalOpen(false);
        setActiveConversationId(msg.conversationId);
        directIntentReqRef.current = null;
        requestConversations();
        return;
      }

      if (msg.type === "chat:group:create:result" && msg.requestId === groupReqRef.current) {
        setCreatingConversation(false);
        if (!msg.ok || !msg.conversationId) {
          const errMsg =
            msg.error === "at_least_one_member_required"
              ? "Select at least one member for the group."
              : msg.error === "at_least_two_members_required"
                ? "Select at least one other member (group needs you plus one more)."
                : msg.error === "invalid_title"
                  ? "Group title must be 2–80 characters."
                  : msg.error === "unauthorized"
                    ? "You must be logged in to create a group."
                    : msg.error
                      ? String(msg.error).replace(/_/g, " ")
                      : "Could not create group.";
          return notify?.error?.(errMsg, "Chat");
        }
        setStartModalOpen(false);
        setActiveConversationId(msg.conversationId);
        requestConversations();
        return;
      }

      if (msg.type === "chat:group:leave:result" && msg.requestId === leaveReqRef.current) {
        setLeavingGroup(false);
        if (!msg.ok) return notify?.error?.("Could not leave this group.", "Chat");
        setActiveConversationId(null);
        setActiveConversation(null);
        setMessages([]);
        requestConversations();
      }
    });

    (async () => {
      try {
        await api.wsConnect();
        requestConversations();
        requestUsers();
      } catch {
        setLoadingConversations(false);
      }
    })();

    return () => unsub?.();
  }, [
    activeConversationId,
    animateMessage,
    markRead,
    myUserId,
    notify,
    requestConversations,
    requestUsers,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!conversations.length) {
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    if (!conversations.some((x) => idStr(x._id) === idStr(activeConversationId))) {
      setActiveConversationId(idStr(conversations[0]._id));
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    requestMessages(activeConversationId);
    markRead(activeConversationId);
  }, [activeConversationId, markRead, requestMessages]);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    const close = (event) => {
      const target = event.target;
      if (emojiPanelRef.current?.contains(target)) return;
      if (emojiBtnRef.current?.contains(target)) return;
      setEmojiExiting(true);
      setTimeout(() => {
        setEmojiOpen(false);
        setEmojiExiting(false);
      }, 180);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [emojiOpen]);

  useEffect(() => () => {
    for (const timer of animTimersRef.current.values()) clearTimeout(timer);
  }, []);

  const filteredConversations = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      `${c.title || ""} ${c.directPeer?.name || ""} ${c.directPeer?.workEmail || ""} ${c.lastMessagePreview || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, searchQuery]);

  const filteredUsers = useMemo(() => {
    const q = String(memberQuery || "").trim().toLowerCase();
    const base = users.filter((u) => idStr(u._id) !== myUserId);
    if (!q) return base;
    return base.filter((u) => `${u.name || ""} ${u.workEmail || ""}`.toLowerCase().includes(q));
  }, [memberQuery, myUserId, users]);

  const activeConversationSummary = useMemo(
    () => conversations.find((x) => idStr(x._id) === idStr(activeConversationId)) || null,
    [conversations, activeConversationId]
  );

  const conversationMembersById = useMemo(() => {
    const map = new Map();
    const members = Array.isArray(activeConversation?.members) ? activeConversation.members : [];
    for (const member of members) {
      map.set(idStr(member._id), member);
    }
    return map;
  }, [activeConversation]);

  const activeTitle = activeConversation?.title || activeConversationSummary?.title || "Conversation";

  const messagesWithGrouping = useMemo(() => {
    const list = messages;
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

  const activeSubtitle = useMemo(() => {
    if (activeConversation?.kind === "group" || activeConversationSummary?.kind === "group") {
      const count = activeConversation?.memberCount ?? activeConversationSummary?.memberCount ?? 0;
      return `${count} member${count === 1 ? "" : "s"}`;
    }
    const peer = activeConversationSummary?.directPeer;
    return peer ? (peer.online ? "Online" : "Offline") : "Direct conversation";
  }, [activeConversation, activeConversationSummary]);

  const canLeaveActiveGroup = Boolean(activeConversation?.canLeave || activeConversationSummary?.canLeave);

  const toggleMember = (userId) => {
    if (startMode === "direct") {
      setSelectedMemberIds([userId]);
      return;
    }
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]
    );
  };

  const createConversation = () => {
    if (creatingConversation || !window.api?.wsSend) return;

    if (startMode === "direct") {
      const userId = selectedMemberIds[0];
      if (!userId) {
        notify?.warning?.("Select one employee to start a direct chat.", "Chat");
        return;
      }
      setCreatingConversation(true);
      directReqRef.current = rid();
      window.api.wsSend({ type: "chat:direct:ensure", requestId: directReqRef.current, payload: { userId } });
      return;
    }

    const title = String(groupTitle || "").trim();
    if (title.length < 2) {
      notify?.warning?.("Group title should be at least 2 characters.", "Chat");
      return;
    }

    if (selectedMemberIds.length < 1) {
      notify?.warning?.("Select at least one employee for the group.", "Chat");
      return;
    }

    setCreatingConversation(true);
    groupReqRef.current = rid();
    window.api.wsSend({
      type: "chat:group:create",
      requestId: groupReqRef.current,
      payload: { title, memberIds: selectedMemberIds },
    });
  };

  const sendMessage = () => {
    if (sending || !window.api?.wsSend || !activeConversationId) return;
    const text = String(composer || "").trim();
    if (!text) return;

    setSending(true);
    sendReqRef.current = rid();
    window.api.wsSend({
      type: "chat:message:send",
      requestId: sendReqRef.current,
      payload: { conversationId: activeConversationId, text },
    });
    setComposer("");
    setEmojiOpen(false);
  };

  const removeMessage = (messageId) => {
    if (removingMessageId || !window.api?.wsSend) return;
    setRemovingMessageId(messageId);
    removeReqRef.current = rid();
    window.api.wsSend({ type: "chat:message:remove", requestId: removeReqRef.current, payload: { messageId } });
  };

  const openLeaveGroupModal = () => {
    if (!activeConversationId || leavingGroup) return;
    setLeaveGroupModalOpen(true);
  };

  const confirmLeaveGroup = useCallback(() => {
    if (!window.api?.wsSend || !activeConversationId || leavingGroup) return;
    setLeaveGroupModalOpen(false);
    setLeavingGroup(true);
    leaveReqRef.current = rid();
    window.api.wsSend({ type: "chat:group:leave", requestId: leaveReqRef.current, payload: { conversationId: activeConversationId } });
  }, [activeConversationId, leavingGroup]);

  return (
    <div className="chatPage chatPage--enter">
      <aside className="chatSidebar">
        <header className="chatSidebarHeader">
          <div className="chatSidebarTitleWrap">
            <MessageCircle size={18} />
            <div>
              <h1 className="chatSidebarTitle">Team Chat</h1>
              <p className="chatSidebarSubtitle">Realtime employee messaging</p>
            </div>
          </div>

          <div className="chatSidebarHeaderActions">
            <button
              type="button"
              className="chatActionBtn"
              onClick={() => openStartModal("direct")}
            >
              <UserRound size={16} />
              <span>Direct</span>
            </button>
            <button
              type="button"
              className="chatActionBtn chatActionBtn--accent"
              onClick={() => openStartModal("group")}
            >
              <Plus size={16} />
              <span>Group</span>
            </button>
          </div>
        </header>

        <div className="chatSidebarSearch">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversation"
          />
        </div>

        <div className="chatConversationList">
          {loadingConversations && <div className="chatEmptyState">Loading conversations...</div>}
          {!loadingConversations && !filteredConversations.length && (
            <div className="chatEmptyState">
              <p>No conversations yet.</p>
            </div>
          )}

          {!loadingConversations && filteredConversations.map((conversation) => {
            const isDirect = conversation.kind === "direct";
            const title = conversation.title || "Conversation";
            const preview = conversation.lastMessagePreview || "Start the conversation";
            const isActive = idStr(conversation._id) === idStr(activeConversationId);
            const unread = Number(conversation.unreadCount || 0);

            return (
              <button
                type="button"
                key={conversation._id}
                className={`chatConversationItem ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  setEmojiOpen(false);
                  setActiveConversationId(idStr(conversation._id));
                }}
              >
                <div className="chatConversationAvatar">
                  <img
                    src={avatarUrl(conversation.directPeer?.photoUrl)}
                    alt={title}
                    onError={handleAvatarError}
                  />
                  {isDirect && conversation.directPeer?.online && <i className="chatPresenceDot" aria-hidden />}
                </div>

                <div className="chatConversationBody">
                  <div className="chatConversationTop">
                    <span className="chatConversationName">
                      {isDirect ? <UserRound size={13} /> : <Hash size={13} />}
                      {title}
                    </span>
                    <span className="chatConversationTime">
                      {formatConversationTime(conversation.lastMessageAt || conversation.updatedAt)}
                    </span>
                  </div>

                  <div className="chatConversationBottom">
                    <span className={`chatConversationPreview ${preview === "Removed Message" ? "is-removed" : ""}`}>
                      {preview}
                    </span>
                    {unread > 0 && <span className="chatUnreadBadge">{unread > 99 ? "99+" : unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="chatMain">
        {!activeConversationId && (
          <div className="chatMainEmpty">
            <MessageCircle size={34} />
            <h2>Select a conversation</h2>
            <p>Pick a chat from the left or create a new one.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeConversationId && (
            <motion.div
              key={activeConversationId}
              className="chatMainConversation"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
            <header className="chatMainHeader">
              <div className="chatMainHeaderLeft">
                {activeConversationSummary?.kind === "group" ? <Hash size={16} /> : <UserRound size={16} />}
                <div>
                  <h2 className="chatMainTitle">{activeTitle}</h2>
                  <p className="chatMainSub">{activeSubtitle}</p>
                </div>
              </div>
              <div className="chatMainHeaderRight">
                {canLeaveActiveGroup && (
                  <button type="button" className="chatDangerBtn" onClick={openLeaveGroupModal} disabled={leavingGroup}>
                    <LogOut size={14} />
                    <span>{leavingGroup ? "Leaving..." : "Leave group"}</span>
                  </button>
                )}
              </div>
            </header>

            <div className="chatMessagesViewport" ref={viewportRef}>
              {loadingMessages && <div className="chatEmptyState">Loading messages...</div>}
              {!loadingMessages && !messages.length && (
                <div className="chatEmptyState chatEmptyState--noMessages">
                  <img src={getAssetUrl("assets/undraw/no_messages.png")} alt="" className="chatEmptyStateIllustration" />
                  <p>No messages yet.</p>
                  <span>Say hello to start the conversation.</span>
                </div>
              )}

              {!loadingMessages && messagesWithGrouping.map((message) => {
                const mine = idStr(message.sender?._id) === myUserId;
                const removed = !!message.removed;
                const animated = animatedMessageIds.has(idStr(message._id));
                const showHeader = message.showMessageHeader !== false;
                const member = conversationMembersById.get(idStr(message.sender?._id));
                const senderRole = message.sender?.jobTitle || member?.jobTitle || "Employee";

                return (
                  <article
                    key={message._id}
                    className={`chatMessageRow ${mine ? "is-mine" : "is-other"} ${animated ? "is-new" : ""} ${!showHeader ? "is-grouped" : ""}`}
                  >
                    <div className="chatMessageAvatarWrap">
                      {showHeader ? (
                        <div className="chatMessageAvatar" aria-hidden>
                          <img
                            src={avatarUrl(message.sender?.photoUrl)}
                            alt={message.sender?.name || "Employee"}
                            onError={handleAvatarError}
                          />
                        </div>
                      ) : (
                        <div className="chatMessageAvatar chatMessageAvatar--spacer" aria-hidden />
                      )}
                    </div>

                    <div className="chatMessageBody">
                      {showHeader && (
                        <>
                          <div className="chatMessageMetaTop">
                            <span className="chatMessageSender">{message.sender?.name || "Employee"}</span>
                          </div>
                          <div className="chatMessageMetaSub">
                            <span className="chatMessageRole">{senderRole}</span>
                            <time className="chatMessageTime">{formatMessageDateTime(message.createdAt)}</time>
                          </div>
                        </>
                      )}

                      <div className={`chatMessageBubble ${removed ? "is-removed" : ""}`}>
                        {mine && !removed && (
                          <button
                            type="button"
                            className="chatMessageRemoveBtn"
                            onClick={() => removeMessage(idStr(message._id))}
                            disabled={removingMessageId === idStr(message._id)}
                            title="Remove message"
                            aria-label="Remove message"
                          >
                            {removingMessageId === idStr(message._id) ? (
                              <span className="chatMessageRemoveBtnLabel">Removing...</span>
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}

                        {removed ? (
                          <span className="chatMessageRemovedLabel">Removed message</span>
                        ) : (
                          <p className="chatMessageText">{message.text}</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="chatComposerWrap">
              <div className="chatComposer">
                <button
                  ref={emojiBtnRef}
                  type="button"
                  className={`chatIconBtn ${emojiOpen ? "is-active" : ""}`}
                  onClick={() => {
                    if (emojiOpen) {
                      setEmojiExiting(true);
                      setTimeout(() => {
                        setEmojiOpen(false);
                        setEmojiExiting(false);
                      }, 180);
                    } else {
                      setEmojiOpen(true);
                    }
                  }}
                  aria-label="Toggle emoji picker"
                >
                  <Smile size={18} />
                </button>

                <textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Write a message..."
                  rows={1}
                />

                <button
                  type="button"
                  className="chatSendBtn"
                  onClick={sendMessage}
                  disabled={sending || !String(composer || "").trim()}
                >
                  <Send size={15} />
                  <span>{sending ? "Sending..." : "Send"}</span>
                </button>
              </div>

              <AnimatePresence>
                {emojiOpen && !emojiExiting && (
                  <motion.div
                    ref={emojiPanelRef}
                    className="chatEmojiPanel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <div className="chatEmojiGridWrap">
                      <div className="chatEmojiGrid">
                        {EMOJIS.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            className="chatEmojiBtn"
                            onClick={() => setComposer((prev) => `${prev || ""}${emoji}`)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {startModalOpen && (
          <motion.div
            key="chat-start-modal"
            className="chatStartModalBackdrop"
            role="dialog"
            aria-modal="true"
            onClick={closeStartModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.div
              className="chatStartModal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
                <header className="chatStartModalHeader">
                  <div className="chatStartModalHeading">
                    <h3>{startMode === "group" ? "Create group chat" : "Start direct chat"}</h3>
                    <p>
                      {startMode === "group"
                        ? "Select team members and give the group a clear name."
                        : "Choose one employee to start a direct conversation."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="chatStartModalCloseBtn"
                    onClick={closeStartModal}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </header>

                <div className="chatStartModeTabs" role="tablist" aria-label="Chat type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={startMode === "direct"}
                    className={`chatStartTab ${startMode === "direct" ? "chatStartTab--active" : ""}`}
                    onClick={() => {
                      setStartMode("direct");
                      setSelectedMemberIds((prev) => (prev.length ? [prev[0]] : []));
                    }}
                  >
                    Direct
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={startMode === "group"}
                    className={`chatStartTab ${startMode === "group" ? "chatStartTab--active" : ""}`}
                    onClick={() => setStartMode("group")}
                  >
                    Group
                  </button>
                </div>

                <div className="chatStartModalBody">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={startMode}
                      className="chatStartModalBodyInner"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    >
                      {startMode === "group" && (
                        <label className="chatStartField chatStartFieldGroupTitle">
                          <span>Group title</span>
                          <input
                            type="text"
                            className="chatStartGroupTitleInput"
                            value={groupTitle}
                            onChange={(e) => setGroupTitle(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Ops Team, Marketing"
                            autoComplete="off"
                          />
                        </label>
                      )}

                      <label className="chatStartField">
                        <span>{startMode === "group" ? "Group members" : "Employee"}</span>
                        <div className="chatStartSearch">
                          <Search size={14} />
                          <input
                            className="chatStartSearchInput"
                            value={memberQuery}
                            onChange={(e) => setMemberQuery(e.target.value)}
                            placeholder="Search by name or email"
                          />
                        </div>
                      </label>

                      <div className="chatStartUsersList">
                        {!filteredUsers.length && <div className="chatEmptyState">No employees found.</div>}

                        {filteredUsers.map((user) => {
                          const uid = idStr(user._id);
                          const selected = selectedMemberIds.includes(uid);

                          return (
                            <motion.button
                              key={user._id}
                              type="button"
                              className={`chatStartUserRow ${selected ? "is-selected" : ""}`}
                              onClick={() => toggleMember(uid)}
                              whileTap={{ scale: 0.98 }}
                              transition={{ duration: 0.12 }}
                            >
                              <div className="chatStartUserIdentity">
                                <div className="chatConversationAvatar chatStartUserAvatar">
                                  <img
                                    src={avatarUrl(user.photoUrl)}
                                    alt={user.name || "Employee"}
                                    onError={handleAvatarError}
                                  />
                                  {user.online && <i className="chatPresenceDot" aria-hidden />}
                                </div>

                                <div className="chatStartUserText">
                                  <span className="chatStartUserName">{user.name || "Employee"}</span>
                                  <small className="chatStartUserMeta">{user.jobTitle || user.workEmail || "-"}</small>
                                </div>
                              </div>

                              <span className={`chatStartUserStatus ${selected ? "is-selected" : ""}`}>
                                {selected ? "Selected" : "Select"}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <footer className="chatStartModalFooter">
                  <div className="chatStartSelectionMeta">
                    <Users size={14} />
                    <span>{selectedMemberIds.length} selected</span>
                  </div>

                  <button
                    type="button"
                    className="chatActionBtn chatActionBtn--accent"
                    onClick={createConversation}
                    disabled={creatingConversation}
                  >
                    <Plus size={15} />
                    <span>{creatingConversation ? "Please wait..." : startMode === "group" ? "Create Group" : "Start Chat"}</span>
                  </button>
                </footer>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        open={leaveGroupModalOpen}
        title="Leave group"
        message="Leave this group? You will no longer receive messages from it."
        confirmText="Leave"
        cancelText="Cancel"
        danger
        loading={leavingGroup}
        onClose={() => setLeaveGroupModalOpen(false)}
        onConfirm={confirmLeaveGroup}
      />
    </div>
  );
}
