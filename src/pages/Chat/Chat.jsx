import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, ArchiveRestore, BarChart3, Check, ChevronLeft, ChevronRight, Copy, Download, Hash, ListFilter, LogOut, Megaphone, MessageCircle, Paperclip, Pencil, Pin, PinOff, Plus, Reply, Search, Send, Smile, Trash2, UserMinus, UserPlus, Users, UserRound, X } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";
import EmojiPicker from "emoji-picker-react";
import { useNotification } from "../../components/NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAssetUrl } from "../../utils/publicUrl";
import { hasPermission } from "../../helpers/permissions";
import ConfirmDeleteModal from "../../components/modals/ConfirmDeleteModal";
import StartChatModal from "./Modals/StartChatModal";
import "../../styles/pages/chat/chat.css";

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const FALLBACK_AVATAR = getAssetUrl("assets/avatar-fallback.webp");
const MIN_LOADING_VISIBLE_MS = 380;
const DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION = "chat.global.locked.send";
const GLOBAL_CHAT_POLL_CREATE_PERMISSION = "chat.global.poll.create";
const DEPARTMENT_MEMBERS_MANAGE_PERMISSION = "chat.department.members.manage";

const GROUP_WINDOW_MS = 60 * 1000; // 1 minute — same sender within this: hide avatar/details (Instagram-style)

function idStr(value) {
  return value == null ? "" : String(value);
}

function dataUrlToArrayBuffer(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const MENTION_RENDER_RE = /<@([udr]):([^|>]+)\|([^>]+)>/g;
const MENTION_CHAR_START = 0xe000;
const MENTION_CHAR_END = 0xf8ff;
const MENTION_CHAR_RE = /[\uE000-\uF8FF]/g;

function normalizeDraftMentions(sourceText, draftMentions = null) {
  const source = String(sourceText || "");
  if (!source || !draftMentions || Object.keys(draftMentions).length === 0) return source;
  let out = "";
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const meta = draftMentions[ch];
    if (!meta) {
      out += ch;
      continue;
    }
    const kindCode = meta.kind === "user" ? "u" : meta.kind === "department" ? "d" : "r";
    out += `<@${kindCode}:${meta.value}|${meta.label}>`;
    const pad = Math.max(0, Number(meta.pad || 0));
    let consumed = 0;
    while (consumed < pad && source[i + 1] === " ") {
      i += 1;
      consumed += 1;
    }
  }
  return out;
}

function getMentionRanges(sourceText, draftMentions = null) {
  const source = String(sourceText || "");
  const ranges = [];
  if (!source || !draftMentions || Object.keys(draftMentions).length === 0) return ranges;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const meta = draftMentions[ch];
    if (meta) {
      const pad = Math.max(0, Number(meta.pad || 0));
      const start = i;
      let end = i + 1;
      let consumed = 0;
      while (consumed < pad && source[end] === " ") {
        end += 1;
        consumed += 1;
      }
      ranges.push({ start, end, ch });
      i = end - 1;
    }
  }
  return ranges;
}

function renderTextWithMentions(rawText, fallbackText = "", draftMentions = null) {
  const sourceRaw = String(rawText || "");
  const source = normalizeDraftMentions(sourceRaw, draftMentions);
  if (!source.includes("<@")) return String(fallbackText || source || "");
  const out = [];
  let last = 0;
  let m = null;
  while ((m = MENTION_RENDER_RE.exec(source)) !== null) {
    if (m.index > last) out.push({ type: "text", value: source.slice(last, m.index) });
    const kind = m[1] === "u" ? "user" : m[1] === "d" ? "department" : "role";
    out.push({ type: "mention", kind, value: `@${String(m[3] || "").trim()}` });
    last = m.index + m[0].length;
  }
  if (last < source.length) out.push({ type: "text", value: source.slice(last) });
  return out;
}

function formatConversationTime(value, nowMs = Date.now()) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date(nowMs);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return d.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMessageDateTime(value, nowMs = Date.now()) {
  return formatConversationTime(value, nowMs);
}

function formatTimeOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDayLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPollRemaining(closesAt, nowMs = Date.now(), closedLabel = "Closed") {
  if (!closesAt) return "";
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return "";
  const diff = Math.max(0, end - nowMs);
  if (diff <= 0) return closedLabel;
  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

function sortConversations(a, b) {
  const rank = (kind) => {
    if (kind === "global") return 2;
    if (kind === "department") return 1;
    return 0;
  };
  const aRank = rank(a?.kind);
  const bRank = rank(b?.kind);
  if (aRank !== bRank) return bRank - aRank;

  const ta = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
  const tb = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
  if (tb !== ta) return tb - ta;
  const ca = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const cb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (cb !== ca) return cb - ca;
  const idA = String(a?._id || "");
  const idB = String(b?._id || "");
  if (idA < idB) return 1;
  if (idA > idB) return -1;
  return 0;
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

function isEmptyDirectConversation(conversation) {
  if (!conversation || conversation.kind !== "direct") return false;
  const hasLastMessageAt = Boolean(conversation.lastMessageAt);
  const hasPreview = Boolean(String(conversation.lastMessagePreview || "").trim());
  return !hasLastMessageAt && !hasPreview;
}

function collectEmptyDirectConversationIds(list) {
  return (Array.isArray(list) ? list : [])
    .filter(isEmptyDirectConversation)
    .map((conversation) => idStr(conversation._id))
    .filter(Boolean);
}

function findGlobalConversationId(list) {
  const match = (Array.isArray(list) ? list : []).find((conversation) => conversation?.kind === "global");
  return idStr(match?._id);
}

function useMinVisibleLoading(active, minMs = MIN_LOADING_VISIBLE_MS) {
  const [visible, setVisible] = useState(active);
  const startedAtRef = useRef(active ? Date.now() : 0);

  useEffect(() => {
    if (active) {
      startedAtRef.current = Date.now();
      setVisible(true);
      return undefined;
    }
    const elapsed = Date.now() - (startedAtRef.current || 0);
    const waitMs = Math.max(0, minMs - elapsed);
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const timer = setTimeout(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setVisible(false);
        });
      });
    }, waitMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [active, minMs]);

  return visible;
}

export default function Chat({ account, navigationIntent, onConsumeIntent, onNavigate }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const isLightTheme = typeof document !== "undefined" && document.documentElement?.dataset?.theme === "light";
  const tr = useCallback((key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);
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
  const [composerMentionDrafts, setComposerMentionDrafts] = useState({});
  const mentionCharSeqRef = useRef(0);
  const [composerImages, setComposerImages] = useState([]); // [{ id, dataUrl, filePath?, fileName? }]
  const [imageViewer, setImageViewer] = useState(null); // { url, urls, index, name, authorName, authorPhoto, createdAt }
  const [imageViewerContextMenu, setImageViewerContextMenu] = useState(null); // { x, y }

  const typingTimersRef = useRef(new Map()); // `${convId}:${userId}` -> timeout
  const [typingByConversation, setTypingByConversation] = useState({}); // convId -> { userId: atMs }
  const composerTypingRef = useRef({ lastSentAt: 0, isTyping: false, stopTimer: null });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [removingMessageId, setRemovingMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [pendingRemoveByMessageId, setPendingRemoveByMessageId] = useState({});
  const [timeTick, setTimeTick] = useState(Date.now());
  const [mentionMenu, setMentionMenu] = useState({ open: false, items: [], selected: 0, start: -1, end: -1, query: "" });
  const [messageContextMenu, setMessageContextMenu] = useState(null);
  const [conversationContextMenu, setConversationContextMenu] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [reactionEmojiTarget, setReactionEmojiTarget] = useState(null);
  const [animatedReactionKeys, setAnimatedReactionKeys] = useState(new Set());
  const [reactionExitMessageIds, setReactionExitMessageIds] = useState(new Set());
  const [pinnedPopoverOpen, setPinnedPopoverOpen] = useState(false);

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startMode, setStartMode] = useState("direct");
  const [memberQuery, setMemberQuery] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [leaveGroupModalOpen, setLeaveGroupModalOpen] = useState(false);
  const [hidingConversation, setHidingConversation] = useState(false);
  const [archivingConversation, setArchivingConversation] = useState(false);
  const [hideConversationModalOpen, setHideConversationModalOpen] = useState(false);
  const [hideTargetConversationId, setHideTargetConversationId] = useState(null);
  const [archiveView, setArchiveView] = useState(false);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollAnswers, setPollAnswers] = useState(["", ""]);
  const [pollDurationPreset, setPollDurationPreset] = useState("1h");
  const [pollCustomMinutes, setPollCustomMinutes] = useState("");
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [votingPollMessageId, setVotingPollMessageId] = useState(null);
  const [preferredConversationId, setPreferredConversationId] = useState(null);
  const [departmentMembersOpen, setDepartmentMembersOpen] = useState(false);
  const [departmentMemberQuery, setDepartmentMemberQuery] = useState("");
  const [addingDepartmentMemberId, setAddingDepartmentMemberId] = useState(null);
  const [removingDepartmentMemberId, setRemovingDepartmentMemberId] = useState(null);
  const [globalChatLock, setGlobalChatLock] = useState({
    locked: false,
    permission: DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION,
  });

  const [animatedMessageIds, setAnimatedMessageIds] = useState(new Set());
  const loadingConversationsUi = useMinVisibleLoading(loadingConversations);
  const loadingMessagesUi = useMinVisibleLoading(loadingMessages);

  const conversationsRef = useRef(conversations);
  const listReqRef = useRef(null);
  const usersReqRef = useRef(null);
  const msgsReqRef = useRef(null);
  const sendReqRef = useRef(null);
  const removeReqRef = useRef(null);
  const directReqRef = useRef(null);
  const directIntentReqRef = useRef(null);
  const groupReqRef = useRef(null);
  const leaveReqRef = useRef(null);
  const hideReqRef = useRef(null);
  const archiveReqRef = useRef(null);
  const pollCreateReqRef = useRef(null);
  const pollCreateTimeoutRef = useRef(null);
  const pollVoteReqRef = useRef(null);
  const deptMemberAddReqRef = useRef(null);
  const deptMemberRemoveReqRef = useRef(null);
  const viewportRef = useRef(null);
  const composerInputRef = useRef(null);
  const mentionMenuRef = useRef(null);
  const emojiPanelRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const animTimersRef = useRef(new Map());
  const ringtoneRef = useRef(null);
  const messageRefs = useRef(new Map());
  const replyJumpTimerRef = useRef(null);
  const reactionEmojiPanelRef = useRef(null);
  const reactionEmojiBtnRefs = useRef(new Map());
  const reactionAnimTimersRef = useRef(new Map());
  const reactionExitTimersRef = useRef(new Map());
  const pinnedBtnRef = useRef(null);
  const pinnedPopoverRef = useRef(null);
  const departmentMembersPopoverRef = useRef(null);
  const pendingRestoreConversationIdRef = useRef(null);

  const SCROLL_POSITIONS_KEY = "chat_scroll_positions";

  const saveScrollPosition = useCallback((conversationId, top, isAtBottom, visibleMessageId = null, visibleOffset = 0) => {
    try {
      const data = JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) || "{}");
      data[conversationId] = { top, isAtBottom, visibleMessageId, visibleOffset };
      localStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(data));
    } catch (e) {}
  }, []);

  const getScrollPosition = useCallback((conversationId) => {
    try {
      const data = JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) || "{}");
      return data[conversationId] || null;
    } catch (e) {}
    return null;
  }, []);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const pruneEmptyDirectConversations = useCallback((list) => {
    if (!window.api?.wsSend) return;
    const emptyIds = collectEmptyDirectConversationIds(list);
    for (const conversationId of emptyIds) {
      window.api.wsSend({
        type: "chat:conversation:prune-empty",
        requestId: rid(),
        payload: { conversationId },
      });
    }
  }, []);

  const requestConversations = useCallback(() => {
    if (!window.api?.wsSend) return;
    listReqRef.current = rid();
    window.api.wsSend({
      type: "chat:conversations:list",
      requestId: listReqRef.current,
      payload: { includeArchived: true },
    });
  }, []);

  const requestUsers = useCallback(() => {
    if (!window.api?.wsSend) return;
    usersReqRef.current = rid();
    window.api.wsSend({ type: "chat:users:list", requestId: usersReqRef.current });
  }, []);

  const requestGlobalLockState = useCallback(() => {
    if (!window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:global-lock:get", requestId: rid() });
  }, []);

  useEffect(() => {
    setConversations([]);
    setUsers([]);
    setActiveConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setLoadingConversations(true);
    setLoadingMessages(false);
    setPreferredConversationId(null);
    if (window.api?.wsConnect) {
      window.api.wsConnect().then(() => {
        requestConversations();
        requestUsers();
        requestGlobalLockState();
      }).catch(() => {
        setLoadingConversations(false);
      });
    }
  }, [myUserId, requestConversations, requestUsers, requestGlobalLockState]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (!replyingTo && !editingMessageId) return;
    requestAnimationFrame(() => {
      composerInputRef.current?.focus?.();
    });
  }, [activeConversationId, replyingTo, editingMessageId]);

  useEffect(() => {
    if (!imageViewer) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setImageViewerContextMenu(null);
        setImageViewer(null);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setImageViewer((prev) => {
          if (!prev) return prev;
          const urls = Array.isArray(prev.urls) && prev.urls.length > 0 ? prev.urls : [prev.url];
          if (urls.length <= 1) return prev;
          const current = Math.max(0, Math.min(Number(prev.index || 0), urls.length - 1));
          const next = Math.max(0, Math.min(current + 1, urls.length - 1));
          if (next === current) return prev;
          return { ...prev, index: next, url: urls[next] };
        });
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setImageViewer((prev) => {
          if (!prev) return prev;
          const urls = Array.isArray(prev.urls) && prev.urls.length > 0 ? prev.urls : [prev.url];
          if (urls.length <= 1) return prev;
          const current = Math.max(0, Math.min(Number(prev.index || 0), urls.length - 1));
          const next = Math.max(0, Math.min(current - 1, urls.length - 1));
          if (next === current) return prev;
          return { ...prev, index: next, url: urls[next] };
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageViewer]);

  useEffect(() => {
    if (!imageViewerContextMenu) return undefined;
    const closeMenu = () => setImageViewerContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, [imageViewerContextMenu]);

  useEffect(() => {
    const onMouseDown = (event) => {
      const menuNode = mentionMenuRef.current;
      const inputNode = composerInputRef.current;
      const target = event.target;
      if (menuNode?.contains(target) || inputNode?.contains(target)) return;
      setMentionMenu((prev) => ({ ...prev, open: false }));
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    setMentionMenu((prev) => ({ ...prev, open: false }));
  }, [activeConversationId]);

  useEffect(() => {
    if (!composer) {
      if (Object.keys(composerMentionDrafts || {}).length > 0) setComposerMentionDrafts({});
      return;
    }
    const found = new Set((composer.match(MENTION_CHAR_RE) || []).map((ch) => String(ch)));
    const prevKeys = Object.keys(composerMentionDrafts || {});
    if (prevKeys.every((k) => found.has(k))) return;
    setComposerMentionDrafts((prev) => {
      const out = {};
      for (const key of Object.keys(prev || {})) {
        if (found.has(key)) out[key] = prev[key];
      }
      return out;
    });
  }, [composer, composerMentionDrafts]);

  const requestMessages = useCallback((conversationId) => {
    if (!conversationId || !window.api?.wsSend) return;
    msgsReqRef.current = rid();
    pendingRestoreConversationIdRef.current = idStr(conversationId);
    setLoadingMessages(true);
    window.api.wsSend({ type: "chat:messages:list", requestId: msgsReqRef.current, payload: { conversationId, limit: 150 } });
  }, []);

  const markRead = useCallback((conversationId) => {
    if (!conversationId || !window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:mark-read", requestId: rid(), payload: { conversationId } });
  }, []);

  const sendTyping = useCallback((conversationId, isTyping) => {
    if (!conversationId || !window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:typing", requestId: rid(), payload: { conversationId, isTyping: !!isTyping } });
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const isNearBottom = useCallback((el, threshold = 36) => {
    if (!el) return true;
    return el.scrollHeight - (el.scrollTop + el.clientHeight) <= threshold;
  }, []);

  const restoreScrollPosition = useCallback(
    (conversationId) => {
      const convId = idStr(conversationId);
      if (!convId) return;
      const el = viewportRef.current;
      if (!el) return;
      const saved = getScrollPosition(convId);
      if (saved) {
        if (saved.isAtBottom) {
          scrollToBottom(false);
        } else if (saved.visibleMessageId) {
          const row = el.querySelector(`.chatMessageRow[data-message-id="${saved.visibleMessageId}"]`);
          if (row) {
            el.scrollTop = row.offsetTop + (saved.visibleOffset || 0);
          } else {
            el.scrollTop = 0;
          }
        } else {
          el.scrollTop = saved.top;
        }
        return;
      }
      scrollToBottom(false);
    },
    [scrollToBottom, getScrollPosition]
  );

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

  const openUserProfile = useCallback(
    (user) => {
      const userId = idStr(user?._id);
      if (!userId || !onNavigate) return;
      onNavigate("employees:profile", {
        _id: userId,
        id: userId,
        name: user?.name || tr("chat.employeeFallback", "Employee"),
        workEmail: user?.workEmail || null,
        jobTitle: user?.jobTitle || null,
        uploads: user?.photoUrl ? { employeePhotoUrl: user.photoUrl } : undefined,
      });
    },
    [onNavigate]
  );

  const playMessageRingtone = useCallback(() => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = new Audio(getAssetUrl("assets/sounds/chat-notification.mp3"));
      ringtoneRef.current.preload = "auto";
      ringtoneRef.current.volume = 0.55;
    }
    try {
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(() => {});
    } catch {
      // ignore sound playback errors (missing file or browser autoplay policy)
    }
  }, []);

  const ensureDirectConversation = useCallback(
    (targetUserId) => {
      const normalizedTarget = idStr(targetUserId);
      if (!normalizedTarget || normalizedTarget === myUserId || !window.api?.wsSend) return false;

      const existing = conversations.find(
        (c) => c.kind === "direct" && idStr(c.directPeer?._id) === normalizedTarget
      );

      if (existing?._id) {
        const existingId = idStr(existing._id);
        setPreferredConversationId(existingId);
        setActiveConversationId(existingId);
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
    if (navigationIntent?.global || navigationIntent?.globalChat) {
      const globalId = findGlobalConversationId(conversations);
      if (globalId) {
        setPreferredConversationId(globalId);
        setActiveConversationId(globalId);
        setEmojiOpen(false);
        onConsumeIntent?.();
      }
      return;
    }

    const intentUserId = idStr(
      navigationIntent?.directUserId || navigationIntent?.userId || navigationIntent?._id
    );
    if (!intentUserId) return;
    const consumed = ensureDirectConversation(intentUserId);
    if (!consumed) return;
    onConsumeIntent?.();
  }, [conversations, ensureDirectConversation, navigationIntent, onConsumeIntent]);

  const activeTypingNames = useMemo(() => {
    const convId = idStr(activeConversationId);
    if (!convId) return [];
    const map = typingByConversation?.[convId] || {};
    const ids = Object.keys(map || {}).filter((id) => id && id !== myUserId);
    const byId = new Map((users || []).map((u) => [idStr(u._id), u]));
    return ids.map((id) => byId.get(id)?.name || tr("chat.employeeFallback", "Employee")).slice(0, 3);
  }, [activeConversationId, typingByConversation, users, myUserId, tr]);

  const myLastMessageSeen = useMemo(() => {
    if (!activeConversation || !messages.length) return false;
    const lastMine = [...messages].reverse().find((m) => idStr(m.sender?._id) === myUserId);
    if (!lastMine?.createdAt) return false;
    const t = new Date(lastMine.createdAt).getTime();
    if (!Number.isFinite(t)) return false;
    const others = (activeConversation.members || []).filter((m) => idStr(m._id) && idStr(m._id) !== myUserId);
    if (!others.length) return false;
    return others.every((m) => (m.lastReadAt ? new Date(m.lastReadAt).getTime() >= t : false));
  }, [activeConversation, messages, myUserId]);

  useEffect(() => {
    const api = window.api;
    if (!api?.onWsMessage || !api?.wsSend) return undefined;

    const unsub = api.onWsMessage((msg) => {
      if (!msg?.type) return;

      if (msg.type === "chat:conversations:list" && msg.requestId === listReqRef.current) {
        const list = Array.isArray(msg.conversations) ? msg.conversations : [];
        const sorted = list.slice().sort(sortConversations);
        setConversations(sorted);
        setLoadingConversations(false);
        return;
      }
      if (msg.type === "chat:conversations:list:result" && msg.requestId === listReqRef.current) {
        setLoadingConversations(false);
        notify?.error?.(tr("chat.notify.loadConversationsFailed", "Failed to load conversations."), tr("chat.title", "Chat"));
        return;
      }

      if (msg.type === "chat:users:list" && msg.requestId === usersReqRef.current) {
        setUsers(Array.isArray(msg.users) ? msg.users : []);
        return;
      }

      if (msg.type === "chat:messages:list" && msg.requestId === msgsReqRef.current) {
        if (msg.ok === false) {
          setLoadingMessages(false);
          notify?.error?.(tr("chat.notify.loadMessagesFailed", "Failed to load chat messages."), tr("chat.title", "Chat"));
          return;
        }
        setActiveConversation(msg.conversation || null);
        setMessages(Array.isArray(msg.messages) ? msg.messages : []);
        setLoadingMessages(false);
        requestConversations();
        requestUsers();
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
      if (msg.type === "chat:department:members:update" && idStr(msg.conversationId) === idStr(activeConversationId)) {
        const members = Array.isArray(msg.members) ? msg.members : [];
        setActiveConversation((prev) => ({ ...(prev || {}), members, memberCount: members.length }));
        setConversations((prev) =>
          prev.map((conv) =>
            idStr(conv._id) === idStr(msg.conversationId)
              ? { ...conv, memberCount: members.length }
              : conv
          )
        );
        return;
      }

      if (msg?.type === "chat:typing" && msg?.conversationId && msg?.userId && idStr(msg.userId) !== myUserId) {
        const convId = idStr(msg.conversationId);
        const uid = idStr(msg.userId);
        const nowMs = Date.now();
        setTypingByConversation((prev) => {
          const next = { ...(prev || {}) };
          const existing = next[convId] && typeof next[convId] === "object" ? { ...next[convId] } : {};
          if (msg.isTyping) existing[uid] = nowMs;
          else delete existing[uid];
          next[convId] = existing;
          return next;
        });

        const key = `${convId}:${uid}`;
        const prevTimer = typingTimersRef.current.get(key);
        if (prevTimer) clearTimeout(prevTimer);
        if (msg.isTyping) {
          typingTimersRef.current.set(
            key,
            setTimeout(() => {
              setTypingByConversation((prev) => {
                const next = { ...(prev || {}) };
                const existing = next[convId] && typeof next[convId] === "object" ? { ...next[convId] } : {};
                delete existing[uid];
                next[convId] = existing;
                return next;
              });
              typingTimersRef.current.delete(key);
            }, 4500)
          );
        }
        return;
      }

      if (msg?.type === "chat:read" && msg?.conversationId && msg?.userId && msg?.lastReadAt) {
        const convId = idStr(msg.conversationId);
        if (convId !== idStr(activeConversationId)) return;
        const uid = idStr(msg.userId);
        const lastReadAt = msg.lastReadAt;
        setActiveConversation((prev) => {
          if (!prev) return prev;
          const members = Array.isArray(prev.members) ? prev.members : [];
          const nextMembers = members.map((m) => (idStr(m._id) === uid ? { ...m, lastReadAt } : m));
          return { ...prev, members: nextMembers };
        });
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
        const fromOtherUser = idStr(msg.message?.sender?._id) !== myUserId;
        if (convId === idStr(activeConversationId)) {
          const shouldStickToBottom = isNearBottom(viewportRef.current);
          setMessages((prev) => {
            if (prev.some((m) => idStr(m._id) === idStr(msg.message._id))) return prev;
            return [...prev, msg.message];
          });
          animateMessage(idStr(msg.message._id));
          if (fromOtherUser) {
            markRead(convId);
          }
          if (shouldStickToBottom) {
            requestAnimationFrame(() => scrollToBottom(true));
          }
        }
        if (fromOtherUser) {
          playMessageRingtone();
          if (convId !== idStr(activeConversationId)) {
            const senderName = msg.message?.sender?.name || tr("chat.someone", "Someone");
            const text = String(msg.message?.poll?.title || msg.message?.text || tr("chat.newMessage", "New message"));
            notify?.info?.(text.slice(0, 120), tr("chat.notify.newMessageFrom", "New message from {{name}}").replace("{{name}}", senderName));
          }
        }
        return;
      }

      if (msg.type === "chat:mention" && msg.message) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        const senderName = msg.message?.sender?.name || tr("chat.someone", "Someone");
        const text = String(msg.message?.text || tr("chat.newMessage", "New message"));
        if (convId !== idStr(activeConversationId)) {
          notify?.warning?.(`@ ${text.slice(0, 120)}`, tr("chat.notify.mentionFrom", "Mention from {{name}}").replace("{{name}}", senderName));
        }
        return;
      }

      if (msg.type === "chat:message:poll:update" && msg.message?._id) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) => prev.map((m) => (idStr(m._id) === idStr(msg.message._id) ? { ...m, ...msg.message } : m)));
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
                ? { ...m, removed: true, text: tr("chat.removedMessage", "Removed Message"), removedAt: msg.message.removedAt || new Date().toISOString() }
                : m
            )
          );
          setPendingRemoveByMessageId((prev) => {
            const next = { ...prev };
            delete next[idStr(msg.message._id)];
            return next;
          });
        }
        return;
      }

      if (msg.type === "chat:message:remove:pending" && msg.message?._id) {
        if (msg.conversation) setConversations((prev) => upsertConversation(prev, msg.conversation));
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) => prev.map((m) => (idStr(m._id) === idStr(msg.message._id) ? { ...m, ...msg.message } : m)));
          setPendingRemoveByMessageId((prev) => ({
            ...prev,
            [idStr(msg.message._id)]: Date.now() + Number(msg.undoWindowSeconds || 5) * 1000,
          }));
        }
        return;
      }

      if (msg.type === "chat:message:remove:undone" && msg.message?._id) {
        if (msg.conversation) setConversations((prev) => upsertConversation(prev, msg.conversation));
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) => prev.map((m) => (idStr(m._id) === idStr(msg.message._id) ? { ...m, ...msg.message } : m)));
          setPendingRemoveByMessageId((prev) => {
            const next = { ...prev };
            delete next[idStr(msg.message._id)];
            return next;
          });
        }
        return;
      }

      if ((msg.type === "chat:message:edited" || msg.type === "chat:message:reaction") && msg.message?._id) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) =>
            prev.map((m) => {
              if (idStr(m._id) !== idStr(msg.message._id)) return m;
              if (msg.type === "chat:message:reaction") {
                const prevReactions = Array.isArray(m.reactions) ? m.reactions : [];
                const nextReactions = Array.isArray(msg.message.reactions) ? msg.message.reactions : [];
                if (prevReactions.length > 0 && nextReactions.length === 0) {
                  const mid = idStr(msg.message._id);
                  setReactionExitMessageIds((prevSet) => {
                    const nextSet = new Set(prevSet);
                    nextSet.add(mid);
                    return nextSet;
                  });
                  const prevExitTimer = reactionExitTimersRef.current.get(mid);
                  if (prevExitTimer) clearTimeout(prevExitTimer);
                  const exitTimer = setTimeout(() => {
                    setReactionExitMessageIds((prevSet) => {
                      const nextSet = new Set(prevSet);
                      nextSet.delete(mid);
                      return nextSet;
                    });
                    reactionExitTimersRef.current.delete(mid);
                  }, 460);
                  reactionExitTimersRef.current.set(mid, exitTimer);
                }
                const prevMap = new Map(prevReactions.map((reaction) => [String(reaction.emoji || ""), Number(reaction.count || 0)]));
                const nextMap = new Map(nextReactions.map((reaction) => [String(reaction.emoji || ""), Number(reaction.count || 0)]));
                const touched = new Set([...prevMap.keys(), ...nextMap.keys()]);
                for (const emoji of touched) {
                  if (!emoji) continue;
                  if ((prevMap.get(emoji) || 0) !== (nextMap.get(emoji) || 0)) {
                    const reactionKey = `${idStr(msg.message._id)}-${emoji}`;
                    setAnimatedReactionKeys((prevSet) => {
                      const nextSet = new Set(prevSet);
                      nextSet.add(reactionKey);
                      return nextSet;
                    });
                    const prevTimer = reactionAnimTimersRef.current.get(reactionKey);
                    if (prevTimer) clearTimeout(prevTimer);
                    const timer = setTimeout(() => {
                      setAnimatedReactionKeys((prevSet) => {
                        const nextSet = new Set(prevSet);
                        nextSet.delete(reactionKey);
                        return nextSet;
                      });
                      reactionAnimTimersRef.current.delete(reactionKey);
                    }, 420);
                    reactionAnimTimersRef.current.set(reactionKey, timer);
                  }
                }
              }
              return { ...m, ...msg.message, replyTo: m.replyTo };
            })
          );
        }
        return;
      }
      if (msg.type === "chat:message:pinned" && msg.message?._id) {
        const convId = idStr(msg.message.conversationId || msg.conversationId);
        if (convId === idStr(activeConversationId)) {
          setMessages((prev) => prev.map((m) => (idStr(m._id) === idStr(msg.message._id) ? { ...m, ...msg.message, replyTo: m.replyTo } : m)));
        }
        return;
      }

      if (msg.type === "chat:message:send:result" && msg.requestId === sendReqRef.current) {
        setSending(false);
        if (!msg.ok) {
          if (msg.error === "global_chat_locked") {
            notify?.warning?.(tr("chat.notify.globalLocked", "Global chat is locked. You do not have permission to send messages."), tr("chat.title", "Chat"));
          } else {
            const err = msg?.error ? String(msg.error) : "";
            const details = msg?.details ? String(msg.details) : "";
            notify?.error?.(
              tr("chat.notify.sendFailed", "Message failed to send.") +
                (err ? ` (${err})` : "") +
                (details ? ` - ${details}` : ""),
              tr("chat.title", "Chat")
            );
          }
        }
        return;
      }

      if (msg.type === "chat:message:edit:result" && msg.requestId === sendReqRef.current) {
        setSending(false);
        if (!msg.ok) notify?.error?.(tr("chat.notify.editFailed", "Message could not be edited."), tr("chat.title", "Chat"));
        return;
      }

      if (msg.type === "chat:message:remove:result" && msg.requestId === removeReqRef.current) {
        setRemovingMessageId(null);
        if (!msg.ok) notify?.error?.(tr("chat.notify.removeFailed", "Message could not be removed."), tr("chat.title", "Chat"));
        return;
      }

      if (msg.type === "chat:message:remove:undo:result") {
        if (!msg.ok && msg.requestId === removeReqRef.current) notify?.error?.(tr("chat.notify.undoRemoveFailed", "Could not undo message removal."), tr("chat.title", "Chat"));
        return;
      }
      if (msg.type === "chat:message:pin:result") {
        if (!msg.ok) notify?.error?.(tr("chat.notify.pinFailed", "Could not update pin state."), tr("chat.title", "Chat"));
        return;
      }

      if (
        msg.type === "chat:direct:ensure:result" &&
        (msg.requestId === directReqRef.current || msg.requestId === directIntentReqRef.current)
      ) {
        const isModalRequest = msg.requestId === directReqRef.current;
        if (isModalRequest) setCreatingConversation(false);
        if (!msg.ok || !msg.conversationId) {
          if (isModalRequest) notify?.error?.(tr("chat.notify.startDirectFailed", "Could not start direct chat."), tr("chat.title", "Chat"));
          directIntentReqRef.current = null;
          return;
        }
        if (isModalRequest) setStartModalOpen(false);
        setPreferredConversationId(idStr(msg.conversationId));
        setActiveConversationId(idStr(msg.conversationId));
        directIntentReqRef.current = null;
        requestConversations();
        return;
      }

      if (msg.type === "chat:group:create:result" && msg.requestId === groupReqRef.current) {
        setCreatingConversation(false);
        if (!msg.ok || !msg.conversationId) {
          const errMsg =
            msg.error === "at_least_one_member_required"
              ? tr("chat.notify.groupNeedMember", "Select at least one member for the group.")
              : msg.error === "at_least_two_members_required"
                ? tr("chat.notify.groupNeedOther", "Select at least one other member (group needs you plus one more).")
                : msg.error === "invalid_title"
                  ? tr("chat.notify.groupTitleInvalid", "Group title must be 2–80 characters.")
                  : msg.error === "unauthorized"
                    ? tr("chat.notify.unauthorizedCreateGroup", "You must be logged in to create a group.")
                    : msg.error
                      ? String(msg.error).replace(/_/g, " ")
                      : tr("chat.notify.groupCreateFailed", "Could not create group.");
          return notify?.error?.(errMsg, tr("chat.title", "Chat"));
        }
        setStartModalOpen(false);
        setPreferredConversationId(idStr(msg.conversationId));
        setActiveConversationId(idStr(msg.conversationId));
        requestConversations();
        return;
      }

      if (msg.type === "chat:group:leave:result" && msg.requestId === leaveReqRef.current) {
        setLeavingGroup(false);
        if (!msg.ok) return notify?.error?.(tr("chat.notify.leaveGroupFailed", "Could not leave this group."), tr("chat.title", "Chat"));
        setActiveConversationId(null);
        setActiveConversation(null);
        setMessages([]);
        requestConversations();
        return;
      }

      if (msg.type === "chat:conversation:hide:result" && msg.requestId === hideReqRef.current) {
        setHidingConversation(false);
        if (!msg.ok) return notify?.error?.(tr("chat.notify.hideConversationFailed", "Could not remove conversation."), tr("chat.title", "Chat"));
        setHideConversationModalOpen(false);
        setHideTargetConversationId(null);
        if (idStr(activeConversationId) === idStr(msg.conversationId)) {
          setActiveConversationId(null);
          setActiveConversation(null);
          setMessages([]);
        }
        requestConversations();
        return;
      }

      if (msg.type === "chat:conversation:archive:result" && msg.requestId === archiveReqRef.current) {
        setArchivingConversation(false);
        if (!msg.ok) return notify?.error?.(tr("chat.notify.archiveFailed", "Could not update archive state."), tr("chat.title", "Chat"));
        requestConversations();
        return;
      }

      if (msg.type === "chat:poll:create:result" && msg.requestId === pollCreateReqRef.current) {
        if (pollCreateTimeoutRef.current) {
          clearTimeout(pollCreateTimeoutRef.current);
          pollCreateTimeoutRef.current = null;
        }
        setCreatingPoll(false);
        if (!msg.ok) {
          const err =
            msg.error === "forbidden"
              ? tr("chat.notify.pollForbidden", "You do not have permission to create polls.")
              : msg.error === "poll_title_required"
                ? tr("chat.notify.pollTitleRequired", "Poll title is required.")
                : msg.error === "invalid_poll_options"
                  ? tr("chat.notify.pollOptionsInvalid", "Poll needs between 2 and 10 unique answers.")
                  : msg.error === "poll_duration_required"
                    ? tr("chat.notify.pollDurationRequired", "Poll duration is required.")
                    : tr("chat.notify.pollCreateFailed", "Could not create poll.");
          return notify?.error?.(err, tr("chat.title", "Chat"));
        }
        setPollComposerOpen(false);
        setPollTitle("");
        setPollAnswers(["", ""]);
        setPollDurationPreset("1h");
        setPollCustomMinutes("");
        return;
      }

      if (msg.type === "error" && msg.requestId === pollCreateReqRef.current) {
        if (pollCreateTimeoutRef.current) {
          clearTimeout(pollCreateTimeoutRef.current);
          pollCreateTimeoutRef.current = null;
        }
        setCreatingPoll(false);
        notify?.error?.(tr("chat.notify.pollCreateFailed", "Could not create poll."), tr("chat.title", "Chat"));
        return;
      }

      if (msg.type === "chat:poll:vote:result" && msg.requestId === pollVoteReqRef.current) {
        setVotingPollMessageId(null);
        if (!msg.ok) {
          const err = msg.error === "poll_closed"
            ? tr("chat.notify.pollClosed", "This poll is already closed.")
            : tr("chat.notify.pollVoteFailed", "Could not submit vote.");
          notify?.warning?.(err, tr("chat.poll.title", "Poll"));
        }
      }
      if (msg.type === "chat:department:member:add:result" && msg.requestId === deptMemberAddReqRef.current) {
        const pendingId = addingDepartmentMemberId;
        setAddingDepartmentMemberId(null);
        if (!msg.ok) {
          const err = msg.error === "same_department_member"
            ? tr("chat.notify.departmentMemberSameDept", "This employee already belongs to this department.")
            : tr("chat.notify.departmentMemberAddFailed", "Could not add external member.");
          notify?.warning?.(err, tr("chat.title", "Chat"));
        } else if (pendingId) {
          setDepartmentMemberQuery("");
        }
        return;
      }
      if (msg.type === "chat:department:member:remove:result" && msg.requestId === deptMemberRemoveReqRef.current) {
        setRemovingDepartmentMemberId(null);
        if (!msg.ok) {
          notify?.warning?.(tr("chat.notify.departmentMemberRemoveFailed", "Could not remove external member."), tr("chat.title", "Chat"));
        }
        return;
      }
    });

    (async () => {
      try {
        await api.wsConnect();
        requestConversations();
        requestUsers();
        requestGlobalLockState();
      } catch {
        setLoadingConversations(false);
      }
    })();

    return () => unsub?.();
  }, [
    activeConversationId,
    animateMessage,
    isNearBottom,
    markRead,
    myUserId,
    notify,
    playMessageRingtone,
    requestConversations,
    requestGlobalLockState,
    requestUsers,
    restoreScrollPosition,
    scrollToBottom,
    requestMessages,
    activeConversationId,
    addingDepartmentMemberId,
  ]);

  useEffect(() => {
    if (!conversations.length) {
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      setPreferredConversationId(null);
      return;
    }

    const globalConversationId = findGlobalConversationId(conversations);

    if (preferredConversationId) {
      const preferredExists = conversations.some(
        (conversation) => idStr(conversation._id) === idStr(preferredConversationId)
      );
      if (preferredExists) {
        if (idStr(activeConversationId) !== idStr(preferredConversationId)) {
          setActiveConversationId(idStr(preferredConversationId));
        }
        setPreferredConversationId(null);
      }
      return;
    }

    if (!conversations.some((x) => idStr(x._id) === idStr(activeConversationId))) {
      setActiveConversationId(globalConversationId || idStr(conversations[0]._id));
    }
  }, [conversations, activeConversationId, preferredConversationId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !activeConversationId) return undefined;
    const convId = idStr(activeConversationId);
    let rafId;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!el || !el.querySelector('.chatMessageRow')) return;
        if (idStr(pendingRestoreConversationIdRef.current) === convId) return;
        const isAtBottom = isNearBottom(el, 36);

        let visibleMessageId = null;
        let visibleOffset = 0;
        if (!isAtBottom) {
          const rows = el.querySelectorAll('.chatMessageRow');
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.offsetTop + row.offsetHeight > el.scrollTop) {
              visibleMessageId = row.getAttribute('data-message-id');
              visibleOffset = el.scrollTop - row.offsetTop;
              break;
            }
          }
        }

        saveScrollPosition(convId, el.scrollTop, isAtBottom, visibleMessageId, visibleOffset);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (el && el.querySelector('.chatMessageRow')) {
        if (idStr(pendingRestoreConversationIdRef.current) !== convId) {
          const isAtBottom = isNearBottom(el, 36);
          let visibleMessageId = null;
          let visibleOffset = 0;
          if (!isAtBottom) {
            const rows = el.querySelectorAll('.chatMessageRow');
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (row.offsetTop + row.offsetHeight > el.scrollTop) {
                visibleMessageId = row.getAttribute('data-message-id');
                visibleOffset = el.scrollTop - row.offsetTop;
                break;
              }
            }
          }
          saveScrollPosition(convId, el.scrollTop, isAtBottom, visibleMessageId, visibleOffset);
        }
      }
      cancelAnimationFrame(rafId);
    };
  }, [activeConversationId, isNearBottom, saveScrollPosition]);

  useEffect(() => {
    const pendingId = idStr(pendingRestoreConversationIdRef.current);
    if (!pendingId || pendingId !== idStr(activeConversationId) || loadingMessages) return;
    let cancelled = false;
    const runRestore = () => {
      if (cancelled) return;
      restoreScrollPosition(pendingId);
    };

    let raf1 = 0;
    let raf2 = 0;
    const t1 = setTimeout(runRestore, 40);
    const t2 = setTimeout(runRestore, 140);
    const t3 = setTimeout(runRestore, 320);
    const t4 = setTimeout(() => {
      runRestore();
      pendingRestoreConversationIdRef.current = null;
    }, 700);
    raf1 = requestAnimationFrame(() => {
      runRestore();
      raf2 = requestAnimationFrame(runRestore);
    });

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeConversationId, loadingMessages, messages.length, restoreScrollPosition]);

  useEffect(() => {
    if (!activeConversationId) return;
    const active = conversations.find((x) => idStr(x._id) === idStr(activeConversationId));
    if (!active) return;
    if (!archiveView && active.archived === true) {
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
    }
  }, [activeConversationId, archiveView, conversations]);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!messageContextMenu) return undefined;
    const close = () => setMessageContextMenu(null);
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [messageContextMenu]);

  useEffect(() => {
    if (!conversationContextMenu) return undefined;
    const close = () => setConversationContextMenu(null);
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [conversationContextMenu]);

  useEffect(() => {
    if (!activeConversationId) return;
    setReplyingTo(null);
    setEditingMessageId(null);
    setPinnedPopoverOpen(false);
    setDepartmentMembersOpen(false);
    setDepartmentMemberQuery("");
    const summary = conversationsRef.current.find((x) => idStr(x._id) === idStr(activeConversationId));
    setActiveConversation(
      summary
        ? {
            _id: summary._id,
            kind: summary.kind,
            title: summary.title,
            memberCount: summary.memberCount || 0,
            members: [],
          }
        : null
    );
    setMessages([]);
    requestMessages(activeConversationId);
    markRead(activeConversationId);
  }, [activeConversationId, markRead, requestMessages]);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    const close = (event) => {
      const target = event.target;
      if (emojiPanelRef.current?.contains(target)) return;
      if (emojiBtnRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [emojiOpen]);

  useEffect(() => {
    if (!reactionEmojiTarget) return undefined;
    const close = (event) => {
      const target = event.target;
      if (reactionEmojiPanelRef.current?.contains(target)) return;
      const btnNode = reactionEmojiBtnRefs.current.get(reactionEmojiTarget);
      if (btnNode?.contains(target)) return;
      setReactionEmojiTarget(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reactionEmojiTarget]);

  useEffect(() => {
    if (!pinnedPopoverOpen) return undefined;
    const close = (event) => {
      const target = event.target;
      if (pinnedPopoverRef.current?.contains(target)) return;
      if (pinnedBtnRef.current?.contains(target)) return;
      setPinnedPopoverOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pinnedPopoverOpen]);

  useEffect(() => {
    if (!departmentMembersOpen) return undefined;
    const close = (event) => {
      const target = event.target;
      if (departmentMembersPopoverRef.current?.contains(target)) return;
      setDepartmentMembersOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [departmentMembersOpen]);

  useEffect(() => () => {
    for (const timer of animTimersRef.current.values()) clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (replyJumpTimerRef.current) clearTimeout(replyJumpTimerRef.current);
    },
    []
  );

  useEffect(
    () => () => {
      for (const timer of reactionAnimTimersRef.current.values()) clearTimeout(timer);
      reactionAnimTimersRef.current.clear();
      for (const timer of reactionExitTimersRef.current.values()) clearTimeout(timer);
      reactionExitTimersRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      if (pollCreateTimeoutRef.current) clearTimeout(pollCreateTimeoutRef.current);
    },
    []
  );

  useEffect(
    () => () => {
      pruneEmptyDirectConversations(conversationsRef.current);
    },
    [pruneEmptyDirectConversations]
  );

  useEffect(() => {
    const handlePageHide = () => pruneEmptyDirectConversations(conversationsRef.current);
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [pruneEmptyDirectConversations]);

  const filteredConversations = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    const byArchive = conversations.filter((c) => (archiveView ? c.archived === true : c.archived !== true));
    if (!q) return byArchive;
    return byArchive.filter((c) =>
      `${c.title || ""} ${c.directPeer?.name || ""} ${c.directPeer?.workEmail || ""} ${c.lastMessagePreview || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [archiveView, conversations, searchQuery]);

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
  const pinnedMessages = useMemo(
    () => messages.filter((message) => message?.pinned && !message?.removed),
    [messages]
  );
  const pinnedMessagesCount = pinnedMessages.length;

  const conversationMembersById = useMemo(() => {
    const map = new Map();
    const members = Array.isArray(activeConversation?.members) ? activeConversation.members : [];
    for (const member of members) {
      map.set(idStr(member._id), member);
    }
    return map;
  }, [activeConversation]);

  const activeTitle = activeConversation?.title || activeConversationSummary?.title || tr("chat.conversationFallback", "Conversation");

  const messagesWithGrouping = useMemo(() => {
    const list = messages;
    if (!list.length) return [];
    return list.map((msg, i) => {
      const prev = list[i - 1];
      const sameSender = prev && idStr(prev.sender?._id) === idStr(msg.sender?._id);
      const prevTime = prev?.createdAt ? new Date(prev.createdAt).getTime() : 0;
      const currTime = msg?.createdAt ? new Date(msg.createdAt).getTime() : 0;
      const withinWindow = currTime - prevTime <= GROUP_WINDOW_MS;
      const forceNewGroup = Boolean(msg?.replyTo);
      const showMessageHeader = forceNewGroup || !sameSender || !withinWindow;
      const prevDay = prev?.createdAt ? new Date(prev.createdAt).toDateString() : "";
      const currDay = msg?.createdAt ? new Date(msg.createdAt).toDateString() : "";
      const showDayDivider = !prev || prevDay !== currDay;
      return { ...msg, showMessageHeader, showDayDivider, dayLabel: formatDayLabel(msg?.createdAt) };
    });
  }, [messages]);

  const activeSubtitle = useMemo(() => {
    if (activeConversation?.kind === "global" || activeConversationSummary?.kind === "global") {
      return tr("chat.subtitle.global", "Broadcast channel for all users");
    }
    if (activeConversation?.kind === "department" || activeConversationSummary?.kind === "department") {
      const count = activeConversation?.memberCount ?? activeConversationSummary?.memberCount ?? 0;
      return tr(
        count === 1 ? "chat.subtitle.departmentSingle" : "chat.subtitle.departmentPlural",
        count === 1 ? "{{count}} associated member" : "{{count}} associated members"
      ).replace("{{count}}", String(count));
    }
    if (activeConversation?.kind === "group" || activeConversationSummary?.kind === "group") {
      const count = activeConversation?.memberCount ?? activeConversationSummary?.memberCount ?? 0;
      return tr(
        count === 1 ? "chat.subtitle.memberSingle" : "chat.subtitle.memberPlural",
        count === 1 ? "{{count}} member" : "{{count}} members"
      ).replace("{{count}}", String(count));
    }
    const peer = activeConversationSummary?.directPeer;
    return peer
      ? (peer.online ? tr("chat.status.online", "Online") : tr("chat.status.offline", "Offline"))
      : tr("chat.subtitle.direct", "Direct conversation");
  }, [activeConversation, activeConversationSummary]);

  const canLeaveActiveGroup = Boolean(activeConversation?.canLeave || activeConversationSummary?.canLeave);
  const activeIsGlobal = activeConversationSummary?.kind === "global";
  const activeIsDepartment = activeConversationSummary?.kind === "department";
  const canManageDepartmentMembers = hasPermission(account, DEPARTMENT_MEMBERS_MANAGE_PERMISSION);
  const canCreateGlobalPoll = hasPermission(account, GLOBAL_CHAT_POLL_CREATE_PERMISSION);
  const canCreatePollInActiveChat = canCreateGlobalPoll && (activeIsGlobal || activeIsDepartment);
  const hasGlobalChatBypassPermission = hasPermission(
    account,
    globalChatLock.permission || DEFAULT_GLOBAL_CHAT_LOCK_PERMISSION
  );
  const isGlobalChatLockedForMe = activeIsGlobal && globalChatLock.locked && !hasGlobalChatBypassPermission;
  const activeAssociatedMembers = useMemo(() => {
    const members = Array.isArray(activeConversation?.members) ? activeConversation.members : [];
    const unique = new Map();
    for (const member of members) {
      if (member?.departmentObserver) continue;
      const uid = idStr(member?._id);
      if (!uid || unique.has(uid)) continue;
      unique.set(uid, member);
    }
    return Array.from(unique.values());
  }, [activeConversation]);
  const activeExternalMembers = useMemo(
    () => activeAssociatedMembers.filter((m) => !!m?.departmentExternal),
    [activeAssociatedMembers]
  );
  const departmentCandidateUsers = useMemo(() => {
    if (!activeIsDepartment) return [];
    const q = String(departmentMemberQuery || "").trim().toLowerCase();
    const existing = new Set(activeAssociatedMembers.map((m) => idStr(m._id)));
    const activeDepartmentKey = String(activeConversationSummary?.departmentKey || "").trim().toLowerCase();
    return users.filter((u) => {
      const uid = idStr(u._id);
      if (!uid || existing.has(uid)) return false;
      const userDepartmentKey = String(u?.department || "").trim().toLowerCase();
      if (activeDepartmentKey && userDepartmentKey && activeDepartmentKey === userDepartmentKey) return false;
      if (!q) return true;
      return `${u.name || ""} ${u.workEmail || ""} ${u.department || ""}`.toLowerCase().includes(q);
    });
  }, [activeAssociatedMembers, activeConversationSummary?.departmentKey, activeIsDepartment, departmentMemberQuery, users]);

  const mentionCandidates = useMemo(() => {
    const convMembers = Array.isArray(activeConversation?.members) ? activeConversation.members : [];
    const memberMap = new Map(convMembers.map((m) => [idStr(m._id), m]));
    const allowedUserIds = new Set();
    if (activeIsGlobal) {
      for (const u of users) allowedUserIds.add(idStr(u._id));
      for (const m of convMembers) allowedUserIds.add(idStr(m._id));
    } else {
      for (const m of convMembers) allowedUserIds.add(idStr(m._id));
    }
    allowedUserIds.delete(myUserId);

    const usersOut = [];
    for (const u of users) {
      const uid = idStr(u._id);
      if (!uid || !allowedUserIds.has(uid)) continue;
      usersOut.push({
        id: `u:${uid}`,
        kind: "user",
        value: uid,
        label: u.name || tr("chat.employeeFallback", "Employee"),
        sub: u.workEmail || u.department || "",
        photoUrl: u.photoUrl || null,
      });
    }
    for (const [uid, m] of memberMap.entries()) {
      if (!uid || uid === myUserId || usersOut.some((x) => x.value === uid)) continue;
      usersOut.push({
        id: `u:${uid}`,
        kind: "user",
        value: uid,
        label: m.name || tr("chat.employeeFallback", "Employee"),
        sub: m.workEmail || m.department || "",
        photoUrl: m.photoUrl || null,
      });
    }
    usersOut.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const rolesMap = new Map();
    const sourceUsers = activeIsGlobal ? users : users.filter((u) => allowedUserIds.has(idStr(u._id)));
    for (const u of sourceUsers) {
      const roleName = String(u?.roleName || "").trim();
      if (!roleName) continue;
      const key = roleName.toLowerCase();
      if (!rolesMap.has(key)) rolesMap.set(key, { id: `r:${key}`, kind: "role", value: key, label: roleName, sub: tr("chat.mentionRole", "Role") });
    }
    const rolesOut = Array.from(rolesMap.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const departmentsOut = [];
    if (activeIsGlobal) {
      const depMap = new Map();
      for (const u of users) {
        const dep = String(u?.department || "").trim();
        if (!dep) continue;
        const key = dep.toLowerCase();
        if (!depMap.has(key)) depMap.set(key, { id: `d:${key}`, kind: "department", value: key, label: dep, sub: tr("chat.mentionDepartment", "Department") });
      }
      departmentsOut.push(...Array.from(depMap.values()).sort((a, b) => String(a.label).localeCompare(String(b.label))));
    }

    return {
      users: usersOut,
      departments: departmentsOut,
      roles: rolesOut,
    };
  }, [activeConversation, activeIsGlobal, myUserId, tr, users]);

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
        notify?.warning?.(tr("chat.notify.selectEmployeeForDirect", "Select one employee to start a direct chat."), tr("chat.title", "Chat"));
        return;
      }
      setCreatingConversation(true);
      directReqRef.current = rid();
      window.api.wsSend({ type: "chat:direct:ensure", requestId: directReqRef.current, payload: { userId } });
      return;
    }

    const title = String(groupTitle || "").trim();
    if (title.length < 2) {
      notify?.warning?.(tr("chat.notify.groupTitleMin", "Group title should be at least 2 characters."), tr("chat.title", "Chat"));
      return;
    }

    if (selectedMemberIds.length < 1) {
      notify?.warning?.(tr("chat.notify.selectEmployeeForGroup", "Select at least one employee for the group."), tr("chat.title", "Chat"));
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

  const pickComposerImage = useCallback(async () => {
    try {
      const picked = await window.api?.pickImages?.();
      const paths = Array.isArray(picked?.paths) ? picked.paths : [];
      if (!picked?.ok || paths.length === 0) return;
      const toAdd = [];
      for (const p of paths) {
        const prev = await window.api?.fileToDataUrl?.(p);
        if (!prev?.ok || !prev?.dataUrl) continue;
        toAdd.push({
          id: rid(),
          dataUrl: prev.dataUrl,
          filePath: p,
          fileName: String(p).split(/[/\\]/).pop() || "image.png",
        });
      }
      if (!toAdd.length) {
        notify?.error?.(tr("chat.notify.imagePreviewFailed", "Image preview failed."), tr("chat.title", "Chat"));
        return;
      }
      setComposerImages((prevList) => [...prevList, ...toAdd].slice(0, 8));
    } catch {
      notify?.error?.(tr("chat.notify.imagePickFailed", "Failed to pick image."), tr("chat.title", "Chat"));
    }
  }, [notify, tr]);

  const openImageViewer = useCallback((url, options = {}) => {
    const normalized = String(url || "").trim();
    if (!normalized) return;
    const urls = Array.isArray(options?.urls)
      ? options.urls.map((u) => String(u || "").trim()).filter(Boolean)
      : [normalized];
    const initialIndex = Math.max(0, Math.min(Number(options?.index || 0), Math.max(0, urls.length - 1)));
    setImageViewer({
      url: urls[initialIndex] || normalized,
      urls,
      index: initialIndex,
      name: options?.name || "image",
      authorName: options?.authorName || null,
      authorPhoto: options?.authorPhoto || null,
      createdAt: options?.createdAt || null,
    });
    setImageViewerContextMenu(null);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerContextMenu(null);
    setImageViewer(null);
  }, []);

  const imageViewerCurrentUrl = useMemo(() => {
    if (!imageViewer) return "";
    const urls = Array.isArray(imageViewer.urls) && imageViewer.urls.length > 0 ? imageViewer.urls : [imageViewer.url];
    const idx = Math.max(0, Math.min(Number(imageViewer.index || 0), urls.length - 1));
    return urls[idx] || imageViewer.url || "";
  }, [imageViewer]);

  useEffect(() => {
    const node = composerInputRef.current;
    if (!node) return;
    if (!composer && node.innerHTML !== "") {
      node.innerHTML = "";
    }
  }, [composer]);

  const stepImageViewer = useCallback((delta) => {
    setImageViewer((prev) => {
      if (!prev) return prev;
      const urls = Array.isArray(prev.urls) && prev.urls.length > 0 ? prev.urls : [prev.url];
      if (urls.length <= 1) return prev;
      const current = Math.max(0, Math.min(Number(prev.index || 0), urls.length - 1));
      const next = Math.max(0, Math.min(current + delta, urls.length - 1));
      if (next === current) return prev;
      return { ...prev, index: next, url: urls[next] };
    });
  }, []);

  const saveImageFromUrl = useCallback(
    async (url, name = "image") => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        const baseName = String(name || "image").trim();
        a.download = /\.[a-z0-9]{2,6}$/i.test(baseName) ? baseName : `${baseName}.png`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      } catch {
        notify?.error?.(tr("chat.notify.imageSaveFailed", "Failed to save image."), tr("chat.title", "Chat"));
      }
    },
    [notify, tr]
  );

  const copyImageFromUrl = useCallback(
    async (url) => {
      try {
        const nativeCopy = await window.api?.copyImageToClipboard?.(url);
        if (nativeCopy?.ok) {
          notify?.success?.(tr("chat.notify.imageCopied", "Image copied."), tr("chat.title", "Chat"));
          return;
        }
        const response = await fetch(url);
        const blob = await response.blob();
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new window.ClipboardItem({ [blob.type || "image/png"]: blob });
          await navigator.clipboard.write([item]);
          notify?.success?.(tr("chat.notify.imageCopied", "Image copied."), tr("chat.title", "Chat"));
          return;
        }
        await navigator.clipboard?.writeText?.(url);
        notify?.info?.(tr("chat.notify.imageUrlCopied", "Image URL copied."), tr("chat.title", "Chat"));
      } catch {
        notify?.error?.(tr("chat.notify.imageCopyFailed", "Failed to copy image."), tr("chat.title", "Chat"));
      }
    },
    [notify, tr]
  );

  const setComposerImageFromFile = useCallback((file) => {
    if (!file || !String(file.type || "").startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setComposerImages((prevList) => {
        const next = [...prevList, { id: rid(), dataUrl, fileName: file.name || "pasted-image.png" }];
        return next.slice(0, 8);
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const syncComposerFromDOM = useCallback(() => {
    const node = composerInputRef.current;
    if (!node) return "";
    let text = "";
    const walk = (parent) => {
      for (let i = 0; i < parent.childNodes.length; i += 1) {
        const child = parent.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains("chatInlineMention")) {
            text += child.dataset.marker || "";
          } else if (child.nodeName === "BR") {
            text += "\n";
          } else {
            walk(child);
          }
        }
      }
    };
    walk(node);
    setComposer(text);
    return text;
  }, []);

  const updateMentionMenuFromDOM = useCallback(() => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setMentionMenu((prev) => ({ ...prev, open: false }));
      return;
    }
    const text = node.textContent;
    const offset = range.startOffset;
    const left = text.slice(0, offset);
    const at = left.lastIndexOf("@");
    if (at < 0) {
      setMentionMenu((prev) => ({ ...prev, open: false }));
      return;
    }
    const token = left.slice(at + 1);
    if (!/^[^\s@]*$/.test(token)) {
      setMentionMenu((prev) => ({ ...prev, open: false }));
      return;
    }
    const q = token.toLowerCase();
    const filterByQ = (arr) => arr.filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(q));
    const filtered = {
      users: filterByQ(mentionCandidates.users).slice(0, 40),
      departments: filterByQ(mentionCandidates.departments).slice(0, 20),
      roles: filterByQ(mentionCandidates.roles).slice(0, 20),
    };
    const rows = [];
    const pushSection = (title, items) => {
      if (!items.length) return;
      if (rows.length > 0) rows.push({ kind: "divider", id: `div-${title}` });
      rows.push({ kind: "header", id: `hdr-${title}`, label: title });
      for (const item of items) rows.push({ kind: "item", id: item.id, item });
    };
    pushSection(tr("chat.mentionMembers", "Members"), filtered.users);
    pushSection(tr("chat.mentionDepartments", "Departments"), filtered.departments);
    pushSection(tr("chat.mentionRoles", "Roles"), filtered.roles);
    let idx = 0;
    const indexedRows = rows.map((row) => (row.kind === "item" ? { ...row, selectableIndex: idx++ } : row));
    if (!indexedRows.some((x) => x.kind === "item")) {
      setMentionMenu((prev) => ({ ...prev, open: false }));
      return;
    }
    setMentionMenu({ open: true, items: indexedRows, selected: 0, start: at, end: offset, query: token, textNode: node });
  }, [mentionCandidates, tr]);

  const applyMentionSelection = useCallback((item) => {
    const chosen = item?.item || item;
    if (!chosen || !composerInputRef.current) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = mentionMenu.textNode;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    
    const rangeStart = mentionMenu.start;
    const rangeEnd = mentionMenu.end;
    const fullText = textNode.textContent;
    
    const rangeObj = document.createRange();
    rangeObj.setStart(textNode, rangeStart);
    rangeObj.setEnd(textNode, rangeEnd);
    rangeObj.deleteContents();
    
    const markerRange = MENTION_CHAR_END - MENTION_CHAR_START + 1;
    const marker = String.fromCharCode(MENTION_CHAR_START + (mentionCharSeqRef.current % markerRange));
    mentionCharSeqRef.current += 1;
    
    setComposerMentionDrafts((prev) => ({
      ...prev,
      [marker]: {
        kind: chosen.kind,
        value: chosen.value,
        label: chosen.label,
        pad: 0,
      },
    }));
    
    const pill = document.createElement("span");
    pill.className = `chatInlineMention kind-${chosen.kind}`;
    pill.contentEditable = "false";
    pill.dataset.marker = marker;
    pill.innerText = `@${chosen.label}`;
    
    rangeObj.insertNode(pill);
    
    const afterSpace = document.createTextNode(" ");
    pill.after(afterSpace);
    
    const nextRange = document.createRange();
    nextRange.setStart(afterSpace, 1);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    
    syncComposerFromDOM();
    setMentionMenu((prev) => ({ ...prev, open: false }));
    composerInputRef.current?.focus();
  }, [mentionMenu.start, mentionMenu.end, mentionMenu.textNode, syncComposerFromDOM]);

  const insertTextWithMentions = useCallback((text) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    let last = 0;
    let m;
    const re = /<@([udr]):([^|>]+)\|([^>]+)>/g;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        fragment.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      const kind = m[1] === "u" ? "user" : m[1] === "d" ? "department" : "role";
      const value = m[2];
      const label = m[3];
      const markerRange = MENTION_CHAR_END - MENTION_CHAR_START + 1;
      const marker = String.fromCharCode(MENTION_CHAR_START + (mentionCharSeqRef.current % markerRange));
      mentionCharSeqRef.current += 1;
      setComposerMentionDrafts((prev) => ({
        ...prev,
        [marker]: { kind, value, label, pad: 0 },
      }));
      const pill = document.createElement("span");
      pill.className = `chatInlineMention kind-${kind}`;
      pill.contentEditable = "false";
      pill.dataset.marker = marker;
      pill.innerText = `@${label}`;
      fragment.appendChild(pill);
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(last)));
    }
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    syncComposerFromDOM();
  }, [syncComposerFromDOM]);

  const handleCopyCut = useCallback((e, isCut) => {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
    let wire = "";
    const walk = (parent) => {
      for (let i = 0; i < parent.childNodes.length; i += 1) {
        const child = parent.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          wire += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains("chatInlineMention")) {
            const marker = child.dataset.marker;
            const meta = composerMentionDrafts[marker];
            if (meta) {
              const k = meta.kind === "user" ? "u" : meta.kind === "department" ? "d" : "r";
              wire += `<@${k}:${meta.value}|${meta.label}>`;
            } else {
              wire += child.textContent;
            }
          } else if (child.nodeName === "BR") {
            wire += "\n";
          } else {
            walk(child);
          }
        }
      }
    };
    walk(container);
    e.clipboardData.setData("text/plain", wire);
    e.preventDefault();
    if (isCut) {
      range.deleteContents();
      syncComposerFromDOM();
    }
  }, [composerMentionDrafts, syncComposerFromDOM]);

  const handleCaretJump = useCallback(() => {
    // Browser handles it.
  }, []);

  const removeWholeMentionTokenIfNeeded = (event) => {
    if (event.key !== "Backspace" && event.key !== "Delete") return false;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    let markerNode = null;
    let removeFollowingSpace = false;

    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node;
      const offset = range.startOffset;
      if (event.key === "Backspace" && offset === 0 && textNode.previousSibling?.classList?.contains?.("chatInlineMention")) {
        markerNode = textNode.previousSibling;
        removeFollowingSpace = textNode.textContent?.startsWith(" ");
      } else if (event.key === "Delete" && offset === textNode.textContent.length && textNode.nextSibling?.classList?.contains?.("chatInlineMention")) {
        markerNode = textNode.nextSibling;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      if (event.key === "Backspace" && range.startOffset > 0) {
        const prev = el.childNodes[range.startOffset - 1];
        if (prev?.classList?.contains?.("chatInlineMention")) markerNode = prev;
      } else if (event.key === "Delete") {
        const next = el.childNodes[range.startOffset];
        if (next?.classList?.contains?.("chatInlineMention")) markerNode = next;
      }
    }

    if (!markerNode) return false;
    event.preventDefault();
    const marker = markerNode.dataset?.marker || "";
    const parent = markerNode.parentNode;
    const next = markerNode.nextSibling;
    markerNode.remove();
    if (removeFollowingSpace && next?.nodeType === Node.TEXT_NODE && next.textContent.startsWith(" ")) {
      next.textContent = next.textContent.slice(1);
    }
    setComposerMentionDrafts((prev) => {
      if (!marker || !prev?.[marker]) return prev;
      const out = { ...prev };
      delete out[marker];
      return out;
    });
    if (parent) {
      const r = document.createRange();
      r.selectNodeContents(parent);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    syncComposerFromDOM();
    return false;
  };

  const sendMessage = async () => {
    if (sending || !window.api?.wsSend || !activeConversationId) return;
    if (isGlobalChatLockedForMe) {
      notify?.warning?.(tr("chat.notify.globalLocked", "Global chat is locked. You do not have permission to send messages."), tr("chat.title", "Chat"));
      return;
    }
    const composerWire = normalizeDraftMentions(String(composer || ""), composerMentionDrafts);
    const text = String(composerWire || "").trim();
    if (!text && composerImages.length === 0) return;

    setSending(true);
    sendReqRef.current = rid();
    let imageUrls = [];
    if (!editingMessageId && composerImages.length > 0) {
      try {
        for (const img of composerImages) {
          if (img.filePath) {
            const uploaded = await window.api?.uploadChatImage?.(img.filePath);
            if (!uploaded?.ok || !uploaded?.imageUrl) {
              notify?.error?.(uploaded?.error || tr("chat.notify.imageUploadFailed", "Image upload failed."), tr("chat.title", "Chat"));
              setSending(false);
              return;
            }
            imageUrls.push(uploaded.imageUrl);
          } else if (img.dataUrl) {
            const buf = dataUrlToArrayBuffer(img.dataUrl);
            const uploaded = await window.api?.uploadChatImageFromBuffer?.({
              arrayBuffer: buf,
              fileName: img.fileName || "pasted-image.png",
            });
            if (!uploaded?.ok || !uploaded?.imageUrl) {
              notify?.error?.(uploaded?.error || tr("chat.notify.imageUploadFailed", "Image upload failed."), tr("chat.title", "Chat"));
              setSending(false);
              return;
            }
            imageUrls.push(uploaded.imageUrl);
          }
        }
      } catch {
        notify?.error?.(tr("chat.notify.imageUploadFailed", "Image upload failed."), tr("chat.title", "Chat"));
        setSending(false);
        return;
      }
    }
    if (editingMessageId) {
      window.api.wsSend({
        type: "chat:message:edit",
        requestId: sendReqRef.current,
        payload: { messageId: editingMessageId, text },
      });
      setEditingMessageId(null);
      setReplyingTo(null);
    } else {
      window.api.wsSend({
        type: "chat:message:send",
        requestId: sendReqRef.current,
        payload: { conversationId: activeConversationId, text, imageUrls, replyToMessageId: replyingTo?._id || null },
      });
      setReplyingTo(null);
    }
    setComposer("");
    setComposerMentionDrafts({});
    setMentionMenu((prev) => ({ ...prev, open: false }));
    setComposerImages([]);
    setEmojiOpen(false);
    // Stop typing indicator immediately after send.
    const convId = idStr(activeConversationId);
    if (composerTypingRef.current.stopTimer) clearTimeout(composerTypingRef.current.stopTimer);
    composerTypingRef.current.isTyping = false;
    sendTyping(convId, false);
  };

  const createPoll = useCallback(() => {
    if (!window.api?.wsSend || creatingPoll || !activeConversationId || !(activeIsGlobal || activeIsDepartment)) return;
    const title = String(pollTitle || "").trim();
    if (!title) {
      notify?.warning?.(tr("chat.notify.pollTitleRequired", "Poll title is required."), tr("chat.poll.title", "Poll"));
      return;
    }
    const answers = pollAnswers.map((answer) => String(answer || "").trim()).filter(Boolean);
    if (answers.length < 2) {
      notify?.warning?.(tr("chat.notify.pollNeedTwo", "Poll requires at least 2 answers."), tr("chat.poll.title", "Poll"));
      return;
    }
    const payload = {
      conversationId: activeConversationId,
      title,
      answers,
      durationPreset: pollDurationPreset,
    };
    if (pollDurationPreset === "custom") {
      const customMinutes = Number(pollCustomMinutes || 0);
      if (!Number.isFinite(customMinutes) || customMinutes <= 0) {
        notify?.warning?.(tr("chat.notify.pollCustomMinutesInvalid", "Custom duration must be a valid number of minutes."), tr("chat.poll.title", "Poll"));
        return;
      }
      payload.customMinutes = customMinutes;
    }
    setCreatingPoll(true);
    pollCreateReqRef.current = rid();
    if (pollCreateTimeoutRef.current) clearTimeout(pollCreateTimeoutRef.current);
    pollCreateTimeoutRef.current = setTimeout(() => {
      setCreatingPoll(false);
      notify?.error?.(tr("chat.notify.pollTimeout", "Poll request timed out. Please try again."), tr("chat.title", "Chat"));
    }, 12000);
    window.api.wsSend({ type: "chat:poll:create", requestId: pollCreateReqRef.current, payload });
  }, [activeConversationId, activeIsDepartment, activeIsGlobal, creatingPoll, notify, pollAnswers, pollCustomMinutes, pollDurationPreset, pollTitle]);

  const closePollComposer = useCallback(() => {
    if (creatingPoll) return;
    if (pollCreateTimeoutRef.current) {
      clearTimeout(pollCreateTimeoutRef.current);
      pollCreateTimeoutRef.current = null;
    }
    setPollComposerOpen(false);
  }, [creatingPoll]);

  const votePoll = useCallback((messageId, optionId, isClosed, clear = false) => {
    if (!window.api?.wsSend || !messageId || isClosed) return;
    if (!clear && !optionId) return;
    setVotingPollMessageId(idStr(messageId));
    pollVoteReqRef.current = rid();
    window.api.wsSend({
      type: "chat:poll:vote",
      requestId: pollVoteReqRef.current,
      payload: clear ? { messageId, clear: true } : { messageId, optionId },
    });
  }, []);

  const removeMessage = (messageId) => {
    if (removingMessageId || !window.api?.wsSend) return;
    setRemovingMessageId(messageId);
    removeReqRef.current = rid();
    window.api.wsSend({ type: "chat:message:remove", requestId: removeReqRef.current, payload: { messageId } });
  };

  const undoRemoveMessage = (messageId) => {
    if (!window.api?.wsSend) return;
    window.api.wsSend({ type: "chat:message:remove:undo", requestId: rid(), payload: { messageId } });
  };

  const toggleReaction = (messageId, emoji) => {
    if (!window.api?.wsSend || !messageId || !emoji) return;
    window.api.wsSend({
      type: "chat:message:react",
      requestId: rid(),
      payload: { messageId, emoji },
    });
  };

  const togglePinMessage = (messageId, pinned) => {
    if (!window.api?.wsSend || !messageId) return;
    window.api.wsSend({
      type: "chat:message:pin",
      requestId: rid(),
      payload: { messageId, pinned: !pinned },
    });
  };

  const openMessageContextMenu = (event, message, mine) => {
    if (!message || message.removed) return;
    event.preventDefault();
    const menuWidth = 250;
    const menuHeight = mine ? 340 : 240;
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - menuWidth - pad);
    const maxY = Math.max(pad, window.innerHeight - menuHeight - pad);
    let x = Math.max(pad, Math.min(event.clientX, maxX));
    let y = Math.max(pad, Math.min(event.clientY + 6, maxY));
    setMessageContextMenu({
      x,
      y,
      messageId: idStr(message._id),
      mine: !!mine,
      text: message.text || "",
      pinned: !!message.pinned,
      sender: message.sender || null,
    });
  };

  const copyToClipboard = useCallback(
    async (value, okText = tr("chat.notify.copied", "Copied.")) => {
      const text = String(value || "");
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        notify?.success?.(okText, tr("chat.title", "Chat"));
      } catch {
        notify?.error?.(tr("chat.notify.copyFailed", "Copy failed."), tr("chat.title", "Chat"));
      }
    },
    [notify]
  );

  const setMessageRef = useCallback((messageId, node) => {
    const key = idStr(messageId);
    if (!key) return;
    if (node) messageRefs.current.set(key, node);
    else messageRefs.current.delete(key);
  }, []);

  const jumpToReplyTarget = useCallback(
    (targetMessageId) => {
      const key = idStr(targetMessageId);
      if (!key) return;
      const node = messageRefs.current.get(key);
      if (!node) {
        notify?.warning?.(tr("chat.notify.replyTargetMissing", "Could not find the replied message in current loaded messages."), tr("chat.title", "Chat"));
        return;
      }
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(key);
      if (replyJumpTimerRef.current) clearTimeout(replyJumpTimerRef.current);
      replyJumpTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    },
    [notify]
  );

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

  const openHideConversationModal = useCallback((conversationId = activeConversationId) => {
    if (!conversationId || hidingConversation) return;
    setHideTargetConversationId(conversationId);
    setHideConversationModalOpen(true);
  }, [activeConversationId, hidingConversation]);

  const confirmHideConversation = useCallback(() => {
    if (!window.api?.wsSend || !hideTargetConversationId || hidingConversation) return;
    setHidingConversation(true);
    hideReqRef.current = rid();
    window.api.wsSend({
      type: "chat:conversation:hide",
      requestId: hideReqRef.current,
      payload: { conversationId: hideTargetConversationId },
    });
  }, [hideTargetConversationId, hidingConversation]);

  const archiveConversation = useCallback((conversationId, archived) => {
    if (!window.api?.wsSend || !conversationId || archivingConversation) return;
    setArchivingConversation(true);
    archiveReqRef.current = rid();
    window.api.wsSend({
      type: "chat:conversation:archive",
      requestId: archiveReqRef.current,
      payload: { conversationId, archived },
    });
    if (archived && idStr(activeConversationId) === idStr(conversationId)) {
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
    }
  }, [activeConversationId, archivingConversation]);

  const openConversationContextMenu = useCallback((event, conversation) => {
    if (!conversation || conversation.kind !== "direct" || conversation.archived) return;
    event.preventDefault();
    const menuWidth = 220;
    const menuHeight = 110;
    const pad = 8;
    let x = event.clientX;
    let y = event.clientY + 6;
    if (x + menuWidth > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - menuWidth - pad);
    if (y + menuHeight > window.innerHeight - pad) y = Math.max(pad, event.clientY - menuHeight - 6);
    setConversationContextMenu({ x, y, conversationId: idStr(conversation._id) });
  }, []);

  const addDepartmentExternalMember = useCallback((userId) => {
    if (!window.api?.wsSend || !activeConversationId || !activeIsDepartment || !canManageDepartmentMembers) return;
    const targetId = idStr(userId);
    if (!targetId || addingDepartmentMemberId) return;
    setAddingDepartmentMemberId(targetId);
    deptMemberAddReqRef.current = rid();
    window.api.wsSend({
      type: "chat:department:member:add",
      requestId: deptMemberAddReqRef.current,
      payload: { conversationId: activeConversationId, userId: targetId },
    });
  }, [activeConversationId, activeIsDepartment, canManageDepartmentMembers, addingDepartmentMemberId]);

  const removeDepartmentExternalMember = useCallback((userId) => {
    if (!window.api?.wsSend || !activeConversationId || !activeIsDepartment || !canManageDepartmentMembers) return;
    const targetId = idStr(userId);
    if (!targetId || removingDepartmentMemberId) return;
    setRemovingDepartmentMemberId(targetId);
    deptMemberRemoveReqRef.current = rid();
    window.api.wsSend({
      type: "chat:department:member:remove",
      requestId: deptMemberRemoveReqRef.current,
      payload: { conversationId: activeConversationId, userId: targetId },
    });
  }, [activeConversationId, activeIsDepartment, canManageDepartmentMembers, removingDepartmentMemberId]);

  return (
    <div className="chatPage chatPage--enter">
      <aside className="chatSidebar">
        <header className="chatSidebarHeader">
          <div className="chatSidebarTitleWrap">
            <MessageCircle size={18} />
            <div>
              <h1 className="chatSidebarTitle">{tr("chat.title", "Team Chat")}</h1>
              <p className="chatSidebarSubtitle">{tr("chat.sidebarSubtitle", "Realtime employee messaging")}</p>
            </div>
          </div>

          <div className="chatSidebarHeaderActions">
            <button
              type="button"
              className="chatActionBtn"
              onClick={() => openStartModal("direct")}
            >
              <UserRound size={16} />
              <span>{tr("chat.direct", "Direct")}</span>
            </button>
            <button
              type="button"
              className="chatActionBtn chatActionBtn--accent"
              onClick={() => openStartModal("group")}
            >
              <Plus size={16} />
              <span>{tr("chat.group", "Group")}</span>
            </button>
          </div>
        </header>

        <div className="chatSidebarSearch">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr("chat.searchConversation", "Search conversation")}
          />
        </div>

        <div className="chatSidebarTabs">
          <button
            type="button"
            className={`chatSidebarTabBtn ${archiveView ? "" : "is-active"}`}
            onClick={() => setArchiveView(false)}
          >
            <MessageCircle size={14} />
            <span>{tr("chat.chatsTab", "Chats")}</span>
          </button>
          <button
            type="button"
            className={`chatSidebarTabBtn ${archiveView ? "is-active" : ""}`}
            onClick={() => setArchiveView(true)}
          >
            <Archive size={14} />
            <span>{tr("chat.archiveTab", "Archive")}</span>
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={archiveView ? "archive" : "chats"}
            className="chatConversationList"
            initial={{ opacity: 0, x: archiveView ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: archiveView ? -10 : 10 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            {loadingConversationsUi && <div className="chatEmptyState">{tr("chat.loadingConversations", "Loading conversations...")}</div>}
            {!loadingConversationsUi && !filteredConversations.length && (
              <div className="chatEmptyState">
                <p>{tr("chat.noConversations", "No conversations yet.")}</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {!loadingConversationsUi && filteredConversations.map((conversation) => {
                const isDirect = conversation.kind === "direct";
                const isGlobal = conversation.kind === "global";
                const isDepartment = conversation.kind === "department";
                const title = conversation.title || tr("chat.conversationFallback", "Conversation");
                const preview = conversation.lastMessagePreview || tr("chat.startConversation", "Start the conversation");
                const isActive = idStr(conversation._id) === idStr(activeConversationId);
                const unread = Number(conversation.unreadCount || 0);

                return (
                  <motion.button
                    layout
                    type="button"
                    key={conversation._id}
                    className={`chatConversationItem ${isActive ? "is-active" : ""} ${isGlobal ? "is-global" : ""} ${isDepartment ? "is-department" : ""}`}
                    onClick={() => {
                      setEmojiOpen(false);
                      setPreferredConversationId(null);
                      setActiveConversationId(idStr(conversation._id));
                    }}
                    onContextMenu={(event) => openConversationContextMenu(event, conversation)}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div className="chatConversationAvatar">
                      <span className="chatAvatarInner" aria-hidden={isGlobal || isDepartment}>
                        {isGlobal ? (
                          <span className="chatGlobalAvatarIcon" aria-hidden>
                            <Megaphone size={16} />
                          </span>
                        ) : isDepartment ? (
                          <span className="chatGlobalAvatarIcon" aria-hidden>
                            <Hash size={16} />
                          </span>
                        ) : (
                          <img
                            src={avatarUrl(conversation.directPeer?.photoUrl)}
                            alt={title}
                            onError={handleAvatarError}
                            draggable={false}
                          />
                        )}
                      </span>
                      {isDirect && conversation.directPeer?.online && <i className="chatPresenceDot" aria-hidden />}
                    </div>

                    <div className="chatConversationBody">
                      <div className="chatConversationTop">
                        <span className="chatConversationName">
                          {isGlobal ? <Megaphone size={13} /> : isDepartment ? <Hash size={13} /> : isDirect ? <UserRound size={13} /> : <Hash size={13} />}
                          <span className="chatConversationNameText">{title}</span>
                        </span>
                        {!isGlobal && !isDepartment ? (
                          <span className="chatConversationTime">
                            {formatConversationTime(conversation.lastMessageAt || conversation.updatedAt, timeTick)}
                          </span>
                        ) : (
                          <span className="chatGlobalPill">
                            {isGlobal ? tr("chat.globalPill", "GLOBAL") : tr("chat.departmentPill", "DEPARTMENT")}
                          </span>
                        )}
                      </div>

                      <div className="chatConversationBottom">
                        <span className={`chatConversationPreview ${preview === tr("chat.removedMessage", "Removed Message") ? "is-removed" : ""}`}>
                          {preview}
                        </span>
                        <span className="chatConversationTail">
                          {archiveView && conversation.kind === "direct" && (
                            <button
                              type="button"
                              className="chatConversationRestoreBtn"
                              onClick={(event) => {
                                event.stopPropagation();
                                archiveConversation(idStr(conversation._id), false);
                              }}
                              disabled={archivingConversation}
                            >
                              <ArchiveRestore size={12} />
                              <span>{tr("chat.restore", "Restore")}</span>
                            </button>
                          )}
                          {unread > 0 && <span className="chatUnreadBadge">{unread > 99 ? "99+" : unread}</span>}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </aside>

      <section className="chatMain">
        {!activeConversationId && (
          <div className="chatMainEmpty">
            <MessageCircle size={34} />
            <h2>{tr("chat.selectConversation", "Select a conversation")}</h2>
            <p>{tr("chat.selectConversationHint", "Pick a chat from the left or create a new one.")}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeConversationId && (
            <motion.div
              key={activeConversationId}
              className={`chatMainConversation ${activeConversationSummary?.kind === "global" ? "is-global" : ""} ${activeConversationSummary?.kind === "department" ? "is-department" : ""}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
            <header className="chatMainHeader">
              <div className="chatMainHeaderLeft">
                {activeConversationSummary?.kind === "global" ? (
                  <Megaphone size={16} />
                ) : activeConversationSummary?.kind === "department" ? (
                  <Hash size={16} />
                ) : activeConversationSummary?.kind === "group" ? (
                  <Hash size={16} />
                ) : (
                  <UserRound size={16} />
                )}
                <div className="chatMainHeaderMeta">
                  <h2 className="chatMainTitle">{activeTitle}</h2>
                  <div className="chatMainSubRow">
                    <p className="chatMainSub">{activeSubtitle}</p>
                    {!loadingMessagesUi && activeTypingNames.length > 0 && (
                      <p className="chatMainTyping">
                        {activeTypingNames.length === 1
                          ? `${activeTypingNames[0]} ${tr("chat.typing", "is typing…")}`
                          : tr("chat.multipleTyping", "Typing…")}
                      </p>
                    )}
                    {activeIsDepartment && !loadingMessagesUi && (
                      <div className="chatDepartmentMemberStrip">
                        {activeAssociatedMembers.slice(0, 7).map((member) => (
                          <Tippy
                            key={`dep-strip-${idStr(member._id)}`}
                            content={member.name || tr("chat.employeeFallback", "Employee")}
                            animation="shift-away"
                            placement="top"
                            delay={[200, 0]}
                          >
                            <button
                              type="button"
                              className="chatDepartmentMemberStripBtn"
                              onClick={() => openUserProfile(member)}
                            >
                              <img
                                src={avatarUrl(member.photoUrl)}
                                alt={member.name || tr("chat.employeeFallback", "Employee")}
                                onError={handleAvatarError}
                                draggable={false}
                              />
                            </button>
                          </Tippy>
                        ))}
                        {activeAssociatedMembers.length > 7 && (
                          <span className="chatDepartmentMemberStripMore">+{activeAssociatedMembers.length - 7}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="chatMainHeaderRight">
                {activeIsDepartment && (
                  <div style={{ position: "relative" }}>
                    <Tippy content={tr("chat.departmentMembers", "Department Members")} animation="shift-away" placement="bottom" delay={[200, 0]}>
                      <button
                        type="button"
                        className={`chatIconBtn ${departmentMembersOpen ? "is-active" : ""}`}
                        onClick={() => setDepartmentMembersOpen((prev) => !prev)}
                      >
                        <Users size={18} />
                      </button>
                    </Tippy>
                    <AnimatePresence>
                      {departmentMembersOpen && (
                        <motion.div
                          ref={departmentMembersPopoverRef}
                          className="chatDepartmentMembersPopover"
                          initial={{ opacity: 0, scale: 0.94, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.94, y: -8 }}
                          transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                        >
                          <div className="chatDepartmentMembersHeader">
                            <strong>{tr("chat.departmentMembers", "Department Members")}</strong>
                            <span>{tr("chat.departmentAssociatedCount", "{{count}} associated").replace("{{count}}", String(activeAssociatedMembers.length))}</span>
                          </div>
                          <div className="chatDepartmentMembersList">
                            {activeAssociatedMembers.map((member) => {
                              const memberId = idStr(member._id);
                              const isExternal = !!member.departmentExternal;
                              const removingThis = removingDepartmentMemberId === memberId;
                              return (
                                <div className="chatDepartmentMemberRow" key={`dep-member-${memberId}`}>
                                  <img
                                    src={avatarUrl(member.photoUrl)}
                                    alt={member.name || tr("chat.employeeFallback", "Employee")}
                                    onError={handleAvatarError}
                                    draggable={false}
                                  />
                                  <div className="chatDepartmentMemberMeta">
                                    <div className="chatDepartmentMemberNameLine">
                                      <span>{member.name || tr("chat.employeeFallback", "Employee")}</span>
                                      {isExternal && <em>{tr("chat.externalMemberTag", "External")}</em>}
                                    </div>
                                    <div className="chatDepartmentMemberSub">
                                      {isExternal
                                        ? tr("chat.externalAddedAt", "Added {{time}}").replace("{{time}}", formatConversationTime(member.joinedAt || Date.now(), timeTick))
                                        : (member.jobTitle || member.workEmail || "")}
                                    </div>
                                  </div>
                                  {isExternal && canManageDepartmentMembers && (
                                    <button
                                      type="button"
                                      className="chatDepartmentMemberRemoveBtn"
                                      disabled={removingThis}
                                      onClick={() => removeDepartmentExternalMember(memberId)}
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {canManageDepartmentMembers && (
                            <div className="chatDepartmentMembersAdd">
                              <div className="chatSidebarSearch chatDepartmentMembersSearch">
                                <Search size={14} />
                                <input
                                  value={departmentMemberQuery}
                                  onChange={(e) => setDepartmentMemberQuery(e.target.value)}
                                  placeholder={tr("chat.searchEmployee", "Search employee")}
                                />
                              </div>
                              <div className="chatDepartmentMembersCandidates">
                                {departmentCandidateUsers.slice(0, 8).map((u) => {
                                  const uid = idStr(u._id);
                                  const addingThis = addingDepartmentMemberId === uid;
                                  return (
                                    <button
                                      key={`dep-candidate-${uid}`}
                                      type="button"
                                      className="chatDepartmentCandidateBtn"
                                      disabled={!!addingDepartmentMemberId}
                                      onClick={() => addDepartmentExternalMember(uid)}
                                    >
                                      <img src={avatarUrl(u.photoUrl)} alt={u.name || tr("chat.employeeFallback", "Employee")} onError={handleAvatarError} draggable={false} />
                                      <span>{u.name || tr("chat.employeeFallback", "Employee")}</span>
                                      <i>{addingThis ? tr("chat.adding", "Adding...") : tr("chat.addExternal", "Add External")}</i>
                                      <UserPlus size={14} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <Tippy content={tr("chat.pinnedMessages", "Pinned Messages")} animation="shift-away" placement="bottom" delay={[200, 0]}>
                    <button
                      ref={pinnedBtnRef}
                      type="button"
                      className={`chatPinBtn ${pinnedPopoverOpen ? "is-active" : ""}`}
                      onClick={() => setPinnedPopoverOpen((prev) => !prev)}
                      aria-label={tr("chat.pinnedMessages", "Pinned messages")}
                    >
                      <Pin size={18} />
                      {pinnedMessagesCount > 0 && (
                        <span className="chatPinBtnBadge">{pinnedMessagesCount > 99 ? "99+" : pinnedMessagesCount}</span>
                      )}
                    </button>
                  </Tippy>
                  <AnimatePresence>
                    {pinnedPopoverOpen && (
                      <motion.div
                        ref={pinnedPopoverRef}
                        className="chatPinnedPopover"
                        initial={{ opacity: 0, scale: 0.92, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -8 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="chatPinnedPopoverHeader">
                          <Pin size={18} />
                          <h3 className="chatPinnedPopoverTitle">{tr("chat.pinnedMessages", "Pinned Messages")}</h3>
                        </div>
                        {pinnedMessages.length > 0 ? (
                          <div className="chatPinnedPopoverBody">
                            {pinnedMessages.map((pm) => (
                              <button
                                key={pm._id}
                                type="button"
                                className="chatPinnedItem"
                                onClick={() => {
                                  setPinnedPopoverOpen(false);
                                  jumpToReplyTarget(pm._id);
                                }}
                              >
                                <div className="chatPinnedItemAvatar">
                                  <img
                                    src={avatarUrl(pm.sender?.photoUrl)}
                                    alt={pm.sender?.name || tr("chat.employeeFallback", "Employee")}
                                    onError={handleAvatarError}
                                    draggable={false}
                                  />
                                </div>
                                <div className="chatPinnedItemBody">
                                  <div className="chatPinnedItemMeta">
                                    <span className="chatPinnedItemSender">{pm.sender?.name || tr("chat.employeeFallback", "Employee")}</span>
                                    <span className="chatPinnedItemTime">{formatMessageDateTime(pm.createdAt, timeTick)}</span>
                                  </div>
                                  <p className="chatPinnedItemText">{pm.text}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="chatPinnedPopoverEmpty">
                            <div className="chatPinnedEmptyIcon">
                              <PinOff size={28} />
                            </div>
                            <p className="chatPinnedEmptyTitle">
                              {tr("chat.noPinnedMessages", "This conversation doesn't have any pinned messages... yet.")}
                            </p>
                            <p className="chatPinnedEmptyHint">
                              <strong>{tr("chat.protip", "PROTIP")}:</strong> {tr("chat.pinHint", "Users with the 'Pin Messages' permission can pin a message from its context menu.")}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {canLeaveActiveGroup && (
                  <button type="button" className="chatDangerBtn" onClick={openLeaveGroupModal} disabled={leavingGroup}>
                    <LogOut size={14} />
                    <span>{leavingGroup ? tr("chat.leaving", "Leaving...") : tr("chat.leaveGroup", "Leave group")}</span>
                  </button>
                )}
              </div>
            </header>

            <div className="chatMessagesViewport" ref={viewportRef}>
              {loadingMessagesUi && <div className="chatEmptyState">{tr("chat.loadingMessages", "Loading messages...")}</div>}
              {!loadingMessagesUi && !messages.length && (
                <div className="chatEmptyState chatEmptyState--noMessages">
                  <img src={getAssetUrl("assets/undraw/no_messages.png")} alt="" draggable={false} className="chatEmptyStateIllustration" />
                  <p>{tr("chat.noMessages", "No messages yet.")}</p>
                  <span>{tr("chat.noMessagesHint", "Say hello to start the conversation.")}</span>
                </div>
              )}

              {!loadingMessagesUi && messagesWithGrouping.map((message) => {
                const mine = idStr(message.sender?._id) === myUserId;
                const removed = !!message.removed;
                const animated = animatedMessageIds.has(idStr(message._id));
                const showHeader = message.showMessageHeader !== false;
                const member = conversationMembersById.get(idStr(message.sender?._id));
                const senderRole = message.sender?.jobTitle || member?.jobTitle || tr("chat.employeeFallback", "Employee");
                const replySenderId = idStr(message.replyTo?.sender?._id);
                const replyMember = conversationMembersById.get(replySenderId);
                const resolvedReplySenderPhoto =
                  message.replyTo?.sender?.photoUrl ||
                  replyMember?.photoUrl ||
                  (replySenderId && replySenderId === idStr(message.sender?._id) ? message.sender?.photoUrl : null);
                const pendingDeadline =
                  pendingRemoveByMessageId[idStr(message._id)] ||
                  (message.removeFinalizeAt ? new Date(message.removeFinalizeAt).getTime() : 0);
                const pendingSeconds = Math.max(0, Math.ceil((pendingDeadline - timeTick) / 1000));
                const myReactionSet = new Set(
                  (Array.isArray(message.reactions) ? message.reactions : [])
                    .filter((r) => Array.isArray(r.userIds) && r.userIds.includes(myUserId))
                    .map((r) => r.emoji)
                );
                const hasAccessories =
                  (!removed && Array.isArray(message.reactions) && message.reactions.length > 0) ||
                  (pendingSeconds > 0 && mine && !removed);
                const poll = message?.poll || null;
                const pollClosed = !!poll?.closedAt || (poll?.closesAt ? new Date(poll.closesAt).getTime() <= timeTick : false);
                const pollRemaining = pollClosed ? tr("chat.poll.closed", "Closed") : formatPollRemaining(poll?.closesAt, timeTick, tr("chat.poll.closed", "Closed"));
                const pollOptions = Array.isArray(poll?.options) ? poll.options : [];
                const pollTotalVotes = pollOptions.reduce((sum, option) => sum + Number(option?.votesCount || 0), 0);
                const selectedPollOption = pollOptions.find((option) => option?.votedByMe) || null;
                const hasAnimatingReaction = Array.from(animatedReactionKeys).some((key) =>
                  key.startsWith(`${idStr(message._id)}-`)
                );
                const hasReactionExitHold = reactionExitMessageIds.has(idStr(message._id));

                return (
                  <React.Fragment key={message._id}>
                    {message.showDayDivider && (
                      <div className="chatDayDivider">
                        <span>{message.dayLabel || tr("chat.today", "Today")}</span>
                      </div>
                    )}
                    <article
                      className={`chatMessageRow ${mine ? "is-mine" : "is-other"} ${animated ? "is-new" : ""} ${!showHeader ? "is-grouped" : "is-group-start"} ${hasAccessories ? "has-accessories" : ""} ${highlightedMessageId === idStr(message._id) ? "is-reply-highlighted" : ""}`}
                      data-message-id={idStr(message._id)}
                      onContextMenu={(event) => openMessageContextMenu(event, message, mine)}
                      ref={(node) => setMessageRef(message._id, node)}
                    >
                      {message.replyTo && (
                        <div className="chatMessageReplyRow">
                          <div className="chatMessageReplyLead" aria-hidden />
                          {message.replyTo?.missing ? (
                            <div className="chatMessageReplyRef chatMessageReplyRef--missing">
                              <span className="chatMessageReplyRefSender">{tr("chat.replyUnavailable", "Unavailable")}</span>
                              <span className="chatMessageReplyRefText">{message.replyTo?.text || tr("chat.messageFallback", "Message")}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="chatMessageReplyRef"
                              onClick={() => jumpToReplyTarget(message.replyTo?._id)}
                            >
                              <span className="chatMessageReplyAvatar" aria-hidden>
                                <img
                                  src={avatarUrl(resolvedReplySenderPhoto)}
                                  alt=""
                                  onError={handleAvatarError}
                                  draggable={false}
                                />
                              </span>
                              <span className="chatMessageReplyRefSender">{message.replyTo?.sender?.name || tr("chat.employeeFallback", "Employee")}</span>
                              <span className="chatMessageReplyRefText">{message.replyTo?.text || tr("chat.messageFallback", "Message")}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div className="chatMessageMainRow">
                        <div className="chatMessageAvatarWrap">
                          {showHeader ? (
                            <Tippy content={tr("chat.openProfile", "Open profile")} animation="shift-away" placement="top" delay={[200, 0]}>
                              <button
                                type="button"
                                className="chatMessageAvatar chatMessageAvatarBtn"
                                onClick={() => openUserProfile(message.sender)}
                              >
                                <img
                                  src={avatarUrl(message.sender?.photoUrl)}
                                  alt={message.sender?.name || tr("chat.employeeFallback", "Employee")}
                                  onError={handleAvatarError}
                                />
                              </button>
                            </Tippy>
                          ) : (
                            <div className="chatMessageAvatar chatMessageAvatar--spacer" aria-hidden />
                          )}
                        </div>

                        <div className="chatMessageBody">
                          {showHeader && (
                            <div className="chatMessageMetaTop">
                              <Tippy content={tr("chat.openProfile", "Open profile")} animation="shift-away" placement="top" delay={[200, 0]}>
                                <button type="button" className="chatMessageSender chatMessageSenderBtn" onClick={() => openUserProfile(message.sender)}>
                                  {message.sender?.name || tr("chat.employeeFallback", "Employee")}
                                </button>
                              </Tippy>
                              <span className="chatMessageRole">{senderRole}</span>
                              <time className="chatMessageTime">{formatMessageDateTime(message.createdAt, timeTick)}</time>
                              {message.pinned && (
                                <span className="chatMessagePinnedTag">
                                  <Pin size={12} />
                                  <span>{tr("chat.pinned", "Pinned")}</span>
                                </span>
                              )}
                            </div>
                          )}
                          <div className="chatMessageContents">
                            <div className={`chatMessageBubble ${removed ? "is-removed" : ""}`}>
                              {!showHeader && (
                                <time className="chatMessageInlineTime">{formatTimeOnly(message.createdAt)}</time>
                              )}
                              {!showHeader && message.pinned && !removed && (
                                <span className="chatMessagePinnedInlineTag">
                                  <Pin size={11} />
                                  <span>{tr("chat.pinned", "Pinned")}</span>
                                </span>
                              )}
                              {removed ? (
                                <Tippy
                                  content={
                                    message.removedAt
                                      ? tr("chat.removedAtTooltip", "Removed at {{time}}").replace(
                                          "{{time}}",
                                          formatMessageDateTime(message.removedAt, timeTick)
                                        )
                                      : tr("chat.removedMessageLabel", "Removed message")
                                  }
                                  animation="shift-away"
                                  placement="top"
                                  delay={[200, 0]}
                                >
                                  <span className="chatMessageRemovedLabel">{tr("chat.removedMessageLabel", "Removed message")}</span>
                                </Tippy>
                              ) : (
                                <>
                                  {poll ? (
                                    <div className="chatPollCard">
                                      <div className="chatPollHead">
                                        <BarChart3 size={14} />
                                        <span>{tr("chat.poll.title", "Poll")}</span>
                                        <span className={`chatPollTimer ${pollClosed ? "is-closed" : ""}`}>{pollRemaining}</span>
                                      </div>
                                      <div className="chatPollTitle">{poll.title || tr("chat.poll.title", "Poll")}</div>
                                      <div className="chatPollPrompt">{tr("chat.poll.selectOne", "Select one answer")}</div>
                                      <div className="chatPollOptions">
                                        {pollOptions.map((option) => {
                                          const count = Number(option?.votesCount || 0);
                                          const ratio = pollTotalVotes > 0 ? (count / pollTotalVotes) * 100 : 0;
                                          const percentLabel = `${Math.round(ratio)}%`;
                                          return (
                                          <button
                                            key={`${idStr(message._id)}-${option.id}`}
                                            type="button"
                                            className={`chatPollOptionBtn ${option.votedByMe ? "is-voted" : ""}`}
                                            onClick={() => votePoll(idStr(message._id), option.id, pollClosed)}
                                            disabled={pollClosed || option.votedByMe || votingPollMessageId === idStr(message._id)}
                                          >
                                            <span
                                              className="chatPollOptionFill"
                                              style={{ "--poll-fill": String(Math.max(0, Math.min(100, ratio)) / 100) }}
                                            />
                                            <span className="chatPollOptionText">{option.text}</span>
                                            <span className="chatPollOptionStats">
                                              <span className="chatPollOptionVotes">
                                                {tr(count === 1 ? "chat.voteSingle" : "chat.votePlural", count === 1 ? "{{count}} vote" : "{{count}} votes").replace("{{count}}", String(count))}
                                              </span>
                                              <span className="chatPollOptionPercent">{percentLabel}</span>
                                              {option.votedByMe && (
                                                <span className="chatPollOptionCheck">
                                                  <Check size={13} />
                                                </span>
                                              )}
                                            </span>
                                          </button>
                                          );
                                        })}
                                      </div>
                                      <div className="chatPollFooter">
                                        <div className="chatPollFooterMeta">
                                          <span>
                                            {tr(pollTotalVotes === 1 ? "chat.voteSingle" : "chat.votePlural", pollTotalVotes === 1 ? "{{count}} vote" : "{{count}} votes").replace("{{count}}", String(pollTotalVotes))}
                                          </span>
                                          <span aria-hidden>•</span>
                                          <span>{pollRemaining}</span>
                                        </div>
                                        {!pollClosed && selectedPollOption && (
                                          <button
                                            type="button"
                                            className="chatPollRemoveVoteBtn"
                                            onClick={() => votePoll(idStr(message._id), null, pollClosed, true)}
                                            disabled={votingPollMessageId === idStr(message._id)}
                                          >
                                            {tr("chat.poll.removeVote", "Remove Vote")}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {(() => {
                                        const images = Array.isArray(message.imageUrls) && message.imageUrls.length > 0
                                          ? message.imageUrls
                                          : (message.imageUrl ? [message.imageUrl] : []);
                                        if (!images.length) return null;
                                        return (
                                          <div className={`chatMessageImagesGrid is-${Math.min(images.length, 4)}`}>
                                            {images.map((imgUrl, idx) => (
                                              <button
                                                key={`${idStr(message._id)}-img-${idx}`}
                                                type="button"
                                                className="chatMessageImageWrap"
                                                onClick={() =>
                                                  openImageViewer(imgUrl, {
                                                    urls: images,
                                                    index: idx,
                                                    name: `chat-${idStr(message._id)}-${idx + 1}`,
                                                    authorName: message?.sender?.name || tr("chat.employeeFallback", "Employee"),
                                                    authorPhoto: message?.sender?.photoUrl || null,
                                                    createdAt: message?.createdAt || null,
                                                  })
                                                }
                                              >
                                                <img className="chatMessageImage" src={imgUrl} alt={tr("chat.sentImage", "Sent image")} />
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                      {!!(message.rawText || message.text) && (
                                        <p className="chatMessageText">
                                          {(() => {
                                            const parts = renderTextWithMentions(message.rawText, message.text);
                                            if (typeof parts === "string") return parts;
                                            return parts.map((part, idx) =>
                                              part.type === "mention" ? (
                                                <span key={`m-${idStr(message._id)}-${idx}`} className={`chatInlineMention kind-${part.kind}`}>
                                                  {part.value}
                                                </span>
                                              ) : (
                                                <React.Fragment key={`t-${idStr(message._id)}-${idx}`}>{part.value}</React.Fragment>
                                              )
                                            );
                                          })()}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {(message.edited || message.editedAt) && (
                                    <Tippy
                                      content={tr("chat.editedAtTooltip", "Edited at {{time}}").replace(
                                        "{{time}}",
                                        formatMessageDateTime(message.editedAt || message.updatedAt, timeTick)
                                      )}
                                      animation="shift-away"
                                      placement="top"
                                      delay={[200, 0]}
                                    >
                                      <span className="chatMessageEditedMark">({tr("chat.edited", "edited")})</span>
                                    </Tippy>
                                  )}
                                </>
                              )}
                            </div>
                            {mine &&
                              !removed &&
                              myLastMessageSeen &&
                              idStr(message._id) === idStr(messages[messages.length - 1]?._id) && (
                              <div className="chatMessageSeen">{tr("chat.seen", "Seen")}</div>
                            )}
                          </div>
                          {((!removed && (hasReactionExitHold || hasAnimatingReaction || (Array.isArray(message.reactions) && message.reactions.length > 0))) || (pendingSeconds > 0 && mine && !removed)) && (
                            <div className="chatMessageAccessories">
                              {!removed && Array.isArray(message.reactions) && message.reactions.length > 0 && (
                                <div className="chatMessageReactions">
                                  <AnimatePresence initial={false}>
                                  {message.reactions.map((reaction) => {
                                    const reactionKey = `${idStr(message._id)}-${reaction.emoji}`;
                                    return (
                                    <motion.button
                                      key={`${idStr(message._id)}-${reaction.emoji}`}
                                      type="button"
                                      className={`chatReactionBtn ${myReactionSet.has(reaction.emoji) ? "is-active" : ""} ${animatedReactionKeys.has(reactionKey) ? "is-bump" : ""}`}
                                      onClick={() => toggleReaction(idStr(message._id), reaction.emoji)}
                                      initial={{ opacity: 0, y: 6, scale: 0.85 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -6, scale: 0.8 }}
                                      transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span>{reaction.count || 0}</span>
                                    </motion.button>
                                  );
                                  })}
                                  </AnimatePresence>
                                  <Tippy content={tr("chat.addReaction", "Add reaction")} animation="shift-away" placement="top" delay={[200, 0]}>
                                    <button
                                      type="button"
                                      className={`chatIconBtn chatReactionAddBtn ${reactionEmojiTarget === idStr(message._id) ? "is-active" : ""}`}
                                      ref={(node) => { if (node) reactionEmojiBtnRefs.current.set(idStr(message._id), node); }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReactionEmojiTarget((prev) => prev === idStr(message._id) ? null : idStr(message._id));
                                      }}
                                    >
                                      <Smile size={16} />
                                    </button>
                                  </Tippy>
                                  {reactionEmojiTarget === idStr(message._id) && (() => {
                                    const btnNode = reactionEmojiBtnRefs.current.get(idStr(message._id));
                                    const panelH = 340;
                                    const panelW = 320;
                                    const pad = 8;
                                    let style = { position: "fixed", zIndex: 50 };
                                    if (btnNode) {
                                      const rect = btnNode.getBoundingClientRect();
                                      const spaceBelow = window.innerHeight - rect.bottom;
                                      if (spaceBelow >= panelH + pad) {
                                        style.top = rect.bottom + 4;
                                      } else {
                                        style.top = rect.top - panelH - 4;
                                      }
                                      style.left = Math.min(rect.left, window.innerWidth - panelW - pad);
                                    }
                                    return (
                                      <div ref={reactionEmojiPanelRef} className="chatEmojiPanel chatReactionEmojiPanel" style={style}>
                                        <EmojiPicker
                                          theme={isLightTheme ? "light" : "dark"}
                                          width={320}
                                          height={340}
                                          lazyLoadEmojis
                                          searchDisabled
                                          skinTonesDisabled
                                          previewConfig={{ showPreview: false }}
                                          onEmojiClick={(emojiData) => {
                                            const emoji = emojiData?.emoji || "";
                                            if (!emoji) return;
                                            toggleReaction(idStr(message._id), emoji);
                                            setReactionEmojiTarget(null);
                                          }}
                                        />
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              {pendingSeconds > 0 && mine && !removed && (
                                <div className="chatUndoRemoveRow">
                                  <span>{tr("chat.removingInSeconds", "Removing in {{seconds}}s").replace("{{seconds}}", String(pendingSeconds))}</span>
                                  <button type="button" onClick={() => undoRemoveMessage(idStr(message._id))}>{tr("chat.undo", "Undo")}</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </React.Fragment>
                );
              })}
            </div>

            <footer className="chatComposerWrap">
              {(replyingTo || editingMessageId) && (
                <div className="chatComposerContextBar">
                  {replyingTo && !editingMessageId && (
                    <div className="chatComposerContextText">
                      {tr("chat.replyingTo", "Replying to")} {idStr(replyingTo?.sender?._id) === myUserId ? tr("chat.you", "You") : (replyingTo?.sender?.name || tr("chat.employeeFallback", "Employee"))}: {String(replyingTo?.text || "").slice(0, 80)}
                    </div>
                  )}
                  {editingMessageId && <div className="chatComposerContextText">{tr("chat.editingMessage", "Editing message")}</div>}
                  <button
                    type="button"
                    className="chatComposerContextClose"
                    onClick={() => {
                      setReplyingTo(null);
                      setEditingMessageId(null);
                      setComposer("");
                      setComposerMentionDrafts({});
                      setComposerImages([]);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="chatComposer">
                <button
                  type="button"
                  className="chatIconBtn"
                  onClick={pickComposerImage}
                  aria-label={tr("chat.attachImage", "Attach image")}
                  disabled={isGlobalChatLockedForMe || !!editingMessageId}
                >
                  <Paperclip size={17} />
                </button>
                {canCreatePollInActiveChat && (
                  <button
                    type="button"
                    className={`chatIconBtn ${pollComposerOpen ? "is-active" : ""}`}
                    onClick={() => setPollComposerOpen((prev) => !prev)}
                    disabled={isGlobalChatLockedForMe || creatingPoll}
                  >
                    <ListFilter size={16} />
                  </button>
                )}
                <button
                  ref={emojiBtnRef}
                  type="button"
                  className={`chatIconBtn ${emojiOpen ? "is-active" : ""}`}
                  onClick={() => setEmojiOpen((prev) => !prev)}
                  aria-label={tr("chat.toggleEmojiPicker", "Toggle emoji picker")}
                >
                  <Smile size={18} />
                </button>

                <div className="chatComposerInputWrap">
                  <div
                    ref={composerInputRef}
                    className="chatComposerInput"
                    contentEditable={!isGlobalChatLockedForMe}
                    onInput={() => {
                      syncComposerFromDOM();
                      updateMentionMenuFromDOM();
                      
                      const convId = idStr(activeConversationId);
                      if (!convId) return;
                      const now = Date.now();
                      if (!composerTypingRef.current.isTyping || now - composerTypingRef.current.lastSentAt > 900) {
                        composerTypingRef.current.isTyping = true;
                        composerTypingRef.current.lastSentAt = now;
                        sendTyping(convId, true);
                      }
                      if (composerTypingRef.current.stopTimer) clearTimeout(composerTypingRef.current.stopTimer);
                      composerTypingRef.current.stopTimer = setTimeout(() => {
                        composerTypingRef.current.isTyping = false;
                        sendTyping(convId, false);
                      }, 1400);
                    }}
                    onKeyDown={(e) => {
                      const selectableRows = mentionMenu.items.filter((x) => x.kind === "item");
                      if (mentionMenu.open && selectableRows.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionMenu((prev) => ({ ...prev, selected: (prev.selected + 1) % selectableRows.length }));
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionMenu((prev) => ({ ...prev, selected: (prev.selected - 1 + selectableRows.length) % selectableRows.length }));
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          applyMentionSelection(selectableRows[mentionMenu.selected]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setMentionMenu((prev) => ({ ...prev, open: false }));
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    onPaste={(e) => {
                      const file = e.clipboardData?.files?.[0] || null;
                      if (file && String(file.type || "").startsWith("image/")) {
                        e.preventDefault();
                        setComposerImageFromFile(file);
                        return;
                      }
                      e.preventDefault();
                      const text = e.clipboardData.getData("text/plain");
                      insertTextWithMentions(text);
                    }}
                    onCopy={(e) => handleCopyCut(e, false)}
                    onCut={(e) => handleCopyCut(e, true)}
                    onClick={() => updateMentionMenuFromDOM()}
                    onKeyUp={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                        updateMentionMenuFromDOM();
                      }
                    }}
                    data-placeholder={isGlobalChatLockedForMe ? tr("chat.globalLockedForRole", "Global chat is locked for your role") : tr("chat.writeMessage", "Write a message...")}
                  />
                </div>
                {mentionMenu.open && (
                  <div ref={mentionMenuRef} className="chatMentionMenu">
                    {mentionMenu.items.map((row) => {
                      if (row.kind === "divider") return <div key={row.id} className="chatMentionDivider" />;
                      if (row.kind === "header") return <div key={row.id} className="chatMentionHeader">{row.label}</div>;
                      const item = row.item;
                      const active = row.selectableIndex === mentionMenu.selected;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className={`chatMentionItem ${active ? "is-active" : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyMentionSelection(row)}
                        >
                          {item.kind === "user" ? (
                            <img
                              className="chatMentionAvatar"
                              src={avatarUrl(item.photoUrl)}
                              alt={item.label}
                              onError={handleAvatarError}
                              draggable={false}
                            />
                          ) : (
                            <span className={`chatMentionKind kind-${item.kind}`}>
                              {item.kind === "department" ? "#" : "&"}
                            </span>
                          )}
                          <span className="chatMentionMain">
                            <span className="chatMentionLabel">{item.label}</span>
                            {!!item.sub && <span className="chatMentionSub">{item.sub}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="chatSendBtn"
                  onClick={sendMessage}
                  disabled={isGlobalChatLockedForMe || sending || (!String(composer || "").trim() && composerImages.length === 0)}
                >
                  {editingMessageId ? <Check size={15} /> : <Send size={15} />}
                  <span>{sending ? tr("chat.sending", "Sending...") : editingMessageId ? tr("common.save", "Save") : tr("chat.send", "Send")}</span>
                </button>
              </div>
              {composerImages.length > 0 && (
                <div className="chatComposerImagesGrid">
                  {composerImages.map((img) => (
                    <div key={img.id} className="chatComposerImagePreview">
                      <button
                        type="button"
                        className="chatComposerImageOpen"
                        onClick={() =>
                          openImageViewer(img.dataUrl, {
                            urls: composerImages.map((x) => x.dataUrl),
                            index: composerImages.findIndex((x) => x.id === img.id),
                            name: img.fileName || "preview-image",
                            authorName: tr("chat.you", "You"),
                            authorPhoto: account?.photoUrl || account?.uploads?.employeePhotoUrl || null,
                            createdAt: new Date().toISOString(),
                          })
                        }
                      >
                        <img src={img.dataUrl} alt={tr("chat.imagePreview", "Image preview")} />
                      </button>
                      <button
                        type="button"
                        className="chatComposerImageRemove"
                        onClick={() => setComposerImages((prev) => prev.filter((x) => x.id !== img.id))}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isGlobalChatLockedForMe && (
                <div className="chatComposerLockNotice">
                  {tr("chat.globalLockedNotice", "Global chat is currently locked. Contact an admin if you need send access.")}
                </div>
              )}
              {emojiOpen && (
                <div ref={emojiPanelRef} className="chatEmojiPanel">
                  <EmojiPicker
                    theme={isLightTheme ? "light" : "dark"}
                    width={360}
                    height={380}
                    lazyLoadEmojis
                    searchDisabled
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                    onEmojiClick={(emojiData) => {
                      const nextEmoji = emojiData?.emoji || "";
                      if (!nextEmoji) return;
                      composerInputRef.current?.focus();
                      insertTextWithMentions(nextEmoji);
                    }}
                  />
                </div>
              )}
            </footer>
            <AnimatePresence>
              {imageViewer && (
                <motion.div
                  className="chatImageViewerBackdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  onClick={closeImageViewer}
                >
                  <motion.div
                    className="chatImageViewerCard"
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 6 }}
                    transition={{ type: "spring", stiffness: 450, damping: 38 }}
                    onClick={closeImageViewer}
                  >
                    <div className="chatImageViewerTop" onClick={(event) => event.stopPropagation()}>
                      <div className="chatImageViewerMeta">
                        <img
                          className="chatImageViewerAvatar"
                          src={avatarUrl(imageViewer.authorPhoto)}
                          alt={imageViewer.authorName || tr("chat.employeeFallback", "Employee")}
                          onError={handleAvatarError}
                          draggable={false}
                        />
                        <div className="chatImageViewerMetaText">
                          <div className="chatImageViewerAuthor">{imageViewer.authorName || tr("chat.employeeFallback", "Employee")}</div>
                          <div className="chatImageViewerTime">
                            {imageViewer.createdAt ? formatMessageDateTime(imageViewer.createdAt, timeTick) : tr("chat.imagePreview", "Image preview")}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="chatImageViewerClose"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeImageViewer();
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="chatImageViewerMedia" onClick={closeImageViewer}>
                      {(() => {
                        const urls = Array.isArray(imageViewer?.urls) && imageViewer.urls.length > 0 ? imageViewer.urls : [imageViewer?.url].filter(Boolean);
                        const idx = Math.max(0, Math.min(Number(imageViewer?.index || 0), Math.max(0, urls.length - 1)));
                        const atStart = idx <= 0;
                        const atEnd = idx >= urls.length - 1;
                        return (
                          <>
                            <button
                              type="button"
                              className={`chatImageViewerArrow is-left ${atStart ? "is-disabled" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                stepImageViewer(-1);
                              }}
                              disabled={atStart}
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <AnimatePresence initial={false}>
                              <motion.img
                                key={imageViewerCurrentUrl}
                                className="chatImageViewerImage"
                                 src={imageViewerCurrentUrl}
                                 alt={tr("chat.imagePreview", "Image preview")}
                                 initial={{ opacity: 0, scale: 0.98 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 exit={{ opacity: 0, scale: 0.98 }}
                                 transition={{ duration: 0.14, ease: "easeOut" }}
                                 onClick={(event) => event.stopPropagation()}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  const pad = 8;
                                  const menuW = 188;
                                  const menuH = 88;
                                  const maxX = Math.max(pad, window.innerWidth - menuW - pad);
                                  const maxY = Math.max(pad, window.innerHeight - menuH - pad);
                                  setImageViewerContextMenu({
                                    x: Math.max(pad, Math.min(event.clientX, maxX)),
                                    y: Math.max(pad, Math.min(event.clientY, maxY)),
                                  });
                                }}
                              />
                            </AnimatePresence>
                            <button
                              type="button"
                              className={`chatImageViewerArrow is-right ${atEnd ? "is-disabled" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                stepImageViewer(1);
                              }}
                              disabled={atEnd}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                  <AnimatePresence>
                    {imageViewerContextMenu && (
                      <motion.div
                        className="chatMessageContextMenu chatConversationContextMenu chatImageContextMenu"
                        style={{ left: imageViewerContextMenu.x, top: imageViewerContextMenu.y }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="chatMessageContextItem"
                          onClick={() => {
                            copyImageFromUrl(imageViewerCurrentUrl);
                            setImageViewerContextMenu(null);
                          }}
                        >
                          <Copy size={14} />
                          <span>{tr("chat.copyImage", "Copy Image")}</span>
                        </button>
                        <button
                          type="button"
                          className="chatMessageContextItem"
                          onClick={() => {
                            saveImageFromUrl(imageViewerCurrentUrl, imageViewer.name);
                            setImageViewerContextMenu(null);
                          }}
                        >
                          <Download size={14} />
                          <span>{tr("chat.saveImage", "Save Image")}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {pollComposerOpen && canCreatePollInActiveChat && (
                <motion.div
                  className="chatPollModalBackdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  onClick={closePollComposer}
                >
                  <motion.div
                    className="chatPollModal"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.7 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <motion.div
                      className="chatPollModalHead"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.02, duration: 0.18 }}
                    >
                      <h3>{tr("chat.poll.createTitle", "Create a Poll")}</h3>
                      <button type="button" onClick={closePollComposer}>
                        <X size={16} />
                      </button>
                    </motion.div>
                    <motion.div
                      className="chatPollModalBody"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04, duration: 0.2 }}
                    >
                      <motion.div layout className="chatPollField">
                        <label>{tr("chat.poll.question", "Question")}</label>
                        <input
                          className="chatPollInput"
                          value={pollTitle}
                          onChange={(event) => setPollTitle(event.target.value.slice(0, 300))}
                          placeholder={tr("chat.poll.questionPlaceholder", "What question do you want to ask?")}
                        />
                        <span className="chatPollFieldHint">{String(pollTitle || "").length} / 300</span>
                      </motion.div>
                      <div className="chatPollField">
                        <label>{tr("chat.poll.answers", "Answers")}</label>
                        <div className="chatPollAnswers">
                          {pollAnswers.map((answer, idx) => (
                            <div className="chatPollAnswerRow" key={`poll-answer-${idx}`}>
                              <input
                                className="chatPollInput"
                                value={answer}
                                onChange={(event) =>
                                  setPollAnswers((prev) => prev.map((item, itemIdx) => (itemIdx === idx ? event.target.value : item)))
                                }
                                placeholder={tr("chat.poll.answerPlaceholder", "Type your answer")}
                              />
                              <button
                                type="button"
                                className="chatPollAnswerRemoveBtn"
                                disabled={pollAnswers.length <= 2}
                                onClick={() =>
                                  setPollAnswers((prev) => (prev.length <= 2 ? prev : prev.filter((_, itemIdx) => itemIdx !== idx)))
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="chatPollAddAnswerBtn"
                          onClick={() => setPollAnswers((prev) => (prev.length >= 10 ? prev : [...prev, ""]))}
                          disabled={pollAnswers.length >= 10}
                        >
                          <Plus size={14} />
                          <span>{tr("chat.poll.addAnswer", "Add another answer")}</span>
                        </button>
                      </div>
                      <div className="chatPollField">
                        <label>{tr("chat.poll.duration", "Duration")}</label>
                        <div className="chatPollDurationRow">
                          {[
                            { id: "30m", label: tr("chat.poll.duration30m", "30 mins") },
                            { id: "1h", label: tr("chat.poll.duration1h", "1 hour") },
                            { id: "4h", label: tr("chat.poll.duration4h", "4 hours") },
                            { id: "custom", label: tr("chat.poll.durationCustom", "Custom") },
                          ].map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`chatPollDurationBtn ${pollDurationPreset === option.id ? "is-active" : ""}`}
                              onClick={() => setPollDurationPreset(option.id)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {pollDurationPreset === "custom" && (
                          <input
                            className="chatPollInput"
                            value={pollCustomMinutes}
                            onChange={(event) => setPollCustomMinutes(event.target.value.replace(/[^\d]/g, ""))}
                            placeholder={tr("chat.poll.customDurationPlaceholder", "Custom duration in minutes")}
                          />
                        )}
                      </div>
                    </motion.div>
                    <motion.div
                      className="chatPollModalFooter"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06, duration: 0.2 }}
                    >
                      <button
                        type="button"
                        className="chatSendBtn"
                        onClick={createPoll}
                        disabled={creatingPoll}
                      >
                        <span>{creatingPoll ? tr("chat.creating", "Creating...") : tr("chat.post", "Post")}</span>
                      </button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {conversationContextMenu && (
                <motion.div
                  className="chatMessageContextMenu chatConversationContextMenu"
                  style={{ left: conversationContextMenu.x, top: conversationContextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -6 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                >
                  <button
                    type="button"
                    className="chatMessageContextItem"
                    onClick={() => {
                      setConversationContextMenu(null);
                      openHideConversationModal(conversationContextMenu.conversationId);
                    }}
                  >
                    <Trash2 size={14} />
                    <span>{tr("chat.removeChat", "Remove Chat")}</span>
                  </button>
                  <button
                    type="button"
                    className="chatMessageContextItem"
                    onClick={() => {
                      archiveConversation(conversationContextMenu.conversationId, true);
                      setConversationContextMenu(null);
                    }}
                  >
                    <Archive size={14} />
                    <span>{tr("chat.archiveChat", "Archive Chat")}</span>
                  </button>
                </motion.div>
              )}
              {messageContextMenu && (
                <motion.div
                  className="chatMessageContextMenu"
                  style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -6 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="chatMessageContextReactions">
                    {["👍", "❤️", "😂", "🔥", "😮", "😢"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="chatMessageContextEmoji"
                        onClick={() => {
                          toggleReaction(messageContextMenu.messageId, emoji);
                          setMessageContextMenu(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="chatMessageContextSeparator" />
                  <button
                    type="button"
                    className="chatMessageContextItem"
                    onClick={() => {
                      const target = messages.find((m) => idStr(m._id) === messageContextMenu.messageId);
                      if (target) setReplyingTo(target);
                      setEditingMessageId(null);
                      setMessageContextMenu(null);
                    }}
                  >
                    <Reply size={14} />
                    <span>{tr("chat.reply", "Reply")}</span>
                  </button>
                  {messageContextMenu.mine && (
                    <button
                      type="button"
                      className="chatMessageContextItem"
                      onClick={() => {
                        setEditingMessageId(messageContextMenu.messageId);
                        setReplyingTo(null);
                        setComposer(messageContextMenu.text || "");
                        setMessageContextMenu(null);
                      }}
                    >
                      <Pencil size={14} />
                      <span>{tr("common.edit", "Edit")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="chatMessageContextItem"
                    onClick={() => {
                      togglePinMessage(messageContextMenu.messageId, messageContextMenu.pinned);
                      setMessageContextMenu(null);
                    }}
                  >
                    <Pin size={14} />
                    <span>{messageContextMenu.pinned ? tr("chat.unpinMessage", "Unpin message") : tr("chat.pinMessage", "Pin message")}</span>
                  </button>
                  <div className="chatMessageContextSeparator" />
                  <button
                    type="button"
                    className="chatMessageContextItem"
                    onClick={() => {
                      copyToClipboard(messageContextMenu.text, tr("chat.notify.messageCopied", "Message copied."));
                      setMessageContextMenu(null);
                    }}
                  >
                    <Copy size={14} />
                    <span>{tr("chat.copyText", "Copy text")}</span>
                  </button>
                  {messageContextMenu.mine && (
                    <>
                    <div className="chatMessageContextSeparator" />
                    <button
                      type="button"
                      className="chatMessageContextItem is-danger"
                      onClick={() => {
                        removeMessage(messageContextMenu.messageId);
                        setMessageContextMenu(null);
                      }}
                    >
                      <Trash2 size={14} />
                      <span>{removingMessageId === messageContextMenu.messageId ? tr("chat.removing", "Removing...") : tr("chat.remove", "Remove")}</span>
                    </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <StartChatModal
        open={startModalOpen}
        onClose={closeStartModal}
        startMode={startMode}
        setStartMode={setStartMode}
        groupTitle={groupTitle}
        setGroupTitle={setGroupTitle}
        memberQuery={memberQuery}
        setMemberQuery={setMemberQuery}
        filteredUsers={filteredUsers}
        selectedMemberIds={selectedMemberIds}
        setSelectedMemberIds={setSelectedMemberIds}
        toggleMember={toggleMember}
        handleAvatarError={handleAvatarError}
        creatingConversation={creatingConversation}
        createConversation={createConversation}
        avatarUrl={avatarUrl}
        idStr={idStr}
      />

      <ConfirmDeleteModal
        open={leaveGroupModalOpen}
        title={tr("chat.leaveGroup", "Leave group")}
        message={tr("chat.leaveGroupConfirm", "Leave this group? You will no longer receive messages from it.")}
        confirmText={tr("chat.leave", "Leave")}
        cancelText={tr("common.cancel", "Cancel")}
        danger
        loading={leavingGroup}
        onClose={() => setLeaveGroupModalOpen(false)}
        onConfirm={confirmLeaveGroup}
      />

      <ConfirmDeleteModal
        open={hideConversationModalOpen}
        title={tr("chat.removeConversation", "Remove conversation")}
        message={tr("chat.removeConversationConfirm", "Remove this conversation from your chat list? The other user can still see it unless they remove it too.")}
        confirmText={tr("chat.remove", "Remove")}
        cancelText={tr("common.cancel", "Cancel")}
        danger
        loading={hidingConversation}
        onClose={() => {
          setHideConversationModalOpen(false);
          setHideTargetConversationId(null);
        }}
        onConfirm={confirmHideConversation}
      />
    </div>
  );
}

