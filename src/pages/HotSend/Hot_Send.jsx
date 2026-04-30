// Hot_Send.jsx — send hot notification to all users, specific role(s), or specific user(s)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Zap, Shield, User, AlertTriangle } from "lucide-react";
import { useNotification } from "../../components/NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import Radio from "../../components/ui/Radio";
import HotSendConfirm35Panel from "./Modals/HotSendConfirm35Panel";
import HotSendMassRecipientsModal from "./Modals/HotSendMassRecipientsModal";
import "../../styles/pages/hot_send/hot_send.css";

const MODAL_EXIT_DURATION_MS = 220;

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const HOT_TEMPLATES = [
  { id: "maintenance", titleKey: "hotSend.template.maintenance.title", messageKey: "hotSend.template.maintenance.message", deliveryType: "modal" },
  { id: "outage", titleKey: "hotSend.template.outage.title", messageKey: "hotSend.template.outage.message", deliveryType: "modal" },
  { id: "reminder", titleKey: "hotSend.template.reminder.title", messageKey: "hotSend.template.reminder.message", deliveryType: "notification" },
  { id: "update", titleKey: "hotSend.template.update.title", messageKey: "hotSend.template.update.message", deliveryType: "notification" },
  { id: "deadline", titleKey: "hotSend.template.deadline.title", messageKey: "hotSend.template.deadline.message", deliveryType: "notification" },
  { id: "meeting", titleKey: "hotSend.template.meeting.title", messageKey: "hotSend.template.meeting.message", deliveryType: "notification" },
  { id: "success", titleKey: "hotSend.template.success.title", messageKey: "hotSend.template.success.message", deliveryType: "notification" },
  { id: "policy", titleKey: "hotSend.template.policy.title", messageKey: "hotSend.template.policy.message", deliveryType: "modal" },
  { id: "holiday", titleKey: "hotSend.template.holiday.title", messageKey: "hotSend.template.holiday.message", deliveryType: "modal" },
  { id: "custom", titleKey: "hotSend.template.custom.title", messageKey: "hotSend.template.custom.message", deliveryType: "notification" },
];

export default function HotSend({ account }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const tr = useCallback((key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);
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
    setTitle(tr(tpl.titleKey, ""));
    setMessage(tr(tpl.messageKey, ""));
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
          const toText = targetType === "all"
            ? tr("hotSend.targetAllUsers", "all users")
            : targetType === "roles"
              ? tr("hotSend.targetRolesCount", "{{count}} role(s)").replace("{{count}}", String(targetRoleIds.length))
              : tr("hotSend.targetUsersCount", "{{count}} user(s)").replace("{{count}}", String(targetUserIds.length));
          notify?.success?.(
            tr("hotSend.notify.sentTo", "Hot notification sent to {{target}}.").replace("{{target}}", toText),
            tr("hotSend.notify.sentTitle", "Sent")
          );
          setTitle("");
          setMessage("");
          setSelectedTemplateId(null);
        } else {
          notify?.error?.(msg.error || tr("hotSend.notify.failed", "Failed to send"), tr("hotSend.title", "Hot notification"));
        }
      }
      if (msg?.type === "roles:list" && Array.isArray(msg.roles)) setRoles(msg.roles);
      if (msg?.type === "employees:list" && Array.isArray(msg.employees)) setEmployees(msg.employees || []);
    });
    return () => unsub?.();
  }, [notify, targetType, targetRoleIds.length, targetUserIds.length, tr]);

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
      notify?.warning?.(tr("hotSend.notify.enterTitle", "Enter a title."), tr("hotSend.title", "Hot notification"));
      return;
    }
    if (targetType === "roles" && targetRoleIds.length === 0) {
      notify?.warning?.(tr("hotSend.notify.selectRole", "Select at least one role."), tr("hotSend.title", "Hot notification"));
      return;
    }
    if (targetType === "users" && targetUserIds.length === 0) {
      notify?.warning?.(tr("hotSend.notify.selectUser", "Select at least one user."), tr("hotSend.title", "Hot notification"));
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

  function cancelConfirm35() {
    setConfirm35Active(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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
            <h1 className="hotSendTitle">{tr("hotSend.title", "Hot notification")}</h1>
            <p className="hotSendSubtitle">{tr("hotSend.noPermission", "You don't have permission to send hot notifications.")}</p>
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
          <h1 className="hotSendTitle">{tr("hotSend.title", "Hot notification")}</h1>
          <p className="hotSendSubtitle">{tr("hotSend.subtitle", "Send a one-time notification to all users, specific role(s), or specific user(s). Delivered now or when they next sign in.")}</p>
        </div>
      </header>

      <main className="hotSendMain">
        <form className="hotSendForm" onSubmit={handleSubmit}>
          <div className="hotSendField">
            <span className="hotSendLabel">{tr("hotSend.templates", "Templates")}</span>
            <div className="hotSendTemplates">
              {HOT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`hotSendTemplateBtn ${selectedTemplateId === tpl.id ? "active" : ""}`}
                  onClick={() => applyTemplate(tpl)}
                >
                  {tr(tpl.titleKey, tpl.id)}
                </button>
              ))}
            </div>
          </div>
          <div className="hotSendField">
            <label className="hotSendLabel" htmlFor="hot-title">{tr("hotSend.field.title", "Title")} <span className="required">*</span></label>
            <input
              id="hot-title"
              type="text"
              className="hotSendInput"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setSelectedTemplateId(null); }}
              placeholder={tr("hotSend.titlePlaceholder", "e.g. System maintenance tonight")}
              maxLength={200}
            />
          </div>
          <div className="hotSendField">
            <label className="hotSendLabel" htmlFor="hot-message">{tr("hotSend.field.message", "Message")}</label>
            <textarea
              id="hot-message"
              className="hotSendTextarea"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSelectedTemplateId(null); }}
              placeholder={tr("hotSend.messagePlaceholder", "Optional details...")}
              rows={4}
            />
          </div>

          <div className="hotSendField hotSendField--target">
            <span className="hotSendLabel">{tr("hotSend.sendTo", "Send to")}</span>
            <Radio
              name="targetType"
              value={targetType}
              onChange={setTargetType}
              options={[
                { value: "all", label: tr("hotSend.target.all", "All users") },
                { value: "roles", label: tr("hotSend.target.roles", "Specific role(s)") },
                { value: "users", label: tr("hotSend.target.users", "Specific user(s)") },
              ]}
              disabled={sending}
            />
            {targetType === "roles" && (
              <div className="hotSendTargetList">
                <span className="hotSendTargetListLabel"><Shield size={14} /> {tr("hotSend.selectRoles", "Select roles")}</span>
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
                <span className="hotSendTargetListLabel"><User size={14} /> {tr("hotSend.selectUsers", "Select users")}</span>
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
                <span>
                  {tr("hotSend.recipientLine", "This notification will be sent to")}{" "}
                  <strong>{recipientCount}</strong>{" "}
                  {tr(recipientCount !== 1 ? "hotSend.usersPlural" : "hotSend.userSingle", recipientCount !== 1 ? "users" : "user")}
                  !
                  {totalUsers > 0 && ` (${recipientPercent}% ${tr("hotSend.ofAllUsers", "of all users")})`}
                </span>
              </div>
            )}
          </div>

          <div className="hotSendField hotSendField--radio">
            <span className="hotSendLabel">{tr("hotSend.showAs", "Show as")}</span>
            <Radio
              name="deliveryType"
              value={deliveryType}
              onChange={setDeliveryType}
              options={[
                { value: "notification", label: tr("hotSend.delivery.notification", "Notification (toast + system)") },
                { value: "modal", label: tr("hotSend.delivery.modal", "Modal (dialog + system)") },
              ]}
              disabled={sending}
            />
          </div>
          <button type="submit" className="hotSendSubmit" disabled={sending || confirm35Active}>
            {sending
              ? tr("hotSend.sending", "Sending…")
              : targetType === "all"
                ? tr("hotSend.sendAllUsers", "Send to all users")
                : targetType === "roles"
                  ? tr("hotSend.sendRolesCount", "Send to {{count}} role(s)").replace("{{count}}", String(targetRoleIds.length))
                  : tr("hotSend.sendUsersCount", "Send to {{count}} user(s)").replace("{{count}}", String(targetUserIds.length))}
          </button>

          <HotSendConfirm35Panel
            active={confirm35Active}
            countdown={confirm35Countdown}
            sending={sending}
            onConfirm={handleConfirm35}
            onCancel={cancelConfirm35}
            tr={tr}
          />
        </form>
      </main>

      <HotSendMassRecipientsModal
        isOpen={modal50Open}
        isClosing={modal50Closing}
        recipientCount={recipientCount}
        recipientPercent={recipientPercent}
        sending={sending}
        onClose={closeModal50}
        tr={tr}
        onConfirm={() => {
          doSend();
          closeModal50();
        }}
      />
    </div>
  );
}
