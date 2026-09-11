const storageKey = "shuttle_schedule_overrides";
const form = document.querySelector("#override-form");
const dateInput = document.querySelector("#override-date");
const typeInput = document.querySelector("#override-type");
const labelInput = document.querySelector("#override-label");
const list = document.querySelector("#override-list");
const toastContainer = document.querySelector("#toast-container");

function readOverrides() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  localStorage.setItem(storageKey, JSON.stringify(overrides));
}

function showToast(message) {
  toastContainer.replaceChildren();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.append(toast);
  window.setTimeout(() => toast.remove(), 2400);
}

function defaultLabel(type) {
  return type === "weekday" ? "临时启用工作日服务时刻表" : "临时启用周末服务时刻表";
}

function renderList() {
  const overrides = readOverrides();
  const entries = Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b));
  list.replaceChildren();

  if (!entries.length) {
    list.innerHTML = '<div class="empty-state"><strong>暂无临时排班</strong><p>添加后会显示在这里。</p></div>';
    return;
  }

  entries.forEach(([date, setting]) => {
    if (!setting || !["weekday", "weekend"].includes(setting.type)) return;
    const row = document.createElement("article");
    row.className = "override-row";
    const content = document.createElement("div");
    const dateEl = document.createElement("strong");
    dateEl.textContent = date;
    const detail = document.createElement("p");
    detail.textContent = `${setting.type === "weekday" ? "工作日时刻表" : "周末及节假日时刻表"} · ${setting.label || defaultLabel(setting.type)}`;
    content.append(dateEl, detail);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-remove-btn";
    remove.textContent = "撤销";
    remove.addEventListener("click", () => {
      const next = readOverrides();
      delete next[date];
      writeOverrides(next);
      renderList();
      showToast(`已撤销 ${date} 的临时排班`);
    });
    row.append(content, remove);
    list.append(row);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = dateInput.value;
  const type = typeInput.value;
  if (!date || !["weekday", "weekend"].includes(type)) return;
  const overrides = readOverrides();
  overrides[date] = { type, label: labelInput.value.trim() || defaultLabel(type) };
  writeOverrides(overrides);
  renderList();
  showToast(`${date} 已切换为${type === "weekday" ? "工作日" : "周末"}时刻表`);
});

document.querySelector("#clear-expired").addEventListener("click", () => {
  const today = new Date().toISOString().slice(0, 10);
  const overrides = readOverrides();
  let removed = 0;
  Object.keys(overrides).forEach((date) => {
    if (date < today) {
      delete overrides[date];
      removed += 1;
    }
  });
  writeOverrides(overrides);
  renderList();
  showToast(removed ? `已清除 ${removed} 条过期排班` : "没有可清除的过期排班");
});

renderList();
