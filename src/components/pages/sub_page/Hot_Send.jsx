// Hot_Send.jsx — send hot notification to all users, specific role(s), or specific user(s)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Zap, Shield, User, AlertTriangle } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import Radio from "../../ui/Radio";
import { getAssetUrl } from "../../../utils/publicUrl";
import "../../../styles/pages/hot_send/hot_send.css";

const MODAL_EXIT_DURATION_MS = 220;

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const HOT_TEMPLATES = [
  { id: "maintenance", title: "Scheduled maintenance", message: "We will perform system maintenance shortly. Please save your work. Services may be briefly unavailable.", deliveryType: "modal" },
  { id: "outage", title: "Service interruption", message: "We are experiencing a service issue. Our team is working on it. We will update you as soon as possible.", deliveryType: "modal" },
  { id: "reminder", title: "Reminder", message: "This is a friendly reminder. Please complete any pending tasks before the deadline.", deliveryType: "notification" },
  { id: "update", title: "Update available", message: "A new version of the app is available. Restart or refresh to get the latest features and fixes.", deliveryType: "notification" },
  { id: "deadline", title: "Deadline approaching", message: "The deadline for this task is coming up. Please submit your work on time.", deliveryType: "notification" },
  { id: "meeting", title: "Meeting in 15 minutes", message: "Your scheduled meeting starts in 15 minutes. Please join the call on time.", deliveryType: "notification" },
  { id: "success", title: "Action completed", message: "Your request has been processed successfully. Thank you for using our system.", deliveryType: "notification" },
  { id: "policy", title: "Policy update", message: "Our company policies have been updated. Please review the changes in the Settings or HR portal.", deliveryType: "modal" },
  { id: "holiday", title: "Office closure", message: "The office will be closed on the upcoming holiday. Please plan your work accordingly. Remote work remains available.", deliveryType: "modal" },
  { id: "custom", title: "Quick announcement", message: "Please check the dashboard for the latest announcement from the team.", deliveryType: "notification" },
];

export default function HotSend({ account }) {
  const notify = useNotification();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryType, setDeliveryType] = useState("notification");
  const [targetType, setTargetType] = useState("all");
  const [targetRoleIds, setTargetRoleIds] = useState([]);
  const [targetUserIds, setTargetUserIds] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [modal50Open, setModal50Open] = useState(false);
  const [modal50Closing, setModal50Closing] = useState(false);
  const modal50CloseTimeoutRef = useRef(null);
  const [confirm35Active, setConfirm35Active] = useState(false);
  const [confirm35Countdown, setConfirm35Countdown] = useState(0);
  const reqIdRef = useRef(null);
  const rolesReqRef = useRef(null);
  const employeesReqRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const totalUsers = employees.length;
  const recipientCount = useMemo(() => {
    if (targetType === "all") return totalUsers;
    if (targetType === "roles" && targetRoleIds.length > 0) {
      const roleIdStr = (r) => (r && (r._id != null ? String(r._id) : String(r)));
      return employees.filter((e) => e.roleId && targetRoleIds.includes(roleIdStr(e.roleId))).length;
    }
    if (targetType === "users") return targetUserIds.length;
    return 0;
  }, [targetType, targetRoleIds, targetUserIds.length, employees, totalUsers]);

  const recipientPercent = totalUsers > 0 ? Math.round((recipientCount / totalUsers) * 100) : 0;
  const showRecipientIndicator = (targetType === "all" || targetType === "roles" || targetType === "users") && recipientCount > 0;
  const needsConfirm35 = recipientPercent >= 35 && recipientPercent < 50;
  const needsModal50 = recipientPercent >= 50;

  function applyTemplate(tpl) {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setDeliveryType(tpl.deliveryType || "notification");
    setSelectedTemplateId(tpl.id);
  }

  const perms = account?.role?.permissions || [];
  const canSend = perms.includes("*") || perms.includes("hot.send");

  useEffect(() => {
    if (!window.api?.wsSend) return;
    rolesReqRef.current = rid();
    employeesReqRef.current = rid();
    window.api.wsSend({ type: "roles:list", requestId: rolesReqRef.current });
    window.api.wsSend({ type: "employees:list", requestId: employeesReqRef.current });
  }, []);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "hot:send:result" && msg?.requestId === reqIdRef.current) {
        setSending(false);
        setModal50Open(false);
        setConfirm35Active(false);
        if (msg.ok) {
          const toText = targetType === "all" ? "all users" : targetType === "roles" ? `${targetRoleIds.length} role(s)` : `${targetUserIds.length} user(s)`;
          notify?.success?.(`Hot notification sent to ${toText}.`, "Sent");
          setTitle("");
          setMessage("");
          setSelectedTemplateId(null);
        } else {
          notify?.error?.(msg.error || "Failed to send", "Hot notification");
        }
      }
      if (msg?.type === "roles:list" && Array.isArray(msg.roles)) setRoles(msg.roles);
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) setEmployees(msg.employees || []);
    });
    return () => unsub?.();
  }, [notify, targetType, targetRoleIds.length, targetUserIds.length]);

  useEffect(() => {
    if (!confirm35Active) return;
    setConfirm35Countdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setConfirm35Countdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setConfirm35Active(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [confirm35Active]);

  const doSend = useCallback(() => {
    if (!canSend || !window.api?.wsSend || sending) return;
    const t = title.trim();
    if (!t) return;
    setSending(true);
    reqIdRef.current = rid();
    const payload = {
      title: t,
      message: message.trim() || null,
      deliveryType,
      targetType,
    };
    if (targetType === "roles") payload.targetRoleIds = targetRoleIds;
    if (targetType === "users") payload.targetUserIds = targetUserIds;
    window.api.wsSend({
      type: "hot:send",
      requestId: reqIdRef.current,
      payload,
    });
  }, [canSend, title, message, deliveryType, targetType, targetRoleIds, targetUserIds, sending]);

  function toggleRole(roleId) {
    const id = String(roleId);
    setTargetRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function toggleUser(userId) {
    const id = String(userId);
    setTargetUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSend || !window.api?.wsSend || sending || confirm35Active) return;
    const t = title.trim();
    if (!t) {
      notify?.warning?.("Enter a title.", "Hot notification");
      return;
    }
    if (targetType === "roles" && targetRoleIds.length === 0) {
      notify?.warning?.("Select at least one role.", "Hot notification");
      return;
    }
    if (targetType === "users" && targetUserIds.length === 0) {
      notify?.warning?.("Select at least one user.", "Hot notification");
      return;
    }
    if (needsModal50) {
      setModal50Open(true);
      return;
    }
    if (needsConfirm35) {
      setConfirm35Active(true);
      return;
    }
    doSend();
  }

  function handleConfirm35() {
    setConfirm35Active(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    doSend();
  }

  function closeModal50() {
    if (modal50CloseTimeoutRef.current) clearTimeout(modal50CloseTimeoutRef.current);
    setModal50Closing(true);
    modal50CloseTimeoutRef.current = setTimeout(() => {
      setModal50Open(false);
      setModal50Closing(false);
      modal50CloseTimeoutRef.current = null;
    }, MODAL_EXIT_DURATION_MS);
  }

  useEffect(() => {
    return () => {
      if (modal50CloseTimeoutRef.current) clearTimeout(modal50CloseTimeoutRef.current);
    };
  }, []);

  if (!account) return null;
  if (!canSend) {
    return (
      <div className="hotSendPage">
        <header className="hotSendHeader">
          <div className="hotSendHeaderIcon"><Zap size={24} /></div>
          <div className="hotSendHeaderText">
            <h1 className="hotSendTitle">Hot notification</h1>
            <p className="hotSendSubtitle">You don&apos;t have permission to send hot notifications.</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="hotSendPage">
      <header className="hotSendHeader">
        <div className="hotSendHeaderIcon">
          <Zap size={24} />
        </div>
        <div className="hotSendHeaderText">
          <h1 className="hotSendTitle">Hot notification</h1>
          <p className="hotSendSubtitle">Send a one-time notification to all users, specific role(s), or specific user(s). Delivered now or when they next sign in.</p>
        </div>
      </header>

      <main className="hotSendMain">
        <form className="hotSendForm" onSubmit={handleSubmit}>
          <div className="hotSendField">
            <span className="hotSendLabel">Templates</span>
            <div className="hotSendTemplates">
              {HOT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`hotSendTemplateBtn ${selectedTemplateId === tpl.id ? "active" : ""}`}
                  onClick={() => applyTemplate(tpl)}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>
          <div className="hotSendField">
            <label className="hotSendLabel" htmlFor="hot-title">Title <span className="required">*</span></label>
            <input
              id="hot-title"
              type="text"
              className="hotSendInput"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setSelectedTemplateId(null); }}
              placeholder="e.g. System maintenance tonight"
              maxLength={200}
            />
          </div>
          <div className="hotSendField">
            <label className="hotSendLabel" htmlFor="hot-message">Message</label>
            <textarea
              id="hot-message"
              className="hotSendTextarea"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSelectedTemplateId(null); }}
              placeholder="Optional details..."
              rows={4}
            />
          </div>

          <div className="hotSendField hotSendField--target">
            <span className="hotSendLabel">Send to</span>
            <Radio
              name="targetType"
              value={targetType}
              onChange={setTargetType}
              options={[
                { value: "all", label: "All users" },
                { value: "roles", label: "Specific role(s)" },
                { value: "users", label: "Specific user(s)" },
              ]}
              disabled={sending}
            />
            {targetType === "roles" && (
              <div className="hotSendTargetList">
                <span className="hotSendTargetListLabel"><Shield size={14} /> Select roles</span>
                <div className="hotSendTargetChips">
                  {roles.map((r) => (
                    <button
                      key={r._id}
                      type="button"
                      className={`hotSendTargetChip ${targetRoleIds.includes(String(r._id)) ? "active" : ""}`}
                      onClick={() => toggleRole(r._id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {targetType === "users" && (
              <div className="hotSendTargetList">
                <span className="hotSendTargetListLabel"><User size={14} /> Select users</span>
                <div className="hotSendTargetChips hotSendTargetChips--users">
                  {employees.map((e) => (
                    <button
                      key={e._id}
                      type="button"
                      className={`hotSendTargetChip ${targetUserIds.includes(String(e._id)) ? "active" : ""}`}
                      onClick={() => toggleUser(e._id)}
                    >
                      {e.name}{e.workEmail ? ` (${e.workEmail})` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showRecipientIndicator && (
              <div className="hotSendRecipientIndicator">
                <AlertTriangle size={18} className="hotSendRecipientIndicatorIcon" />
                <span>This notification will be sent to <strong>{recipientCount}</strong> user{recipientCount !== 1 ? "s" : ""}!{totalUsers > 0 && ` (${recipientPercent}% of all users)`}</span>
              </div>
            )}
          </div>

          <div className="hotSendField hotSendField--radio">
            <span className="hotSendLabel">Show as</span>
            <Radio
              name="deliveryType"
              value={deliveryType}
              onChange={setDeliveryType}
              options={[
                { value: "notification", label: "Notification (toast + system)" },
                { value: "modal", label: "Modal (dialog + system)" },
              ]}
              disabled={sending}
            />
          </div>
          <button type="submit" className="hotSendSubmit" disabled={sending || confirm35Active}>
            {sending ? "Sending…" : targetType === "all" ? "Send to all users" : targetType === "roles" ? `Send to ${targetRoleIds.length} role(s)` : `Send to ${targetUserIds.length} user(s)`}
          </button>

          {confirm35Active && (
            <div className="hotSendConfirm35">
              <p className="hotSendConfirm35Text">You have <strong>{confirm35Countdown}</strong> second{confirm35Countdown !== 1 ? "s" : ""} to confirm. After that, the send will be cancelled.</p>
              <div className="hotSendConfirm35Actions">
                <button
                  type="button"
                  className="hotSendConfirm35Btn"
                  onClick={handleConfirm35}
                  disabled={sending}
                >
                  Confirm send ({confirm35Countdown})
                </button>
                <button
                  type="button"
                  className="hotSendConfirm35Cancel"
                  onClick={() => { setConfirm35Active(false); if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      </main>

      {(modal50Open || modal50Closing) &&
        createPortal(
          <div
            className={`hotSendModalBackdrop ${modal50Closing ? "hotSendModalBackdrop--exit" : ""}`}
            onClick={modal50Closing ? undefined : closeModal50}
            role="presentation"
          >
            <div
              className={`hotSendModal ${modal50Closing ? "hotSendModal--exit" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="hotSendModalTitle"
            >
              <img src={getAssetUrl("assets/svg/warning-ill.svg")} alt="" className="hotSendModalIll" />
              <h2 id="hotSendModalTitle" className="hotSendModalTitle">Send to many users</h2>
              <p className="hotSendModalMessage">
                You are about to send this notification to <strong>{recipientCount}</strong> user{recipientCount !== 1 ? "s" : ""} ({recipientPercent}% of all users). This action will deliver the message immediately. Are you sure?
              </p>
              <div className="hotSendModalActions">
                <button type="button" className="hotSendModalBtn hotSendModalBtn--close" onClick={closeModal50} disabled={modal50Closing}>
                  Close
                </button>
                <button type="button" className="hotSendModalBtn hotSendModalBtn--confirm" onClick={() => { doSend(); closeModal50(); }} disabled={sending || modal50Closing}>
                  {sending ? "Sending…" : "Confirm send"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
