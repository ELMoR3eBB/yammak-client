import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { ColorPicker } from "primereact/colorpicker";
import { Eye, Copy, Folder, ChevronDown, FolderOpenDot, X, Pencil, Trash2, KeyRound, Search, Tags, Sparkles, Plus, Shield, FolderPlus, Clock3 } from "lucide-react";
import { useNotification } from "../../components/NotificationProvider";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import "../../styles/pages/vaults/vaults.css";

import EditorModal from "./Modals/EditorModal.jsx";
import PreviewModal from "./Modals/PreviewModal.jsx";
import DeleteModal from "./Modals/DeleteModal.jsx";
import CategoryModal, { CATEGORY_COLOR_PRESETS } from "./Modals/CategoryModal.jsx";


function VaultCardContent({ item, handleCopy, setPreviewItem, openEditModal, setDeleteItem, t }) {
  return (
    <>
      <div className="vaultMiniTop">
        <div className="vaultMiniLeft">
          <div className="vaultMiniIcon">
            <Shield size={16} />
          </div>

          <div>
            <h3>{item.platform}</h3>
            <p>{item.username}</p>
          </div>
        </div>

        <span
          className="vaultMiniBadge"
          style={{
            background: `${item.categoryColor || "#22c55e"}20`,
            color: item.categoryColor || "#22c55e",
          }}
        >
          {item.categoryName || t("vault.general")}
        </span>
      </div>

      {item.notes && (
        <div className="vaultMiniExtra">
          {item.notes}
        </div>
      )}

      <div className="vaultMiniBottom">
        <div className="vaultMiniActions" onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCopy(item.username, t("vault.username"));
            }}
          >
            <Copy size={14} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCopy(item.password, t("vault.password"));
            }}
          >
            <KeyRound size={14} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewItem(item);
            }}
          >
            <Eye size={14} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openEditModal(item);
            }}
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            className="danger"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteItem(item);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

function VaultItemCard({
  item,
  handleCopy,
  setPreviewItem,
  openEditModal,
  setDeleteItem,
  t,
}) {
  return (
    <div className="vaultMiniCard">
      <VaultCardContent
        item={item}
        handleCopy={handleCopy}
        setPreviewItem={setPreviewItem}
        openEditModal={openEditModal}
        setDeleteItem={setDeleteItem}
        t={t}
      />
    </div>
  );
}


const CATEGORY_MENU_GAP = 8;
const CATEGORY_MENU_EDGE = 12;
const CATEGORY_MENU_MIN_WIDTH = 240;
const CATEGORY_MENU_MAX_WIDTH = 320;
const CATEGORY_MENU_MAX_HEIGHT = 320;
const CATEGORY_MENU_MIN_OPEN_BELOW = 180;

const emptyForm = () => ({
  platform: "",
  username: "",
  password: "",
  categoryId: "",
  notes: "",
  customFields: [],
});

const createId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function buildFormFromItem(item) {
  return {
    platform: item?.platform || "",
    username: item?.username || "",
    password: item?.password || "",
    categoryId: item?.categoryId || "",
    notes: item?.notes || "",
    customFields: Array.isArray(item?.customFields)
      ? item.customFields.map((field) => ({
        fieldId: field.fieldId || createId(),
        type: field.type || "text",
        label: field.label || "",
        placeholder: field.placeholder || "",
        value: field.value || "",
      }))
      : [],
  };
}

export function secretMask(value) {
  const size = Math.max(8, Math.min(18, String(value || "").length));
  return "•".repeat(size);
}

function MetricCard({ icon, label, value, tone = "amber", animationKey, duration = 700 }) {
  const animatedValue = useAnimatedNumber(value, animationKey || label, duration);

  return (
    <div className={`vaultMetric vaultMetric--${tone}`}>
      <div className="vaultMetricIcon">{icon}</div>
      <div className="vaultMetricBody">
        <span className="vaultMetricValue">{animatedValue.toLocaleString()}</span>
        <span className="vaultMetricLabel">{label}</span>
      </div>
    </div>
  );
}



function VaultCategoryFilterMenu({ options, value, onChange, t }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [dropStyle, setDropStyle] = useState({});

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || options[0] || null,
    [options, value]
  );

  const closeMenu = useCallback(() => setOpen(false), []);

  const buildDropStyle = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return null;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = Math.min(
      CATEGORY_MENU_MAX_WIDTH,
      Math.max(CATEGORY_MENU_MIN_WIDTH, Math.ceil(rect.width))
    );

    let left = rect.left;
    if (left + menuWidth > viewportWidth - CATEGORY_MENU_EDGE) {
      left = viewportWidth - menuWidth - CATEGORY_MENU_EDGE;
    }
    if (left < CATEGORY_MENU_EDGE) {
      left = CATEGORY_MENU_EDGE;
    }

    const spaceBelow = viewportHeight - rect.bottom - CATEGORY_MENU_GAP - CATEGORY_MENU_EDGE;
    const spaceAbove = rect.top - CATEGORY_MENU_GAP - CATEGORY_MENU_EDGE;
    const openAbove = spaceBelow < CATEGORY_MENU_MIN_OPEN_BELOW && spaceAbove > spaceBelow;

    let top;
    let bottom;
    let maxHeight;

    if (openAbove) {
      maxHeight = Math.min(CATEGORY_MENU_MAX_HEIGHT, Math.max(140, spaceAbove));
      bottom = viewportHeight - rect.top + CATEGORY_MENU_GAP;
      top = undefined;
    } else {
      maxHeight = Math.min(CATEGORY_MENU_MAX_HEIGHT, Math.max(140, spaceBelow));
      top = rect.bottom + CATEGORY_MENU_GAP;
      bottom = undefined;
    }

    return {
      position: "fixed",
      left: Math.round(left),
      top: top == null ? "auto" : Math.round(top),
      bottom: bottom == null ? "auto" : Math.round(bottom),
      width: menuWidth,
      maxHeight: Math.round(maxHeight),
      zIndex: 52000,
      boxSizing: "border-box",
    };
  }, []);

  const updatePosition = useCallback(() => {
    const nextStyle = buildDropStyle();
    if (nextStyle) setDropStyle(nextStyle);
  }, [buildDropStyle]);

  const toggleMenu = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }

    const nextStyle = buildDropStyle();
    if (nextStyle) setDropStyle(nextStyle);
    setOpen(true);
  }, [buildDropStyle, open]);

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
    });

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      const target = event.target;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeMenu();
    };

    document.addEventListener("mousedown", handleOutsideClick, true);
    window.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [closeMenu, open]);


  return (
    <div ref={wrapRef} className={`vaultCategoryFilter ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="vaultCategoryFilterTrigger"
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="vaultCategoryFilterTriggerMain">
          {selectedOption?.color ? (
            <span
              className="vaultCategoryDot vaultCategoryFilterTriggerDot"
              style={{ "--vault-category-color": selectedOption.color }}
            />
          ) : (
            <Folder size={15} className="vaultCategoryFilterTriggerIcon" />
          )}
          <span className="vaultCategoryFilterTriggerValue">
            {selectedOption?.label || t("vault.allAccounts")}
          </span>
        </span>
        <span className="vaultCategoryFilterTriggerMeta">
          <span className="vaultCategoryFilterTriggerCount">{selectedOption?.count ?? 0}</span>
          <ChevronDown size={16} className="vaultCategoryFilterTriggerChevron" />
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            ref={menuRef}
            className="vaultCategoryFilterMenuPortal"
            style={dropStyle}
            role="presentation"
          >
            <div className="vaultCategoryFilterMenu" role="listbox" aria-label={t("vault.filterByCategory")}>
              <header className="vaultCategoryFilterMenuHeader">
                <div>
                  <span className="vaultCategoryFilterMenuEyebrow">{t("vault.filters")}</span>
                  <h3>{t("vault.category")}</h3>
                </div>
                <span className="vaultCategoryFilterMenuHeaderBadge">{options.length}</span>
              </header>

              <div className="vaultCategoryFilterMenuList">
                {options.map((option) => {
                  const isActive = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`vaultCategoryFilterOption ${isActive ? "is-active" : ""}`}
                      onClick={() => {
                        onChange(option.value);
                        closeMenu();
                      }}
                    >
                      <span className="vaultCategoryFilterOptionMain">
                        {option.color ? (
                          <span
                            className="vaultCategoryDot"
                            style={{ "--vault-category-color": option.color }}
                          />
                        ) : (
                          <Folder size={15} className="vaultCategoryFilterOptionIcon" />
                        )}
                        <span className="vaultCategoryFilterOptionLabel">{option.label}</span>
                      </span>
                      <span className="vaultCategoryFilterOptionCount">{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}



export default function Vaults() {
  const { t } = useLanguage();

  const notify = useNotification();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [editor, setEditor] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", color: CATEGORY_COLOR_PRESETS[0] });
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const fetchVault = useCallback(async () => {
    if (!window.api?.vaultsList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await window.api.vaultsList();
    setLoading(false);
    console.log(res)

    if (res?.ok) {
      setItems(Array.isArray(res.items) ? [...res.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : []);
      setCategories(Array.isArray(res.categories) ? res.categories : []);
      return;
    }

    setItems([]);
    setCategories([]);
    notify?.error?.(res?.error || t("vault.failedLoad"), t("vault.sectionTitle"));
  }, [notify, t]);

  useEffect(() => {
    void fetchVault();
  }, [fetchVault]);

  useEffect(() => {
    if (!previewItem) return;
    const fresh = items.find((item) => item.id === previewItem.id);
    if (fresh) setPreviewItem(fresh);
    else setPreviewItem(null);
  }, [items, previewItem]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const item of items) {
      const key = item.categoryId || "uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return items.filter((item) => {
      if (activeCategoryId !== "all") {
        const categoryKey = item.categoryId || "uncategorized";
        if (categoryKey !== activeCategoryId) return false;
      }

      if (!query) return true;

      const haystack = [
        item.platform,
        item.username,
        item.notes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeCategoryId, deferredSearch, items]);

  const totals = useMemo(() => {
    return {
      accounts: items.length,
      categories: categories.length,
      customFields: items.reduce((sum, item) => sum + (item.customFields?.length || 0), 0),
    };
  }, [categories.length, items]);

  const uncategorizedCount = categoryCounts.get("uncategorized") || 0;

  const recentItems = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 4);
  }, [items]);

  const activeCategoryLabel = useMemo(() => {
    if (activeCategoryId === "all") return t("vault.allAccounts");
    if (activeCategoryId === "uncategorized") return t("vault.uncategorized");
    return categories.find((category) => category.id === activeCategoryId)?.name || t("vault.selectedCategory");
  }, [activeCategoryId, categories]);

  const categoryBreakdown = useMemo(() => {
    const ranked = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color || "#f59e0b",
        count: categoryCounts.get(category.id) || 0,
      }))
      .filter((category) => category.count > 0)
      .sort((left, right) => right.count - left.count);

    if (uncategorizedCount > 0) {
      ranked.push({
        id: "uncategorized",
        name: t("vault.uncategorized"),
        color: "#64748b",
        count: uncategorizedCount,
      });
    }

    return ranked.slice(0, 4);
  }, [categories, categoryCounts, t, uncategorizedCount]);

  const categoryFilterOptions = useMemo(() => {
    const options = [
      {
        value: "all",
        label: t("vault.allAccounts"),
        count: items.length,
        color: null,
      },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
        count: categoryCounts.get(category.id) || 0,
        color: category.color || "#f59e0b",
      })),
    ];

    if (uncategorizedCount > 0 || activeCategoryId === "uncategorized") {
      options.push({
        value: "uncategorized",
        label: t("vault.uncategorized"),
        count: uncategorizedCount,
        color: "#64748b",
      });
    }

    return options;
  }, [activeCategoryId, categories, categoryCounts, items.length, t, uncategorizedCount]);

  useEffect(() => {
    if (activeCategoryId === "all") return;
    const hasMatchingOption = categoryFilterOptions.some((option) => option.value === activeCategoryId);
    if (!hasMatchingOption) {
      setActiveCategoryId("all");
    }
  }, [activeCategoryId, categoryFilterOptions]);

  const hasActiveFilters = activeCategoryId !== "all" || Boolean(search.trim());

  const filteredSummary = useMemo(() => {
    if (loading) return t("vault.summary.loading");

    if (items.length === 0) {
      return t("vault.summary.empty");
    }

    if (filteredItems.length === 0) {
      return t("vault.summary.noMatch");
    }

    if (!hasActiveFilters) {
      return t("vault.summary.savedAccounts")
        .replace("{{count}}", String(filteredItems.length))
        .replace("{{suffix}}", filteredItems.length === 1 ? "" : "s");
    }

    return t("vault.summary.matchingIn")
      .replace("{{count}}", String(filteredItems.length))
      .replace("{{suffix}}", filteredItems.length === 1 ? "" : "s")
      .replace("{{category}}", activeCategoryLabel.toLowerCase());
  }, [activeCategoryLabel, filteredItems.length, hasActiveFilters, items.length, loading, t]);

  const openCreateModal = useCallback(() => {
    setEditor({
      mode: "create",
      id: null,
      form: emptyForm(),
    });
  }, []);

  const openEditModal = useCallback((item) => {
    setPreviewItem(null);
    setEditor({
      mode: "edit",
      id: item.id,
      form: buildFormFromItem(item),
    });
  }, []);

  const handleCopy = useCallback(
    async (value, label) => {
      const textToCopy = value || "";
      try {
        // Modern approach
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(textToCopy);
          notify?.success?.(t("vault.copiedToClipboard").replace("{{label}}", label), t("vault.sectionTitle"));
        } else {
          throw new Error(t("vault.clipboardApiNotFound"));
        }
      } catch (err) {
        console.warn("Modern copy failed, trying fallback...", err);
        // Robust fallback approach
        try {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (successful) {
            notify?.success?.(t("vault.copiedToClipboard").replace("{{label}}", label), t("vault.sectionTitle"));
          } else {
            throw new Error("execCommand copy failed");
          }
        } catch (fallbackErr) {
          console.error("Copy failed completely", fallbackErr);
          notify?.error?.(t("vault.unableToCopy").replace("{{label}}", label.toLowerCase()), t("vault.sectionTitle"));
        }
      }
    },
    [notify, t]
  );

  const updateEditorForm = useCallback((updater) => {
    setEditor((current) => {
      if (!current) return current;
      const nextForm = typeof updater === "function" ? updater(current.form) : updater;
      return { ...current, form: nextForm };
    });
  }, []);

  const addCustomField = useCallback(() => {
    updateEditorForm((form) => ({
      ...form,
      customFields: [
        ...form.customFields,
        {
          fieldId: createId(),
          type: "text",
          label: "",
          placeholder: "",
          value: "",
        },
      ],
    }));
  }, [updateEditorForm]);

  const updateCustomField = useCallback((fieldId, patch) => {
    updateEditorForm((form) => ({
      ...form,
      customFields: form.customFields.map((field) =>
        field.fieldId === fieldId ? { ...field, ...patch } : field
      ),
    }));
  }, [updateEditorForm]);

  const removeCustomField = useCallback((fieldId) => {
    updateEditorForm((form) => ({
      ...form,
      customFields: form.customFields.filter((field) => field.fieldId !== fieldId),
    }));
  }, [updateEditorForm]);

  const handleSave = useCallback(async () => {
    if (!editor || !window.api?.vaultCreate || !window.api?.vaultUpdate) return;

    const form = editor.form;
    const payload = {
      platform: form.platform.trim(),
      username: form.username.trim(),
      password: form.password,
      categoryId: form.categoryId || null,
      notes: form.notes,
      customFields: (form.customFields || [])
        .map((field) => ({
          fieldId: field.fieldId,
          type: field.type,
          label: field.label.trim(),
          placeholder: field.placeholder,
          value: field.value,
        }))
        .filter((field) => field.label),
    };

    if (!payload.platform) {
      notify?.error?.(t("vault.platformRequired"), t("vault.sectionTitle"));
      return;
    }
    if (!payload.username) {
      notify?.error?.(t("vault.usernameRequired"), t("vault.sectionTitle"));
      return;
    }
    if (!payload.password) {
      notify?.error?.(t("vault.passwordRequired"), t("vault.sectionTitle"));
      return;
    }

    setSaving(true);
    const res =
      editor.mode === "create"
        ? await window.api.vaultCreate(payload)
        : await window.api.vaultUpdate({ id: editor.id, ...payload });
    setSaving(false);

    if (!res?.ok || !res.item) {
      notify?.error?.(res?.error || t("vault.failedSave"), t("vault.sectionTitle"));
      return;
    }

    setItems((current) => {
      if (editor.mode === "create") {
        return [...current, res.item].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      }

      return current
        .map((item) => (item.id === res.item.id ? { ...item, ...res.item } : item))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });

    setEditor(null);
    notify?.success?.(
      editor.mode === "create" ? t("vault.createdSuccess") : t("vault.updatedSuccess"),
      t("vault.sectionTitle")
    );
  }, [editor, notify, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteItem || !window.api?.vaultDelete) return;

    setDeleting(true);
    const res = await window.api.vaultDelete(deleteItem.id);
    setDeleting(false);

    if (!res?.ok) {
      notify?.error?.(res?.error || t("vault.failedDelete"), t("vault.sectionTitle"));
      return;
    }

    setItems((current) => current.filter((item) => item.id !== deleteItem.id));
    setDeleteItem(null);
    notify?.success?.(t("vault.deletedSuccess"), t("vault.sectionTitle"));
  }, [deleteItem, notify, t]);

  const handleCreateCategory = useCallback(async () => {
    if (!window.api?.vaultCreateCategory) return;
    const name = categoryDraft.name.trim();

    if (!name) {
      notify?.error?.(t("vault.categoryNameRequired"), t("vault.sectionTitle"));
      return;
    }

    setCreatingCategory(true);
    const res = await window.api.vaultCreateCategory({
      name,
      color: categoryDraft.color,
    });
    setCreatingCategory(false);

    if (!res?.ok || !res.category) {
      notify?.error?.(res?.error || t("vault.failedCreateCategory"), t("vault.sectionTitle"));
      return;
    }

    setCategories((current) =>
      [...current, res.category].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    );
    setCategoryDraft({ name: "", color: res.category.color });
    setCategoryModalOpen(false);
    notify?.success?.(t("vault.categoryCreatedSuccess"), t("vault.sectionTitle"));
  }, [categoryDraft.color, categoryDraft.name, notify, t]);

  const renderModalPortal = (children) => {
    if (typeof document === "undefined" || !document.body) return null;
    return createPortal(children, document.body);
  };

  return (
    <div className="vaultPage">

      <header className="vaultHeader">

        <div className="vaultHeaderIcon">
          <Shield size={24} />
        </div>

        <div className="vaultHeaderText">
          <h1 className="vaultTitle">{t("vault.title")}</h1>
          <p className="vaultSubtitle">{t("vault.subtitle")}</p>
        </div>

        <div className="vaultHeaderActions">
          <button type="button" className="vaultSecondaryButton" onClick={() => setCategoryModalOpen(true)}>
            <FolderPlus size={17} />
            {t("vault.newCategory")}
          </button>
          <button type="button" className="vaultPrimaryButton" onClick={openCreateModal}>
            <Plus size={18} />
            {t("vault.newAccount")}
          </button>
        </div>

      </header>

      <div className="vaultBody">
        <motion.section
          className="vaultMetrics"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: loading ? 0 : 1, y: loading ? 15 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <MetricCard
            icon={<Shield size={22} />}
            label={t("vault.savedAccounts")}
            value={totals.accounts}
            tone="amber"
            animationKey="vault-metric-accounts"
          />
          <MetricCard
            icon={<Tags size={22} />}
            label={t("vault.categories")}
            value={totals.categories}
            tone="cyan"
            animationKey="vault-metric-categories"
          />
          <MetricCard
            icon={<Sparkles size={22} />}
            label={t("vault.customFields")}
            value={totals.customFields}
            tone="pink"
            animationKey="vault-metric-custom-fields"
          />
        </motion.section>



        <motion.section
          className="vaultToolbar"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: loading ? 0 : 1, y: loading ? 15 : 0 }}
          transition={{ duration: 0.3, delay: loading ? 0 : 0.2 }}
        >
          <div className="vaultSearch">
            <Search size={16} className="vaultSearchIcon" />
            <input
              type="text"
              className="vaultSearchInput"
              placeholder={t("vault.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="vaultCategorySelector">
            <VaultCategoryFilterMenu
              options={categoryFilterOptions}
              value={activeCategoryId}
              onChange={setActiveCategoryId}
              t={t}
            />
          </div>
        </motion.section>

        <div className="vaultContent">
          <div className="vaultGrid">
            {filteredItems.map((item) => (
              <VaultItemCard
                key={item.id}
                item={item}
                handleCopy={handleCopy}
                setPreviewItem={setPreviewItem}
                openEditModal={openEditModal}
                setDeleteItem={setDeleteItem}
                t={t}
              />
            ))}
          </div>
        </div>

      </div>

      {renderModalPortal(
        <>
          <AnimatePresence>
            {editor ? (
              <EditorModal
                editor={editor}
                setEditor={setEditor}
                saving={saving}
                handleSave={handleSave}
                categories={categories}
                setCategoryModalOpen={setCategoryModalOpen}
                updateEditorForm={updateEditorForm}
                addCustomField={addCustomField}
                updateCustomField={updateCustomField}
                removeCustomField={removeCustomField}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {previewItem ? (
              <PreviewModal
                previewItem={previewItem}
                setPreviewItem={setPreviewItem}
                notify={notify}
                openEditModal={openEditModal}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {deleteItem ? (
              <DeleteModal
                deleteItem={deleteItem}
                setDeleteItem={setDeleteItem}
                handleDelete={handleDelete}
                deleting={deleting}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {categoryModalOpen ? (
              <CategoryModal
                setCategoryModalOpen={setCategoryModalOpen}
                categoryDraft={categoryDraft}
                setCategoryDraft={setCategoryDraft}
                handleCreateCategory={handleCreateCategory}
                creatingCategory={creatingCategory}
                categories={categories}
              />
            ) : null}
          </AnimatePresence>
        </>
      )}

    </div>
  );
}
