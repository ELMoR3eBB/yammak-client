import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, Plus, X } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";

export default function StartChatModal({
  open,
  onClose,
  startMode,
  setStartMode,
  groupTitle,
  setGroupTitle,
  memberQuery,
  setMemberQuery,
  filteredUsers,
  selectedMemberIds,
  setSelectedMemberIds,
  toggleMember,
  handleAvatarError,
  creatingConversation,
  createConversation,
  avatarUrl,
  idStr
}) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-start-modal"
          className="chatStartModalBackdrop"
          role="dialog"
          aria-modal="true"
          onClick={onClose}
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
                <h3>{startMode === "group" ? tr("chat.startModal.createGroupChat", "Create group chat") : tr("chat.startModal.startDirectChat", "Start direct chat")}</h3>
                <p>
                  {startMode === "group"
                    ? tr("chat.startModal.groupHint", "Select team members and give the group a clear name.")
                    : tr("chat.startModal.directHint", "Choose one employee to start a direct conversation.")}
                </p>
              </div>
              <button
                type="button"
                className="chatStartModalCloseBtn"
                onClick={onClose}
                aria-label={tr("common.close", "Close")}
              >
                <X size={16} />
              </button>
            </header>

            <div className="chatStartModeTabs" role="tablist" aria-label={tr("chat.startModal.chatType", "Chat type")}>
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
                {tr("chat.direct", "Direct")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={startMode === "group"}
                className={`chatStartTab ${startMode === "group" ? "chatStartTab--active" : ""}`}
                onClick={() => setStartMode("group")}
              >
                {tr("chat.group", "Group")}
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
                      <span>{tr("chat.startModal.groupTitle", "Group title")}</span>
                      <input
                        type="text"
                        className="chatStartGroupTitleInput"
                        value={groupTitle}
                        onChange={(e) => setGroupTitle(e.target.value)}
                        maxLength={80}
                        placeholder={tr("chat.startModal.groupTitlePlaceholder", "e.g. Ops Team, Marketing")}
                        autoComplete="off"
                      />
                    </label>
                  )}

                  <label className="chatStartField">
                    <span>{startMode === "group" ? tr("chat.startModal.groupMembers", "Group members") : tr("chat.employeeFallback", "Employee")}</span>
                    <div className="chatStartSearch">
                      <Search size={14} />
                      <input
                        className="chatStartSearchInput"
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder={tr("chat.startModal.searchByNameEmail", "Search by name or email")}
                      />
                    </div>
                  </label>

                  <div className="chatStartUsersList">
                    {!filteredUsers.length && <div className="chatEmptyState">{tr("chat.startModal.noEmployeesFound", "No employees found.")}</div>}

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
                              <span className="chatAvatarInner">
                                <img
                                  src={avatarUrl(user.photoUrl)}
                                  alt={user.name || tr("chat.employeeFallback", "Employee")}
                                  onError={handleAvatarError}
                                  draggable={false}
                                />
                              </span>
                              {user.online && <i className="chatPresenceDot" aria-hidden />}
                            </div>

                            <div className="chatStartUserText">
                              <span className="chatStartUserName">{user.name || tr("chat.employeeFallback", "Employee")}</span>
                              <small className="chatStartUserMeta">{user.jobTitle || user.workEmail || "-"}</small>
                            </div>
                          </div>

                          <span className={`chatStartUserStatus ${selected ? "is-selected" : ""}`}>
                            {selected ? tr("chat.selected", "Selected") : tr("chat.select", "Select")}
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
                <span>{tr("chat.startModal.selectedCount", "{{count}} selected").replace("{{count}}", String(selectedMemberIds.length))}</span>
              </div>

              <button
                type="button"
                className="chatActionBtn chatActionBtn--accent"
                onClick={createConversation}
                disabled={creatingConversation}
              >
                <Plus size={15} />
                <span>{creatingConversation ? tr("chat.pleaseWait", "Please wait...") : startMode === "group" ? tr("chat.startModal.createGroup", "Create Group") : tr("chat.startModal.startChat", "Start Chat")}</span>
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
