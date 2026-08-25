const SUPABASE_URL = "https://phklgazjbpotnyvvtxff.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0mYCwNiT3lYj5AW3bYN1Jg_IaeN3heo";

const categories = [
  { id: "all", name: "全部" },
  { id: "tech", name: "科技风", query: "technology workstation computer desk setup", tags: ["冷色", "屏幕", "数码"] },
  { id: "ins", name: "Ins 风", query: "aesthetic home office desk", tags: ["氛围", "装饰", "生活感"] },
  { id: "minimal", name: "极简风", query: "minimal clean desk workspace", tags: ["留白", "秩序", "黑白"] },
  { id: "wood", name: "原木风", query: "wooden desk cozy workspace", tags: ["木质", "暖色", "自然"] },
  { id: "gaming", name: "电竞风", query: "gaming desk setup rgb", tags: ["RGB", "多屏", "暗色"] },
  { id: "industrial", name: "工业风", query: "industrial loft desk workspace", tags: ["金属", "水泥", "粗粝"] },
  { id: "cream", name: "奶油风", query: "cream white cozy desk setup", tags: ["柔和", "浅色", "治愈"] },
  { id: "retro", name: "复古风", query: "retro vintage desk workspace", tags: ["复古", "台灯", "收藏"] },
  { id: "dark", name: "暗黑风", query: "dark moody desk setup", tags: ["黑色", "光影", "沉浸"] },
  { id: "color", name: "多巴胺", query: "colorful creative desk setup", tags: ["彩色", "活力", "玩趣"] },
  { id: "plant", name: "绿植风", query: "plants biophilic desk workspace", tags: ["植物", "自然光", "清新"] },
  { id: "creator", name: "创作者", query: "creative studio desk setup", tags: ["摄影", "音频", "工作室"] }
];

const ratios = ["4/5", "3/2", "1/1", "5/7", "16/10", "4/3"];
const collectionNames = { common: "常用桌搭", other: "其他桌搭", torras: "图拉斯桌搭" };
const removedBaseIds = new Set([56, 58, 61, 62, 63, 64, 67, 69, 70, 79, 81, 82, 83, 84, 87, 88, 97, 98, 105, 110, 115, 116, 117, 118, 119, 120, 121, 122, 126, 129, 131]);
const baseItems = categories.slice(1).flatMap((category, categoryIndex) =>
  Array.from({ length: 11 }, (_, index) => {
    const id = categoryIndex * 11 + index + 1;
    return {
      id,
      category: category.id,
      categoryName: category.name,
      title: `${category.name} · ${String(index + 1).padStart(2, "0")}`,
      tags: category.tags,
      ratio: ratios[(id + categoryIndex) % ratios.length],
      image: `assets/desk-inspiration/desk-${String(id).padStart(3, "0")}.jpg`,
      source: `https://unsplash.com/s/photos/${encodeURIComponent(category.query)}`,
      platform: "other"
    };
  })
);

function itemKey(item) {
  if (item.key) return item.key;
  if (item.platform === "xiaohongshu-latest") return `latest:${item.id}`;
  if (item.platform === "xiaohongshu") return `xhs:${item.id}`;
  return `base:${item.id}`;
}

const sourceItems = [...baseItems.filter(item => !removedBaseIds.has(item.id)), ...xhsItems, ...xhsLatestItems]
  .map(item => ({ ...item, key: itemKey(item) }));

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const saved = new Set(readLocalArray("deskSaved").map(String));
const DELETE_TOKEN_KEY = "deskDeleteToken";
const RECYCLE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
let remoteRows = [];
let items = [...sourceItems];
let deleteToken = localStorage.getItem(DELETE_TOKEN_KEY) || "";
let isAdmin = false;
let pendingDeleteKey = "";
let activeCategory = "all";
let activeSource = "all";
let savedOnly = false;
let remoteSignature = "";
let renderLimit = window.matchMedia("(max-width: 760px)").matches ? 16 : 32;

const gallery = document.querySelector("#gallery");
const filters = document.querySelector("#filters");
const searchInput = document.querySelector("#searchInput");
const sourceFilters = document.querySelector("#sourceFilters");
const lightbox = document.querySelector("#lightbox");
const addImageBtn = document.querySelector("#addImageBtn");
const addImageDialog = document.querySelector("#addImageDialog");
const addImageForm = document.querySelector("#addImageForm");
const imageFile = document.querySelector("#imageFile");
const imageCollection = document.querySelector("#imageCollection");
const imageCategory = document.querySelector("#imageCategory");
const imageNote = document.querySelector("#imageNote");
const imageSource = document.querySelector("#imageSource");
const deletePasswordDialog = document.querySelector("#deletePasswordDialog");
const deletePasswordForm = document.querySelector("#deletePasswordForm");
const styleEditDialog = document.querySelector("#styleEditDialog");
const styleEditForm = document.querySelector("#styleEditForm");
const styleEditCategory = document.querySelector("#styleEditCategory");
const collectionEditDialog = document.querySelector("#collectionEditDialog");
const collectionEditForm = document.querySelector("#collectionEditForm");
const collectionEditSelect = document.querySelector("#collectionEditSelect");
const loadMoreWrap = document.querySelector("#loadMoreWrap");
const loadMoreBtn = document.querySelector("#loadMoreBtn");
const loadMoreStatus = document.querySelector("#loadMoreStatus");
const adminBtn = document.querySelector("#adminBtn");
const shortcutBtn = document.querySelector("#shortcutBtn");
const recycleBinDialog = document.querySelector("#recycleBinDialog");
const recycleList = document.querySelector("#recycleList");
let pendingStyleKey = "";
let pendingCollectionKey = "";
let longPressTimer = null;
let deferredInstallPrompt = null;
let longPressState = null;
let suppressPhotoClickUntil = 0;

categories.forEach(category => {
  const button = document.createElement("button");
  button.className = `filter${category.id === "all" ? " active" : ""}`;
  button.type = "button";
  button.dataset.category = category.id;
  button.textContent = category.name;
  filters.append(button);
});

categories.filter(category => category.id !== "all").forEach(category => {
  [imageCategory, styleEditCategory].forEach(select => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  });
});

function sourceGroup(item) {
  if (item.platform === "xiaohongshu-latest" || item.platform === "common") return "common";
  if (item.platform === "torras") return "torras";
  return "other";
}

function cloudRowToItem(row, existing = {}) {
  const category = categories.find(entry => entry.id === row.category);
  return {
    ...existing,
    id: existing.id ?? `cloud-${row.id}`,
    key: row.source_key,
    cloudId: row.id,
    category: row.category || existing.category || "ins",
    categoryName: row.category_name || existing.categoryName || category?.name || "Ins 风",
    title: row.title || existing.title || "我的桌搭",
    tags: Array.isArray(row.tags) ? row.tags : (existing.tags || []),
    ratio: row.ratio || existing.ratio || "4/5",
    image: row.image_url || existing.image || "",
    source: row.source_url || existing.source || "",
    platform: row.platform || existing.platform || "custom",
    note: row.note || existing.note || "",
    uploadWidth: row.original_width || existing.uploadWidth,
    uploadHeight: row.original_height || existing.uploadHeight,
    createdAt: row.created_at
  };
}

function rebuildItems() {
  const merged = new Map(sourceItems.map(item => [item.key, item]));
  remoteRows.forEach(row => {
    if (row.deleted) {
      merged.delete(row.source_key);
      return;
    }
    merged.set(row.source_key, cloudRowToItem(row, merged.get(row.source_key)));
  });
  items = [...merged.values()];
}

function recycleRows() {
  const now = Date.now();
  return remoteRows
    .filter(row => row.deleted && now - new Date(row.deleted_at || row.updated_at || 0).getTime() < RECYCLE_RETENTION_MS)
    .sort((a, b) => new Date(b.deleted_at || b.updated_at) - new Date(a.deleted_at || a.updated_at));
}

function deletedRowItem(row) {
  const existing = sourceItems.find(item => item.key === row.source_key) || {};
  return cloudRowToItem(row, existing);
}

function remainingText(row) {
  const expiresAt = new Date(row.deleted_at || row.updated_at).getTime() + RECYCLE_RETENTION_MS;
  const hours = Math.max(1, Math.ceil((expiresAt - Date.now()) / 3_600_000));
  return hours > 24 ? `剩余 ${Math.ceil(hours / 24)} 天` : `剩余 ${hours} 小时`;
}

function renderRecycle() {
  const rows = recycleRows();
  recycleList.innerHTML = rows.length ? rows.map(row => {
    const item = deletedRowItem(row);
    return `<div class="recycle-item" data-key="${escapeHtml(row.source_key)}">
      <img src="${escapeHtml(previewImage(item))}" alt="${escapeHtml(item.categoryName || "桌搭")}回收站预览" loading="lazy" decoding="async" />
      <div><strong>${escapeHtml(item.categoryName || "桌搭图片")}</strong><small>${remainingText(row)} · 到期后不可恢复</small></div>
      <button class="restore-btn" type="button">恢复</button>
    </div>`;
  }).join("") : `<div class="recycle-empty">回收站为空</div>`;
}

function setAdminUnlocked(unlocked) {
  isAdmin = unlocked;
  document.body.classList.toggle("admin-unlocked", unlocked);
  adminBtn.classList.toggle("active", unlocked);
  adminBtn.textContent = unlocked ? `回收 ${recycleRows().length}` : "管理";
  adminBtn.setAttribute("aria-label", unlocked ? "打开管理员回收站" : "管理员登录");
  if (unlocked) renderRecycle();
}

function visibleItems() {
  const term = searchInput.value.trim().toLowerCase();
  return items.filter(item => {
    const categoryMatch = activeCategory === "all" || item.category === activeCategory;
    const textMatch = !term || [item.title, item.categoryName, ...(item.tags || [])].join(" ").toLowerCase().includes(term);
    const sourceMatch = activeSource === "all" || sourceGroup(item) === activeSource;
    return categoryMatch && sourceMatch && textMatch && (!savedOnly || saved.has(item.key));
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function validRatio(value) {
  return /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(String(value)) ? String(value) : "4/5";
}

function formatNo(item) {
  return typeof item.id === "number" ? `NO.${String(item.id).padStart(3, "0")}` : "云端新增";
}

function evalRatio(ratio) {
  const [a, b] = validRatio(ratio).split("/").map(Number);
  return b ? a / b : 0.8;
}

function previewImage(item) {
  const match = String(item.image || "").match(/^assets\/(desk-inspiration|xiaohongshu-desk|xiaohongshu-latest)\/([^/]+)\.(?:jpe?g|webp|png)$/i);
  if (match) return `assets/thumbs/${match[1]}/${match[2]}.jpg`;
  if (item.key?.startsWith("custom:") && item.tags?.includes("__fast_preview__")) {
    const token = item.key.slice("custom:".length);
    return `${SUPABASE_URL}/storage/v1/object/public/desk-images/public/${encodeURIComponent(token)}-preview.jpg`;
  }
  return item.image;
}

function pageSize() {
  return window.matchMedia("(max-width: 760px)").matches ? 16 : 32;
}

function resetRenderLimit() {
  renderLimit = pageSize();
}

function cardTemplate(item, index = 99) {
  const active = saved.has(item.key) ? " active" : "";
  const height = Math.round(310 / evalRatio(item.ratio));
  const eager = index < 4;
  const preview = previewImage(item);
  const originalAttribute = preview !== item.image ? ` data-original="${escapeHtml(item.image)}"` : "";
  return `<article class="card loading" data-key="${escapeHtml(item.key)}">
    <div class="image-wrap" style="aspect-ratio:${validRatio(item.ratio)}">
      <img src="${escapeHtml(preview)}"${originalAttribute} alt="${escapeHtml(item.title)}桌搭灵感" loading="${eager ? "eager" : "lazy"}" decoding="async" fetchpriority="${eager ? "high" : "low"}" width="620" height="${height}" />
      <span class="num">${formatNo(item)}</span>
      <button class="delete-btn" type="button" aria-label="删除图片">⌫</button>
    </div>
    <div class="card-body style-only-body"><div><button class="style-label style-only-label style-edit-btn" type="button" aria-label="修改风格：${escapeHtml(item.categoryName)}" title="点击修改风格">${escapeHtml(item.categoryName)}</button></div><button class="save${active}" type="button" aria-label="收藏">${active ? "♥" : "♡"}</button></div>
  </article>`;
}

function hydrateImages(container) {
  container.querySelectorAll("img:not([data-hydrated])").forEach(img => {
    img.dataset.hydrated = "1";
    if (img.complete && img.naturalWidth) img.closest(".card").classList.remove("loading");
    img.addEventListener("load", () => img.closest(".card")?.classList.remove("loading"), { once: true });
    img.addEventListener("error", () => {
      if (img.dataset.original && !img.dataset.fallback) {
        img.dataset.fallback = "1";
        img.src = img.dataset.original;
      } else {
        img.closest(".card")?.classList.add("image-error");
      }
    });
  });
}

function updateLoadMore(total, shown) {
  const remaining = Math.max(0, total - shown);
  loadMoreWrap.hidden = remaining === 0;
  loadMoreStatus.textContent = remaining ? `已显示 ${shown} / ${total}` : "";
}

function loadMore() {
  const allItems = visibleItems();
  const shown = gallery.querySelectorAll(".card").length;
  if (shown >= allItems.length) return updateLoadMore(allItems.length, shown);
  const nextLimit = Math.min(shown + pageSize(), allItems.length);
  const holder = document.createElement("div");
  holder.innerHTML = allItems.slice(shown, nextLimit).map((item, index) => cardTemplate(item, shown + index)).join("");
  const fragment = document.createDocumentFragment();
  [...holder.children].forEach(card => fragment.append(card));
  gallery.append(fragment);
  renderLimit = nextLimit;
  hydrateImages(gallery);
  updateLoadMore(allItems.length, nextLimit);
}

window.addEventListener("scroll", () => {
  if (!loadMoreWrap.hidden && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240) loadMore();
}, { passive: true });

function render() {
  const allItems = visibleItems();
  const list = allItems.slice(0, renderLimit);
  gallery.innerHTML = list.map(cardTemplate).join("");
  document.querySelector("#imageTotal").textContent = items.length;
  document.querySelector("#footerCount").textContent = items.length;
  document.querySelector("#resultCount").textContent = allItems.length;
  document.querySelector('[data-source="common"] b').textContent = items.filter(item => sourceGroup(item) === "common").length;
  document.querySelector('[data-source="other"] b').textContent = items.filter(item => sourceGroup(item) === "other").length;
  document.querySelector('[data-source="torras"] b').textContent = items.filter(item => sourceGroup(item) === "torras").length;
  const xhsCount = items.filter(item => item.platform === "xiaohongshu" || item.platform === "xiaohongshu-latest").length;
  document.querySelector("#xhsTotal").textContent = xhsCount;
  document.querySelector("#footerXhsCount").textContent = xhsCount;
  const sourceTitle = activeSource === "common" ? " · 常用桌搭" : activeSource === "other" ? " · 其他桌搭" : activeSource === "torras" ? " · 图拉斯桌搭" : "";
  document.querySelector("#resultTitle").textContent = savedOnly ? "我的收藏" : categories.find(c => c.id === activeCategory).name + (activeCategory === "all" ? "灵感" : "桌搭") + sourceTitle;
  document.querySelector("#emptyState").hidden = allItems.length > 0;
  hydrateImages(gallery);
  updateLoadMore(allItems.length, list.length);
}

function updateSaved() {
  localStorage.setItem("deskSaved", JSON.stringify([...saved]));
  document.querySelector("#savedCount").textContent = saved.size;
}

function apiHeaders(extra = {}) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, ...extra };
}

async function unlockDeletion(password) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unlock_desk_deletion`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_password: password })
  });
  if (!response.ok) throw new Error("invalid-password");
  return response.json();
}

async function validateAdminToken() {
  if (!deleteToken) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_desk_admin`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_token: deleteToken })
  });
  return response.ok && await response.json();
}

async function deleteCloudItem(sourceKey) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_desk_item`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_source_key: sourceKey, p_token: deleteToken })
  });
  if (!response.ok) {
    const details = await response.text();
    if (details.includes("invalid_delete_session")) throw new Error("delete-session-invalid");
    throw new Error("cloud-delete-failed");
  }
  return response.json();
}

async function restoreCloudItem(sourceKey) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/restore_desk_item`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_source_key: sourceKey, p_token: deleteToken })
  });
  if (!response.ok) {
    const details = await response.text();
    if (details.includes("invalid_delete_session")) throw new Error("restore-session-invalid");
    throw new Error("restore-failed");
  }
  return response.json();
}

async function updateCloudStyle(sourceKey, category) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_desk_item_style`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_source_key: sourceKey, p_category: category })
  });
  if (!response.ok) throw new Error("style-update-failed");
  return response.json();
}

async function updateCloudCollection(sourceKey, collection) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_desk_item_collection`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_source_key: sourceKey, p_collection: collection })
  });
  if (!response.ok) throw new Error("collection-update-failed");
  return response.json();
}

async function insertCloudRow(record) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/desk_items`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error("cloud-insert-failed");
  return (await response.json())[0];
}

async function uploadOriginal(path, file) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/desk-images/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
    body: file
  });
  if (!response.ok) throw new Error("upload-failed");
  return `${SUPABASE_URL}/storage/v1/object/public/desk-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function loadCloudRows(silent = false) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/desk_items?select=*&order=created_at.asc`, { headers: apiHeaders() });
    if (!response.ok) throw new Error("cloud-read-failed");
    const nextRows = await response.json();
    const nextSignature = JSON.stringify(nextRows.map(row => [row.id, row.source_key, row.category, row.platform, row.deleted, row.deleted_at, row.updated_at, row.image_url]));
    if (nextSignature === remoteSignature) return;
    remoteSignature = nextSignature;
    remoteRows = nextRows;
    rebuildItems();
    render();
    setAdminUnlocked(isAdmin);
  } catch {
    if (!silent) showToast("云端数据加载失败，已显示基础图库");
  }
}

async function initCloud() {
  await loadCloudRows();
  setInterval(() => loadCloudRows(true), 10_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadCloudRows(true); });
}

async function initAdmin() {
  if (!deleteToken) return setAdminUnlocked(false);
  try {
    setAdminUnlocked(await validateAdminToken());
  } catch {
    setAdminUnlocked(false);
  }
  if (!isAdmin) {
    deleteToken = "";
    localStorage.removeItem(DELETE_TOKEN_KEY);
  }
}

filters.addEventListener("click", event => {
  const button = event.target.closest(".filter"); if (!button) return;
  activeCategory = button.dataset.category; savedOnly = false;
  resetRenderLimit();
  document.querySelector("#savedBtn").classList.remove("active");
  filters.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el === button)); render();
});

sourceFilters.addEventListener("click", event => {
  const button = event.target.closest(".source-filter"); if (!button) return;
  activeSource = button.dataset.source; savedOnly = false;
  resetRenderLimit();
  document.querySelector("#savedBtn").classList.remove("active");
  sourceFilters.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el === button));
  render();
});

function openCollectionEditor(item) {
  pendingCollectionKey = item.key;
  collectionEditSelect.value = sourceGroup(item);
  if (!collectionEditDialog.open) collectionEditDialog.showModal();
}

function clearLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressState?.wrap?.classList.remove("long-pressing");
  longPressState = null;
}

gallery.addEventListener("contextmenu", event => {
  const wrap = event.target.closest(".image-wrap");
  if (!wrap || event.target.closest("button")) return;
  event.preventDefault();
  clearLongPress();
  const item = items.find(entry => entry.key === wrap.closest(".card")?.dataset.key);
  if (item && !collectionEditDialog.open) openCollectionEditor(item);
});

gallery.addEventListener("pointerdown", event => {
  if (event.pointerType !== "touch" || event.target.closest("button")) return;
  const wrap = event.target.closest(".image-wrap");
  if (!wrap) return;
  clearLongPress();
  longPressState = { key: wrap.closest(".card")?.dataset.key, x: event.clientX, y: event.clientY, wrap };
  wrap.classList.add("long-pressing");
  longPressTimer = setTimeout(() => {
    const item = items.find(entry => entry.key === longPressState?.key);
    if (item) {
      suppressPhotoClickUntil = Date.now() + 1000;
      navigator.vibrate?.(30);
      openCollectionEditor(item);
    }
    clearLongPress();
  }, 650);
});

gallery.addEventListener("pointermove", event => {
  if (!longPressState) return;
  if (Math.hypot(event.clientX - longPressState.x, event.clientY - longPressState.y) > 12) clearLongPress();
});

["pointerup", "pointercancel", "pointerleave"].forEach(type => gallery.addEventListener(type, clearLongPress));

gallery.addEventListener("click", async event => {
  if (Date.now() < suppressPhotoClickUntil && event.target.closest(".image-wrap")) {
    event.preventDefault(); event.stopPropagation(); return;
  }
  const card = event.target.closest(".card"); if (!card) return;
  const item = items.find(entry => entry.key === card.dataset.key);
  if (!item) return;
  if (event.target.closest(".style-edit-btn")) {
    event.stopPropagation();
    pendingStyleKey = item.key;
    styleEditCategory.value = item.category;
    styleEditDialog.showModal();
    return;
  }
  if (event.target.closest(".delete-btn")) {
    event.stopPropagation();
    if (!isAdmin || !deleteToken) {
      pendingDeleteKey = item.key;
      deletePasswordDialog.showModal();
      document.querySelector("#deletePassword").focus();
      return;
    }
    if (!window.confirm(`确定删除这张${item.categoryName}图片吗？删除后将在回收站保留3天。`)) return;
    await performDelete(item, event.target.closest(".delete-btn")); return;
  }
  if (event.target.closest(".save")) {
    event.stopPropagation();
    saved.has(item.key) ? saved.delete(item.key) : saved.add(item.key); updateSaved(); render(); showToast(saved.has(item.key) ? "已加入收藏" : "已取消收藏"); return;
  }
  document.querySelector("#lightboxImage").src = item.image;
  document.querySelector("#lightboxImage").alt = item.title;
  document.querySelector("#lightboxNo").textContent = `${formatNo(item)} · ${item.categoryName}`;
  document.querySelector("#lightboxTitle").textContent = item.title;
  document.querySelector("#lightboxTags").textContent = (item.tags || []).filter(tag => !String(tag).startsWith("__")).join(" · ") + (item.uploadWidth ? ` · 上传尺寸 ${item.uploadWidth}×${item.uploadHeight}` : "");
  document.querySelector("#lightboxNote").textContent = item.note ? `备注：${item.note}` : "";
  document.querySelector("#originalLink").href = item.image;
  document.querySelector("#sourceLink").href = item.source || "#";
  document.querySelector("#sourceLink").hidden = !item.source || item.source === "#";
  lightbox.showModal();
});

addImageBtn.addEventListener("click", () => addImageDialog.showModal());
document.querySelector("#addCloseBtn").addEventListener("click", () => addImageDialog.close());
document.querySelector("#addCancelBtn").addEventListener("click", () => addImageDialog.close());
addImageDialog.addEventListener("click", event => { if (event.target === addImageDialog) addImageDialog.close(); });

function imageDimensions(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url); resolve(dimensions);
    };
    image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    image.src = url;
  });
}

async function createUploadPreview(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.55));
  if (!blob) throw new Error("preview-create-failed");
  return blob;
}

function safeFileName(name) {
  const extension = name.includes(".") ? `.${name.split(".").pop().toLowerCase()}` : "";
  return `original${extension.replace(/[^.a-z0-9]/g, "")}`;
}

addImageForm.addEventListener("submit", async event => {
  event.preventDefault();
  const file = imageFile.files[0];
  if (!file) { showToast("请先选择一张图片"); return; }
  if (file.size > 50 * 1024 * 1024) { showToast("单张原图不能超过 50MB"); return; }
  const category = categories.find(entry => entry.id === imageCategory.value);
  const collectionName = collectionNames[imageCollection.value];
  const submit = addImageForm.querySelector('[type="submit"]');
  const originalText = submit.textContent;
  submit.disabled = true; submit.textContent = "上传原图中…";
  const dimensions = await imageDimensions(file);
  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `public/${token}-${safeFileName(file.name)}`;
  const previewPath = `public/${token}-preview.jpg`;
  let publicUrl;
  let previewReady = false;
  try {
    const previewBlob = await createUploadPreview(file).catch(() => null);
    const uploads = [uploadOriginal(path, file)];
    if (previewBlob) uploads.push(uploadOriginal(previewPath, previewBlob).catch(() => null));
    const uploadResults = await Promise.all(uploads);
    publicUrl = uploadResults[0];
    previewReady = Boolean(uploadResults[1]);
  } catch {
    submit.disabled = false; submit.textContent = originalText;
    showToast("原图上传失败，请稍后重试"); return;
  }
  const sourceKey = `custom:${token}`;
  const record = {
    source_key: sourceKey,
    category: category.id,
    category_name: category.name,
    title: imageNote.value.trim() || `我的${category.name}桌搭`,
    tags: [category.name, ...(previewReady ? ["__fast_preview__"] : [])],
    ratio: dimensions.width && dimensions.height ? `${dimensions.width}/${dimensions.height}` : "4/5",
    image_url: publicUrl,
    source_url: imageSource.value.trim() || null,
    platform: imageCollection.value,
    note: imageNote.value.trim() || null,
    original_width: dimensions.width || null,
    original_height: dimensions.height || null,
    deleted: false
  };
  let data;
  try {
    data = await insertCloudRow(record);
  } catch {
    submit.disabled = false; submit.textContent = originalText;
    showToast("保存失败，请稍后重试"); return;
  }
  remoteRows.push(data);
  rebuildItems();
  addImageForm.reset(); addImageDialog.close(); activeCategory = "all"; activeSource = "all";
  resetRenderLimit();
  document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all"));
  document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all"));
  submit.disabled = false; submit.textContent = originalText;
  render(); showToast(`已同步添加到${collectionName} · ${category.name}`);
});

document.querySelector("#styleEditCloseBtn").addEventListener("click", () => styleEditDialog.close());
document.querySelector("#styleEditCancelBtn").addEventListener("click", () => styleEditDialog.close());
styleEditDialog.addEventListener("click", event => { if (event.target === styleEditDialog) styleEditDialog.close(); });
styleEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  const item = items.find(entry => entry.key === pendingStyleKey);
  if (!item) { styleEditDialog.close(); return; }
  const submit = styleEditForm.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = "保存中…";
  let savedRow;
  try {
    savedRow = await updateCloudStyle(item.key, styleEditCategory.value);
  } catch {
    submit.disabled = false; submit.textContent = "保存风格";
    showToast("风格修改失败，请稍后重试"); return;
  }
  const existing = remoteRows.find(row => row.source_key === item.key);
  if (existing) Object.assign(existing, savedRow); else remoteRows.push(savedRow);
  pendingStyleKey = "";
  styleEditDialog.close(); submit.disabled = false; submit.textContent = "保存风格";
  rebuildItems(); render(); showToast("风格已同步更新");
});

document.querySelector("#collectionEditCloseBtn").addEventListener("click", () => collectionEditDialog.close());
document.querySelector("#collectionEditCancelBtn").addEventListener("click", () => collectionEditDialog.close());
collectionEditDialog.addEventListener("click", event => { if (event.target === collectionEditDialog) collectionEditDialog.close(); });
collectionEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  const item = items.find(entry => entry.key === pendingCollectionKey);
  if (!item) { collectionEditDialog.close(); return; }
  const submit = collectionEditForm.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = "保存中…";
  let savedRow;
  try {
    savedRow = await updateCloudCollection(item.key, collectionEditSelect.value);
  } catch {
    submit.disabled = false; submit.textContent = "保存大区";
    showToast("大区调整失败，请稍后重试"); return;
  }
  const existing = remoteRows.find(row => row.source_key === item.key);
  if (existing) Object.assign(existing, savedRow); else remoteRows.push(savedRow);
  const destinationName = collectionNames[collectionEditSelect.value];
  pendingCollectionKey = "";
  collectionEditDialog.close(); submit.disabled = false; submit.textContent = "保存大区";
  rebuildItems(); render(); showToast(`已移动到${destinationName}`);
});

async function performDelete(item, button) {
  button.disabled = true;
  let savedRow;
  try {
    savedRow = await deleteCloudItem(item.key);
  } catch (error) {
    button.disabled = false;
    if (error.message === "delete-session-invalid") {
      deleteToken = "";
      localStorage.removeItem(DELETE_TOKEN_KEY);
      setAdminUnlocked(false);
      pendingDeleteKey = item.key;
      deletePasswordDialog.showModal();
      showToast("管理员登录已过期，请重新登录");
    } else {
      showToast("删除失败，请稍后重试");
    }
    return;
  }
  const existing = remoteRows.find(row => row.source_key === item.key);
  if (existing) Object.assign(existing, savedRow); else remoteRows.push(savedRow);
  saved.delete(item.key);
  updateSaved(); rebuildItems(); render(); setAdminUnlocked(true); showToast("已移入回收站，3天内可以恢复");
}

adminBtn.addEventListener("click", () => {
  pendingDeleteKey = "";
  if (isAdmin) {
    setAdminUnlocked(true);
    recycleBinDialog.showModal();
  } else {
    deletePasswordDialog.showModal();
    document.querySelector("#deletePassword").focus();
  }
});

document.querySelector("#recycleCloseBtn").addEventListener("click", () => recycleBinDialog.close());
document.querySelector("#recycleDoneBtn").addEventListener("click", () => recycleBinDialog.close());
recycleBinDialog.addEventListener("click", event => { if (event.target === recycleBinDialog) recycleBinDialog.close(); });
document.querySelector("#adminLogoutBtn").addEventListener("click", () => {
  deleteToken = "";
  localStorage.removeItem(DELETE_TOKEN_KEY);
  setAdminUnlocked(false);
  recycleBinDialog.close();
  showToast("已退出管理员");
});

recycleList.addEventListener("click", async event => {
  const button = event.target.closest(".restore-btn");
  if (!button) return;
  const sourceKey = button.closest(".recycle-item")?.dataset.key;
  if (!sourceKey) return;
  button.disabled = true;
  button.textContent = "恢复中…";
  let savedRow;
  try {
    savedRow = await restoreCloudItem(sourceKey);
  } catch (error) {
    button.disabled = false;
    button.textContent = "恢复";
    if (error.message === "restore-session-invalid") {
      deleteToken = "";
      localStorage.removeItem(DELETE_TOKEN_KEY);
      setAdminUnlocked(false);
      recycleBinDialog.close();
      showToast("管理员登录已过期，请重新登录");
    } else {
      showToast("图片已过期或恢复失败");
      await loadCloudRows(true);
      renderRecycle();
    }
    return;
  }
  const existing = remoteRows.find(row => row.source_key === sourceKey);
  if (existing) Object.assign(existing, savedRow); else remoteRows.push(savedRow);
  rebuildItems(); resetRenderLimit(); render(); setAdminUnlocked(true);
  showToast("图片已恢复并同步给所有访客");
});

document.querySelector("#deletePasswordCloseBtn").addEventListener("click", () => deletePasswordDialog.close());
document.querySelector("#deletePasswordCancelBtn").addEventListener("click", () => deletePasswordDialog.close());
deletePasswordDialog.addEventListener("click", event => { if (event.target === deletePasswordDialog) deletePasswordDialog.close(); });
deletePasswordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = deletePasswordForm.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = "验证中…";
  try {
    deleteToken = await unlockDeletion(document.querySelector("#deletePassword").value);
  } catch {
    submit.disabled = false; submit.textContent = "登录";
    showToast("管理员密码错误"); return;
  }
  localStorage.setItem(DELETE_TOKEN_KEY, deleteToken);
  deletePasswordForm.reset(); deletePasswordDialog.close();
  submit.disabled = false; submit.textContent = "登录";
  setAdminUnlocked(true);
  const item = items.find(entry => entry.key === pendingDeleteKey);
  pendingDeleteKey = "";
  showToast("管理员登录成功");
  if (item) {
    const button = gallery.querySelector(`[data-key="${CSS.escape(item.key)}"] .delete-btn`);
    if (button) await performDelete(item, button);
  } else {
    renderRecycle();
    recycleBinDialog.showModal();
  }
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { resetRenderLimit(); render(); }, 120);
});
loadMoreBtn.addEventListener("click", loadMore);
document.querySelector("#savedBtn").addEventListener("click", event => { savedOnly = !savedOnly; event.currentTarget.classList.toggle("active", savedOnly); resetRenderLimit(); render(); });
document.querySelector("#randomBtn").addEventListener("click", () => {
  const list = visibleItems();
  const item = list[Math.floor(Math.random() * list.length)];
  if (!item) return;
  const index = list.findIndex(entry => entry.key === item.key);
  if (index >= renderLimit) { renderLimit = index + 1; render(); }
  requestAnimationFrame(() => document.querySelector(`[data-key="${CSS.escape(item.key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
});
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
shortcutBtn.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (result.outcome === "accepted") showToast("已添加到桌面");
    return;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    showToast("已经在桌面应用中打开");
  } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    showToast("请点浏览器分享按钮，选择‘添加到主屏幕’");
  } else {
    showToast("请使用浏览器菜单选择‘安装桌面志’或‘添加到桌面’");
  }
});
document.querySelector("#clearBtn").addEventListener("click", () => { activeCategory = "all"; activeSource = "all"; savedOnly = false; searchInput.value = ""; resetRenderLimit(); document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all")); document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all")); render(); });
document.querySelector(".lightbox .close-btn").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
setInterval(() => { if (isAdmin) setAdminUnlocked(true); }, 60_000);
updateSaved(); rebuildItems(); render(); initAdmin(); initCloud();
