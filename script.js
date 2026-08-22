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

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const deletedIds = new Set(readLocalArray("deskDeletedIds"));
const customItems = readLocalArray("deskCustomItems");
let items = [...baseItems.filter(item => !removedBaseIds.has(item.id)), ...xhsItems, ...xhsLatestItems].filter(item => !deletedIds.has(item.id)).concat(customItems);

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
const saved = new Set(JSON.parse(localStorage.getItem("deskSaved") || "[]"));
let activeCategory = "all";
let activeSource = "all";
let savedOnly = false;

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

function visibleItems() {
  const term = searchInput.value.trim().toLowerCase();
  return items.filter(item => {
    const categoryMatch = activeCategory === "all" || item.category === activeCategory;
    const textMatch = !term || [item.title, item.categoryName, ...item.tags].join(" ").toLowerCase().includes(term);
    const sourceMatch = activeSource === "all" || (activeSource === "other" ? item.platform !== "xiaohongshu-latest" : item.platform === activeSource);
    return categoryMatch && sourceMatch && textMatch && (!savedOnly || saved.has(item.id));
  });
}

function cardTemplate(item) {
  const active = saved.has(item.id) ? " active" : "";
  const height = Math.round(310 / evalRatio(item.ratio));
  return `<article class="card loading" data-id="${item.id}">
    <div class="image-wrap" style="aspect-ratio:${item.ratio}">
      <img src="${item.image}" alt="${item.title}桌搭灵感" loading="lazy" width="620" height="${height}" />
      <span class="num">NO.${String(item.id).padStart(3, "0")}</span>
      <button class="delete-btn" type="button" aria-label="删除图片">⌫</button>
    </div>
    <div class="card-body style-only-body"><div><span class="style-label style-only-label">${item.categoryName}</span></div><button class="save${active}" type="button" aria-label="收藏">${active ? "♥" : "♡"}</button></div>
  </article>`;
}

function evalRatio(ratio) { const [a, b] = ratio.split("/").map(Number); return a / b; }

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
    img.addEventListener("load", () => img.closest(".card").classList.remove("loading"));
    img.addEventListener("error", () => img.closest(".card").classList.add("image-error"));
  });
}

function updateSaved() {
  localStorage.setItem("deskSaved", JSON.stringify([...saved]));
  document.querySelector("#savedCount").textContent = saved.size;
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

gallery.addEventListener("click", event => {
  const card = event.target.closest(".card"); if (!card) return;
  const item = items.find(entry => entry.id === Number(card.dataset.id));
  if (event.target.closest(".delete-btn")) {
    event.stopPropagation();
    if (!window.confirm(`确定删除这张${item.categoryName}图片吗？`)) return;
    deletedIds.add(item.id);
    items = items.filter(entry => entry.id !== item.id);
    localStorage.setItem("deskDeletedIds", JSON.stringify([...deletedIds]));
    const customIndex = customItems.findIndex(entry => entry.id === item.id);
    if (customIndex >= 0) {
      customItems.splice(customIndex, 1);
      localStorage.setItem("deskCustomItems", JSON.stringify(customItems));
    }
    saved.delete(item.id); updateSaved(); render(); showToast("图片已删除"); return;
  }
  if (event.target.closest(".save")) {
    event.stopPropagation(); saved.has(item.id) ? saved.delete(item.id) : saved.add(item.id); updateSaved(); render(); showToast(saved.has(item.id) ? "已加入收藏" : "已取消收藏"); return;
  }
  document.querySelector("#lightboxImage").src = item.image;
  document.querySelector("#lightboxImage").alt = item.title;
  document.querySelector("#lightboxNo").textContent = `NO.${String(item.id).padStart(3, "0")} · ${item.categoryName}`;
  document.querySelector("#lightboxTitle").textContent = item.title;
  document.querySelector("#lightboxTags").textContent = item.tags.join(" · ") + (item.uploadWidth ? ` · 上传尺寸 ${item.uploadWidth}×${item.uploadHeight}` : "");
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

addImageForm.addEventListener("submit", event => {
  event.preventDefault();
  const file = imageFile.files[0];
  if (!file) { showToast("请先选择一张图片"); return; }
  const category = categories.find(entry => entry.id === imageCategory.value);
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const id = Math.max(0, ...items.map(entry => entry.id)) + 1;
      const item = {
        id,
        category: category.id,
        categoryName: category.name,
        title: imageNote.value.trim() || `我的${category.name}桌搭`,
        tags: ["我的添加", category.name],
        ratio: `${image.naturalWidth}/${image.naturalHeight}`,
        image: reader.result,
        source: imageSource.value.trim() || "",
        platform: "custom",
        note: imageNote.value.trim(),
        uploadWidth: image.naturalWidth,
        uploadHeight: image.naturalHeight
      };
      items.push(item); customItems.push(item);
      try {
        localStorage.setItem("deskCustomItems", JSON.stringify(customItems));
      } catch {
        items = items.filter(entry => entry.id !== item.id);
        customItems.pop();
        showToast("图片太大，当前浏览器无法保存");
        return;
      }
      addImageForm.reset(); addImageDialog.close(); activeCategory = "all"; activeSource = "all";
      document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all"));
      document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all"));
      render(); showToast(`已添加到${category.name}`);
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

searchInput.addEventListener("input", render);
document.querySelector("#savedBtn").addEventListener("click", event => { savedOnly = !savedOnly; event.currentTarget.classList.toggle("active", savedOnly); render(); });
document.querySelector("#randomBtn").addEventListener("click", () => { const item = items[Math.floor(Math.random() * items.length)]; document.querySelector(`[data-id="${item.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
document.querySelector("#clearBtn").addEventListener("click", () => { activeCategory = "all"; activeSource = "all"; savedOnly = false; searchInput.value = ""; document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el.dataset.category === "all")); document.querySelectorAll(".source-filter").forEach(el => el.classList.toggle("active", el.dataset.source === "all")); render(); });
document.querySelector(".close-btn").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });

function showToast(message) { const toast = document.querySelector("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 1600); }
updateSaved(); render();
