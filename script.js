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
const cloud = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true }
});
let remoteRows = [];
let items = [...sourceItems];
let currentUser = null;
let activeCategory = "all";
let activeSource = "all";
let savedOnly = false;

const gallery = document.querySelector("#gallery");
const filters = document.querySelector("#filters");
const searchInput = document.querySelector("#searchInput");
const sourceFilters = document.querySelector("#sourceFilters");
const lightbox = document.querySelector("#lightbox");
const addImageBtn = document.querySelector("#addImageBtn");
const addImageDialog = document.querySelector("#addImageDialog");
const addImageForm = document.querySelector("#addImageForm");
const imageFile = document.querySelector("#imageFile");
const imageCategory = document.querySelector("#imageCategory");
const imageNote = document.querySelector("#imageNote");
const imageSource = document.querySelector("#imageSource");
const authBtn = document.querySelector("#authBtn");
const authDialog = document.querySelector("#authDialog");
const authForm = document.querySelector("#authForm");

categories.forEach(category => {
  const button = document.createElement("button");
  button.className = `filter${category.id === "all" ? " active" : ""}`;
  button.type = "button";
  button.dataset.category = category.id;
  button.textContent = category.name;
  filters.append(button);
});

categories.filter(category => category.id !== "all").forEach(category => {
  const option = document.createElement("option");
  option.value = category.id;
  option.textContent = category.name;
  imageCategory.append(option);
});

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

function visibleItems() {
  const term = searchInput.value.trim().toLowerCase();
  return items.filter(item => {
    const categoryMatch = activeCategory === "all" || item.category === activeCategory;
    const textMatch = !term || [item.title, item.categoryName, ...(item.tags || [])].join(" ").toLowerCase().includes(term);
    const sourceMatch = activeSource === "all" || (activeSource === "other" ? item.platform !== "xiaohongshu-latest" : item.platform === activeSource);
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

function cardTemplate(item) {
  const active = saved.has(item.key) ? " active" : "";
  const height = Math.round(310 / evalRatio(item.ratio));
  return `<article class="card loading" data-key="${escapeHtml(item.key)}">
    <div class="image-wrap" style="aspect-ratio:${validRatio(item.ratio)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}桌搭灵感" loading="lazy" width="620" height="${height}" />
      <span class="num">${formatNo(item)}</span>
      <button class="delete-btn" type="button" aria-label="删除图片">⌫</button>
    </div>
    <div class="card-body style-only-body"><div><span class="style-label style-only-label">${escapeHtml(item.categoryName)}</span></div><button class="save${active}" type="button" aria-label="收藏">${active ? "♥" : "♡"}</button></div>
  </article>`;
}

function render() {
  const list = visibleItems();
  gallery.innerHTML = list.map(cardTemplate).join("");
  document.querySelector("#imageTotal").textContent = items.length;
  document.querySelector("#footerCount").textContent = items.length;
  document.querySelector("#resultCount").textContent = list.length;
  document.querySelector('[data-source="xiaohongshu-latest"] b').textContent = items.filter(item => item.platform === "xiaohongshu-latest").length;
  document.querySelector('[data-source="other"] b').textContent = items.filter(item => item.platform !== "xiaohongshu-latest").length;
  const xhsCount = items.filter(item => item.platform === "xiaohongshu" || item.platform === "xiaohongshu-latest").length;
  document.querySelector("#xhsTotal").textContent = xhsCount;
  document.querySelector("#footerXhsCount").textContent = xhsCount;
  const sourceTitle = activeSource === "xiaohongshu-latest" ? " · 常用桌搭" : activeSource === "other" ? " · 其他桌搭" : "";
  document.querySelector("#resultTitle").textContent = savedOnly ? "我的收藏" : categories.find(c => c.id === activeCategory).name + (activeCategory === "all" ? "灵感" : "桌搭") + sourceTitle;
  document.querySelector("#emptyState").hidden = list.length > 0;
  gallery.querySelectorAll("img").forEach(img => {
    if (img.complete && img.naturalWidth) img.closest(".card").classList.remove("loading");
    img.addEventListener("load", () => img.closest(".card").classList.remove("loading"));
    img.addEventListener("error", () => img.closest(".card").classList.add("image-error"));
  });
}

function updateSaved() {
  localStorage.setItem("deskSaved", JSON.stringify([...saved]));
  document.querySelector("#savedCount").textContent = saved.size;
}

function updateAuthUI() {
  const signedIn = Boolean(currentUser);
  document.body.classList.toggle("is-admin", signedIn);
  authBtn.classList.toggle("active", signedIn);
  authBtn.textContent = signedIn ? "退出管理" : "管理员登录";
}

function requestAdmin() {
  if (!cloud) {
    showToast("云端服务暂时不可用");
    return false;
  }
  if (!currentUser) {
    authDialog.showModal();
    showToast("请先完成管理员登录");
    return false;
  }
  return true;
}

async function loadCloudRows(silent = false) {
  if (!cloud) return;
  const { data, error } = await cloud.from("desk_items").select("*").order("created_at", { ascending: true });
  if (error) {
    if (!silent) showToast("云端数据加载失败，已显示基础图库");
    return;
  }
  remoteRows = data || [];
  rebuildItems();
  render();
}

async function initCloud() {
  if (!cloud) {
    updateAuthUI();
    return;
  }
  const { data } = await cloud.auth.getSession();
  currentUser = data.session?.user || null;
  updateAuthUI();
  await loadCloudRows();
  cloud.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    if (currentUser && authDialog.open) authDialog.close();
  });
  cloud.channel("desk-items-global")
    .on("postgres_changes", { event: "*", schema: "public", table: "desk_items" }, () => loadCloudRows(true))
    .subscribe();
}

filters.addEventListener("click", event => {
  const button = event.target.closest(".filter"); if (!button) return;
  activeCategory = button.dataset.category; savedOnly = false;
  document.querySelector("#savedBtn").classList.remove("active");
  filters.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el === button)); render();
});

sourceFilters.addEventListener("click", event => {
  const button = event.target.closest(".source-filter"); if (!button) return;
  activeSource = button.dataset.source; savedOnly = false;
  document.querySelector("#savedBtn").classList.remove("active");
  sourceFilters.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el === button));
  render();
});

gallery.addEventListener("click", async event => {
  const card = event.target.closest(".card"); if (!card) return;
  const item = items.find(entry => entry.key === card.dataset.key);
  if (!item) return;
  if (event.target.closest(".delete-btn")) {
    event.stopPropagation();
    if (!requestAdmin()) return;
    if (!window.confirm(`确定从所有访客的网站中删除这张${item.categoryName}图片吗？`)) return;
    const button = event.target.closest(".delete-btn");
    button.disabled = true;
    const record = {
      source_key: item.key,
      legacy_id: typeof item.id === "number" ? item.id : null,
      deleted: true,
      updated_at: new Date().toISOString()
    };
    const { error } = await cloud.from("desk_items").upsert(record, { onConflict: "source_key" });
    if (error) {
      button.disabled = false;
      showToast("删除失败，请确认使用站长邮箱登录");
      return;
    }
    const existing = remoteRows.find(row => row.source_key === item.key);
    if (existing) existing.deleted = true; else remoteRows.push(record);
    saved.delete(item.key);
    updateSaved(); rebuildItems(); render(); showToast("已同步删除，所有访客均会更新"); return;
  }
  if (event.target.closest(".save")) {
    event.stopPropagation();
    saved.has(item.key) ? saved.delete(item.key) : saved.add(item.key); updateSaved(); render(); showToast(saved.has(item.key) ? "已加入收藏" : "已取消收藏"); return;
  }
  document.querySelector("#lightboxImage").src = item.image;
  document.querySelector("#lightboxImage").alt = item.title;
  document.querySelector("#lightboxNo").textContent = `${formatNo(item)} · ${item.categoryName}`;
  document.querySelector("#lightboxTitle").textContent = item.title;
  document.querySelector("#lightboxTags").textContent = (item.tags || []).join(" · ") + (item.uploadWidth ? ` · 上传尺寸 ${item.uploadWidth}×${item.uploadHeight}` : "");
  document.querySelector("#lightboxNote").textContent = item.note ? `备注：${item.note}` : "";
  document.querySelector("#originalLink").href = item.image;
  document.querySelector("#sourceLink").href = item.source || "#";
  document.querySelector("#sourceLink").hidden = !item.source || item.source === "#";
  lightbox.showModal();
});

addImageBtn.addEventListener("click", () => { if (requestAdmin()) addImageDialog.showModal(); });
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

function safeFileName(name) {
  const extension = name.includes(".") ? `.${name.split(".").pop().toLowerCase()}` : "";
  return `original${extension.replace(/[^.a-z0-9]/g, "")}`;
}

addImageForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requestAdmin()) return;
  const file = imageFile.files[0];
  if (!file) { showToast("请先选择一张图片"); return; }
  if (file.size > 50 * 1024 * 1024) { showToast("单张原图不能超过 50MB"); return; }
  const category = categories.find(entry => entry.id === imageCategory.value);
  const submit = addImageForm.querySelector('[type="submit"]');
  const originalText = submit.textContent;
  submit.disabled = true; submit.textContent = "上传原图中…";
  const dimensions = await imageDimensions(file);
  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${currentUser.id}/${token}-${safeFileName(file.name)}`;
  const upload = await cloud.storage.from("desk-images").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upload.error) {
    submit.disabled = false; submit.textContent = originalText;
    showToast("原图上传失败，请稍后重试"); return;
  }
  const { data: publicData } = cloud.storage.from("desk-images").getPublicUrl(path);
  const sourceKey = `custom:${token}`;
  const record = {
    source_key: sourceKey,
    category: category.id,
    category_name: category.name,
    title: imageNote.value.trim() || `我的${category.name}桌搭`,
    tags: [category.name],
    ratio: dimensions.width && dimensions.height ? `${dimensions.width}/${dimensions.height}` : "4/5",
    image_url: publicData.publicUrl,
    source_url: imageSource.value.trim() || null,
    platform: "custom",
    note: imageNote.value.trim() || null,
    original_width: dimensions.width || null,
    original_height: dimensions.height || null,
    deleted: false
  };
  const { data, error } = await cloud.from("desk_items").insert(record).select().single();
  if (error) {
    await cloud.storage.from("desk-images").remove([path]);
    submit.disabled = false; submit.textContent = originalText;
    showToast("保存失败，请确认使用站长邮箱登录"); return;
  }
  remoteRows.push(data);
  rebuildItems();
  addImageForm.reset(); addImageDialog.close(); activeCategory = "all"; activeSource = "all";
  document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all"));
  document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all"));
  submit.disabled = false; submit.textContent = originalText;
  render(); showToast(`已同步添加到${category.name}`);
});

authBtn.addEventListener("click", async () => {
  if (currentUser) {
    await cloud.auth.signOut();
    showToast("已退出管理模式");
  } else {
    authDialog.showModal();
  }
});
document.querySelector("#authCloseBtn").addEventListener("click", () => authDialog.close());
document.querySelector("#authCancelBtn").addEventListener("click", () => authDialog.close());
authDialog.addEventListener("click", event => { if (event.target === authDialog) authDialog.close(); });
authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!cloud) { showToast("云端服务暂时不可用"); return; }
  const submit = authForm.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = "发送中…";
  const email = document.querySelector("#authEmail").value.trim();
  const { error } = await cloud.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}${location.pathname}` }
  });
  submit.disabled = false; submit.textContent = "发送登录链接";
  if (error) { showToast("登录链接发送失败"); return; }
  authDialog.close(); showToast("登录链接已发送，请查看邮箱");
});

searchInput.addEventListener("input", render);
document.querySelector("#savedBtn").addEventListener("click", event => { savedOnly = !savedOnly; event.currentTarget.classList.toggle("active", savedOnly); render(); });
document.querySelector("#randomBtn").addEventListener("click", () => { const item = items[Math.floor(Math.random() * items.length)]; if (item) document.querySelector(`[data-key="${CSS.escape(item.key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
document.querySelector("#clearBtn").addEventListener("click", () => { activeCategory = "all"; activeSource = "all"; savedOnly = false; searchInput.value = ""; document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all")); document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all")); render(); });
document.querySelector(".lightbox .close-btn").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

updateSaved(); rebuildItems(); render(); initCloud();
