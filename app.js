/**
 * 泰瑞府班车助手 · 核心业务控制器
 * 严格按照指定排序构建：顶部主标签页 -> 控制面板/方向切换 -> 对应视图
 */

// ==================== 班车时刻表数据 ====================
const schedules = {
  outbound: {
    title: "泰瑞府 → 道远楼东",
    detail: "从泰瑞府发车",
    weekday: [
      "07:05", "07:35", "08:05", "08:20", "08:35", "08:55", "09:05", "09:35",
      "10:05", "10:35", "11:05", "11:35", "12:05", "12:35", "12:55", "13:05",
      "13:15", "13:35", "13:50", "14:05", "14:35", "15:05", "15:35", "16:05",
      "16:35", "17:05", "17:35", "17:55", "18:05", "18:20", "18:35", "18:45",
      "19:05", "19:35", "20:05", "20:35", "21:05", "21:35", "22:05", "22:35"
    ],
    weekend: [
      "07:05", "07:35", "08:35", "09:35", "10:35", "11:35", "12:35", "13:35",
      "14:35", "15:35", "16:35", "17:35", "18:35", "19:35", "20:35", "21:35", "22:35"
    ]
  },
  return: {
    title: "道远楼东 → 泰瑞府",
    detail: "从道远楼东发车（经停张灵斌楼/综合教学楼）",
    secondaryLabel: "张灵斌楼到站",
    weekday: [
      ["07:58", "07:55"], ["08:28", "08:25"], ["08:58", "08:55"], ["09:28", "09:25"],
      ["09:58", "09:55"], ["10:28", "10:25"], ["10:58", "10:55"], ["11:28", "11:25"],
      ["11:58", "11:55"], ["12:13", "12:10"], ["12:28", "12:25"], ["12:43", "12:40"],
      ["12:58", "12:55"], ["13:28", "13:25"], ["13:58", "13:55"], ["14:28", "14:25"],
      ["14:58", "14:55"], ["15:28", "15:25"], ["15:58", "15:55"], ["16:28", "16:25"],
      ["16:58", "16:55"], ["17:13", "17:10"], ["17:28", "17:25"], ["17:43", "17:40"],
      ["17:58", "17:55"], ["18:28", "18:25"], ["18:58", "18:55"], ["19:28", "19:25"],
      ["19:58", "19:55"], ["20:28", "20:25"], ["20:58", "20:55"], ["21:13", "21:10"],
      ["21:28", "21:25"], ["21:43", "21:40"], ["21:58", "21:55"], ["22:28", "22:25"],
      ["22:58", "22:55"]
    ],
    weekend: [
      ["07:57", "07:55"], ["08:57", "08:55"], ["09:57", "09:55"], ["10:57", "10:55"],
      ["11:57", "11:55"], ["12:57", "12:55"], ["13:57", "13:55"], ["14:57", "14:55"],
      ["15:57", "15:55"], ["16:57", "16:55"], ["17:57", "17:55"], ["18:57", "18:55"],
      ["19:57", "19:55"], ["20:57", "20:55"], ["21:57", "21:55"], ["22:57", "22:55"]
    ]
  }
};

const returnStops = {
  daoyuan: { label: "道远楼东", offset: 0 },
  zhang: { label: "张灵斌楼", offset: 3 },
  teaching: { label: "综合教学楼", offset: 5 }
};

const holidayDates = new Set([
  "2026-09-25", "2026-10-01", "2026-10-02", "2026-10-03",
  "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"
]);
// 临时排班覆盖：优先级最高，可用于周末临时按工作日运行，或工作日临时按周末运行。
// 只需增加或删除一行日期；日期格式必须为 YYYY-MM-DD。
const temporaryScheduleOverrides = {
  "2026-09-20": { type: "weekday", label: "临时启用工作日服务时刻表" }
  // 示例："2026-10-10": { type: "weekday", label: "临时启用工作日服务时刻表" },
  // 示例："2026-10-12": { type: "weekend", label: "临时启用周末服务时刻表" }
};
const scheduleOverrideStorageKey = "shuttle_schedule_overrides";

function getSavedScheduleOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(scheduleOverrideStorageKey) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

// ==================== 辅助日期与计算函数 ====================
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getScheduleTypeInfo(date) {
  const key = dateKey(date);
  const weekend = isWeekend(date);
  // 后台保存的设置优先于代码中的预设，方便临时调整后即时生效。
  const temporaryOverride = getSavedScheduleOverrides()[key] || temporaryScheduleOverrides[key];

  // 临时通知应覆盖法定节假日、调休和星期几的默认判断。
  if (temporaryOverride) {
    return {
      type: temporaryOverride.type,
      desc: temporaryOverride.label || (temporaryOverride.type === "weekday" ? "工作日服务时刻表" : "周末及法定节假日时刻表")
    };
  }
  if (holidayDates.has(key)) {
    return { type: "weekend", desc: "周末及法定节假日时刻表" };
  }
  if (weekend) {
    return { type: "weekend", desc: "周末及法定节假日时刻表" };
  }
  return { type: "weekday", desc: "工作日服务时刻表" };
}

function getScheduleType(date) {
  return getScheduleTypeInfo(date).type;
}

function timeToday(time, now) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatRemaining(milliseconds) {
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes <= 0) return "即将发车";
  if (minutes < 60) return `${minutes} 分钟后`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}小时${m > 0 ? `${m}分` : ""}后`;
}

// ==================== 运行状态 ====================
let selectedDirection = "outbound";
let selectedReturnStop = "zhang";
let currentActiveDayType = getScheduleType(new Date());
let selectedQueryScheduleType = currentActiveDayType;

// ==================== DOM 元素 ====================
const timeElement = document.querySelector("#current-time");
const serviceDayElement = document.querySelector("#service-day");
const liveRemainingCountElement = document.querySelector("#live-remaining-count");
const routeTitleElement = document.querySelector("#route-title");
const routeDetailElement = document.querySelector("#route-detail");
const departureListElement = document.querySelector("#departure-list");
const boardingStopPicker = document.querySelector("#boarding-stop-picker");
const hourSelect = document.querySelector("#hour-select");
const scheduleTypeSelect = document.querySelector("#schedule-type-select");
const queryResult = document.querySelector("#query-result");
const toastContainer = document.querySelector("#toast-container");

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" });
const clockFormatter = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

let toastTimer = null;

function showToast(text) {
  if (!toastContainer) return;

  // 清除前一个未结束的提示与计时器，避免叠加堆积
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastContainer.replaceChildren();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  toastContainer.appendChild(toast);

  toastTimer = setTimeout(() => {
    toast.remove();
    toastTimer = null;
  }, 2400);
}

function updateClock(now = new Date()) {
  if (timeElement) {
    timeElement.textContent = `${dateFormatter.format(now)} · ${clockFormatter.format(now)}`;
  }
}

// ==================== 渲染实时发车视图 ====================
function render() {
  const now = new Date();
  const dayType = getScheduleType(now);
  const route = schedules[selectedDirection];
  const returnStop = returnStops[selectedReturnStop];

  const allBuses = route[dayType].map((entry) => {
    const [zhangLingBinTime, daoYuanTime] = Array.isArray(entry) ? entry : [null, entry];
    const time = daoYuanTime;
    const pickupTime = selectedDirection === "return"
      ? (selectedReturnStop === "zhang" ? zhangLingBinTime : addMinutes(daoYuanTime, returnStop.offset))
      : time;
    return {
      time: selectedDirection === "return" ? pickupTime : time,
      secondaryTime: selectedDirection === "return" && selectedReturnStop !== "daoyuan" ? daoYuanTime : null,
      pickup: timeToday(pickupTime, now)
    };
  });

  const upcoming = allBuses.filter(({ pickup }) => pickup >= now);

  updateClock(now);

  if (serviceDayElement) {
    const typeInfo = getScheduleTypeInfo(now);
    serviceDayElement.textContent = typeInfo.desc;
  }

  if (liveRemainingCountElement) {
    if (upcoming.length === 0) {
      liveRemainingCountElement.textContent = "已结束运营";
    } else if (upcoming.length === 1) {
      liveRemainingCountElement.textContent = "今日仅剩末班车";
    } else {
      liveRemainingCountElement.textContent = `今日还剩 ${upcoming.length} 班`;
    }
  }

  if (routeTitleElement) {
    routeTitleElement.textContent = route.title;
  }

  if (routeDetailElement) {
    routeDetailElement.textContent = selectedDirection === "return"
      ? `从道远楼东发车 · ${returnStop.label}上车`
      : route.detail;
  }

  if (boardingStopPicker) {
    boardingStopPicker.hidden = selectedDirection !== "return";
  }

  if (!departureListElement) return;
  departureListElement.replaceChildren();

  if (!upcoming.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state departure-card";
    empty.innerHTML = `
      <strong>今日班车已结束运营</strong>
      <p>请选择其他交通工具</p>
    `;
    departureListElement.append(empty);
    return;
  }

  // 1. 首选大卡片 (下一趟班车)
  const nextBus = upcoming[0];
  const remainingMs = nextBus.pickup - now;
  const isImminent = remainingMs <= 5 * 60 * 1000;
  const lastBusTime = allBuses[allBuses.length - 1].time;
  const isNextBusLast = nextBus.time === lastBusTime;

  let imminentMessage = "";
  if (isImminent) {
    if (selectedDirection === "outbound") {
      imminentMessage = "车辆即将发车";
    } else {
      imminentMessage = selectedReturnStop === "daoyuan" ? "车辆即将发车" : "车辆即将到站发车";
    }
  }

  const heroCard = document.createElement("article");
  heroCard.className = `departure-card hero-card ${isImminent ? "imminent" : ""}`;

  const orderBadgeHtml = isNextBusLast
    ? `<span class="order-badge last-bus-badge">今日末班车</span>`
    : `<span class="order-badge">第 1 趟</span>`;

  const lastBusBannerHtml = isNextBusLast
    ? `<div class="last-bus-banner">今日末班车，错过将无后续班车，请务必提前候车</div>`
    : "";

  heroCard.innerHTML = `
    <div class="card-top-row">
      <div class="departure-label">
        ${orderBadgeHtml}
        <span>${selectedDirection === "return" ? `${returnStop.label} 上车` : "泰瑞府发车"}</span>
      </div>
      <span class="departure-countdown">${formatRemaining(remainingMs)}</span>
    </div>
    <div class="departure-row">
      <div>
        <time class="departure-time">${nextBus.time}</time>
        ${selectedDirection === "outbound" ? `<p class="origin-departure">预计到校：${addMinutes(nextBus.time, 10)}</p>` : (nextBus.secondaryTime ? `<p class="origin-departure">道远楼东始发：${nextBus.secondaryTime}</p>` : "")}
      </div>
    </div>
    ${lastBusBannerHtml}
    ${isImminent ? `<p class="imminent-message">${imminentMessage}</p>` : ""}
  `;
  departureListElement.append(heroCard);

  // 2. 后续班次紧凑排列 (第 2 趟 和 第 3 趟)
  const subsequentBuses = upcoming.slice(1, 3);
  if (subsequentBuses.length > 0) {
    const subContainer = document.createElement("div");
    subContainer.className = "sub-departures-wrap";

    subsequentBuses.forEach((bus, index) => {
      const subCard = document.createElement("article");
      subCard.className = "departure-card sub-card";
      const diffMs = bus.pickup - now;
      subCard.innerHTML = `
        <div class="sub-card-left">
          ${bus.time === lastBusTime ? `<span class="sub-card-label" style="color:var(--rose);font-weight:800">后续 · 今日末班车</span>` : `<span class="sub-card-label">后续 · 第 ${index + 2} 趟</span>`}
          <time class="sub-card-time">${bus.time}</time>
          ${selectedDirection === "outbound" ? `<span style="font-size:0.7rem;color:var(--text-muted)">预计到校 ${addMinutes(bus.time, 10)}</span>` : (bus.secondaryTime ? `<span style="font-size:0.7rem;color:var(--text-muted)">始发 ${bus.secondaryTime}</span>` : "")}
        </div>
        <div class="sub-card-right">
          <span class="sub-card-countdown">${formatRemaining(diffMs)}</span>
        </div>
      `;
      subContainer.append(subCard);
    });
    departureListElement.append(subContainer);
  }
}

// ==================== 渲染班次查询视图 ====================
function getScheduleRows() {
  const now = new Date();
  const route = schedules[selectedDirection];
  const returnStop = returnStops[selectedReturnStop];
  const dayType = selectedQueryScheduleType === "weekday" ? "weekday" : "weekend";
  return route[dayType].map((entry) => {
    const [zhangTime, daoYuanTime] = Array.isArray(entry) ? entry : [null, entry];
    const primary = selectedDirection === "return"
      ? (selectedReturnStop === "zhang" ? zhangTime : addMinutes(daoYuanTime, returnStop.offset))
      : daoYuanTime;
    return {
      primary,
      source: selectedDirection === "return" && selectedReturnStop !== "daoyuan" ? daoYuanTime : null
    };
  });
}

function renderQuery() {
  if (!queryResult || !hourSelect) return;
  const routeTipEl = document.querySelector("#query-route-tip");
  if (routeTipEl) {
    const isOutbound = selectedDirection === "outbound";
    routeTipEl.hidden = !isOutbound;
    routeTipEl.style.display = isOutbound ? "flex" : "none";
  }
  const hourVal = hourSelect.value;
  const now = new Date();
  const todayType = getScheduleType(now);
  // 只有当查询目标为“今天”且选中的是今天对应的时刻表时，才做过去时间判断
  const isTodaySchedule = selectedQueryScheduleType === todayType;

  // 获取全天全部班次，算出当下真正的“下一班”发车时刻
  const allDayRows = getScheduleRows();
  let trueNextBusTime = null;
  if (isTodaySchedule) {
    const trueUpcoming = allDayRows.filter(({ primary }) => timeToday(primary, now) >= now);
    if (trueUpcoming.length > 0) {
      trueNextBusTime = trueUpcoming[0].primary;
    }
  }

  let rows = allDayRows;

  if (hourVal !== "all") {
    const [startHour, endHour] = hourVal.split("-").map(Number);
    rows = rows.filter(({ primary }) => {
      const hour = Number(primary.slice(0, 2));
      return hour >= startHour && hour <= endHour;
    });
  }


  queryResult.replaceChildren();

  if (!rows.length) {
    queryResult.innerHTML = `<div class="empty-state"><strong>该时段暂无匹配班次</strong><p>请尝试切换其他时段或关闭过滤条件。</p></div>`;
    return;
  }

  rows.forEach(({ primary, source }) => {
    const cell = document.createElement("div");
    cell.className = "query-cell";

    let statusText = "";
    const isTrueNext = isTodaySchedule && primary === trueNextBusTime;

    if (isTodaySchedule) {
      const difference = timeToday(primary, now) - now;
      if (difference < 0) {
        // 已发车班次：显示灰色时间与已发车小标
        statusText = "已发车";
        cell.classList.add("past");
      } else if (isTrueNext) {
        // 唯一下一班（最近班次）：醒目高亮并提示倒计时
        cell.classList.add("is-next");
        const minutes = Math.ceil(difference / 60000);
        statusText = minutes > 0 ? `最近 · ${minutes}分后` : "最近班次";
      }
      // 未来其他班次不印多余的“X小时X分后”，保持方格纯净极简
    }

    // 方格展示到站时间、经停站始发时间以及必要状态
    cell.innerHTML = `
      <time>${primary}</time>
      ${source ? `<span class="cell-origin">始发 ${source}</span>` : ""}
      ${statusText ? `<span class="cell-status">${statusText}</span>` : ""}
    `;

    cell.addEventListener("click", () => {
      let toastMsg = `班次时刻：${primary}`;
      if (source) toastMsg += `（道远楼东发车 ${source}）`;
      if (isTodaySchedule) {
        const diff = timeToday(primary, now) - now;
        if (diff < 0) {
          const m = Math.abs(Math.round(diff / 60000));
          toastMsg += ` · 已发车 ${m > 60 ? `${Math.floor(m / 60)}小时${m % 60}分` : `${m}分钟`}`;
        } else {
          toastMsg += ` · 距现在约 ${formatRemaining(diff)}`;
        }
      }
      showToast(toastMsg);
    });

    queryResult.append(cell);
  });
}

// ==================== 初始化与事件绑定 ====================
const hourGroups = [
  { label: "全天 (07:00 - 22:59)", value: "all" },
  { label: "07:00 - 08:59", value: "7-8" },
  { label: "09:00 - 11:59", value: "9-11" },
  { label: "12:00 - 14:59", value: "12-14" },
  { label: "15:00 - 17:59", value: "15-17" },
  { label: "18:00 - 20:59", value: "18-20" },
  { label: "21:00 - 22:59", value: "21-22" }
];

if (hourSelect) {
  hourGroups.forEach(({ label, value }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    hourSelect.append(option);
  });

  const currentHour = new Date().getHours();
  const defaultGroup = hourGroups.find(({ value }) => {
    if (value === "all") return false;
    const [s, e] = value.split("-").map(Number);
    return currentHour >= s && currentHour <= e;
  });
  hourSelect.value = defaultGroup ? defaultGroup.value : "all";
  hourSelect.addEventListener("change", renderQuery);
}

if (scheduleTypeSelect) {
  scheduleTypeSelect.value = selectedQueryScheduleType;
  scheduleTypeSelect.addEventListener("change", () => {
    selectedQueryScheduleType = scheduleTypeSelect.value;
    renderQuery();
  });
}


const quickNextBtn = document.querySelector("#btn-quick-next");
if (quickNextBtn) {
  quickNextBtn.addEventListener("click", () => {
    // 点击时瞬间亮起高光，随后渐变恢复，避免常亮引起歧义
    quickNextBtn.classList.add("flash");
    setTimeout(() => {
      quickNextBtn.classList.remove("flash");
      quickNextBtn.blur();
    }, 75);


    const now = new Date();
    const todayType = getScheduleType(now);
    const isTodaySchedule = selectedQueryScheduleType === todayType;

    // 跨日期类型校验
    if (!isTodaySchedule) {
      if (todayType === "weekday" && selectedQueryScheduleType === "weekend") {
        showToast("当下非周末时间");
        return;
      } else if (todayType === "weekend" && selectedQueryScheduleType === "weekday") {
        showToast("当下非工作日时间");
        return;
      }
    }

    const allRows = getScheduleRows();
    const upcoming = allRows.filter(({ primary }) => timeToday(primary, now) >= now);

    if (!upcoming.length) {
      showToast("今日班车已结束运营");
      return;
    }

    const targetBus = upcoming[0];
    const targetHour = Number(targetBus.primary.slice(0, 2));
    const matchedGroup = hourGroups.find(({ value }) => {
      if (value === "all") return false;
      const [s, e] = value.split("-").map(Number);
      return targetHour >= s && targetHour <= e;
    });

    if (matchedGroup) {
      hourSelect.value = matchedGroup.value;
      renderQuery();

      setTimeout(() => {
        const nextItem = queryResult.querySelector(".query-cell.is-next") ||
          Array.from(queryResult.querySelectorAll(".query-cell")).find(el => el.querySelector("time")?.textContent === targetBus.primary);

        if (nextItem) {
          nextItem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);

      showToast(`已定位至最近班次（${targetBus.primary}）`);
    } else {
      showToast(`已定位至最近班次（${targetBus.primary}）`);
    }
  });
}



// 胶囊按键切换：工作日 vs 周末及节假日
const pillWeekdayBtn = document.querySelector("#pill-weekday");
const pillWeekendBtn = document.querySelector("#pill-weekend");
if (pillWeekdayBtn && pillWeekendBtn) {
  pillWeekdayBtn.addEventListener("click", () => {
    selectedQueryScheduleType = "weekday";
    if (scheduleTypeSelect) scheduleTypeSelect.value = "weekday";
    syncPillButtons("weekday");
    renderQuery();
  });
  pillWeekendBtn.addEventListener("click", () => {
    selectedQueryScheduleType = "weekend";
    if (scheduleTypeSelect) scheduleTypeSelect.value = "weekend";
    syncPillButtons("weekend");
    renderQuery();
  });
}


// 主标签页切换 (实时班次 vs 班次查询)
document.querySelectorAll(".page-tab").forEach((button) => {
  button.addEventListener("click", () => {
    const live = button.dataset.page === "live";
    const liveView = document.querySelector("#live-view");
    const searchView = document.querySelector("#search-view");
    if (liveView) liveView.hidden = !live;
    if (searchView) searchView.hidden = live;

    document.querySelectorAll(".page-tab").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });

    if (!live) {
      // 切换至班次查询时，根据当前实际日期自动切换到工作日或周末时刻表
      const actualDayType = getScheduleType(new Date());
      selectedQueryScheduleType = actualDayType;
      if (scheduleTypeSelect) {
        scheduleTypeSelect.value = actualDayType;
      }
      syncPillButtons(actualDayType);
      renderQuery();
    }
  });
});

// 方向切换按钮
document.querySelectorAll(".direction-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDirection = button.dataset.direction;
    document.querySelectorAll(".direction-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
    renderQuery();
    showToast(`已切换方向：${schedules[selectedDirection].title}`);
  });
});

// 返程上车站选择按钮
document.querySelectorAll(".stop-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedReturnStop = button.dataset.stop;
    document.querySelectorAll(".stop-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
    renderQuery();
    showToast(`已设置上车站：${returnStops[selectedReturnStop].label}`);
  });
});

// 深色/浅色模式切换
const themeToggleBtn = document.querySelector("#theme-toggle");
if (themeToggleBtn) {
  const savedTheme = localStorage.getItem("shuttle_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("shuttle_theme", nextTheme);
    showToast(`已切换至${nextTheme === "dark" ? "深色" : "浅色"}模式`);
  });
}

// ==================== 统一心跳更新循环 ====================

function syncPillButtons(type) {
  const pillWd = document.querySelector("#pill-weekday");
  const pillWe = document.querySelector("#pill-weekend");
  if (pillWd && pillWe) {
    pillWd.classList.toggle("active", type === "weekday");
    pillWe.classList.toggle("active", type === "weekend");
  }
}

function updateApp() {
  const now = new Date();
  const detectedDayType = getScheduleType(now);

  updateClock(now);

  // 关键检测：若用户修改了系统时间到周末/工作日，毫秒级自动感应并切换！
  if (detectedDayType !== currentActiveDayType) {
    currentActiveDayType = detectedDayType;
    selectedQueryScheduleType = detectedDayType;
    if (scheduleTypeSelect) {
      scheduleTypeSelect.value = detectedDayType;
    }
    syncPillButtons(detectedDayType);
    render();
    renderQuery();
    showToast(`系统时间已调整，已自动切换至${detectedDayType === "weekend" ? "周末时刻表" : "工作日时刻表"}`);
    return;
  }

  // 刷新实时发车卡片
  render();

  // 若当前正在查看“班次查询”视图，也同步刷新相对时长和状态
  const searchView = document.querySelector("#search-view");
  if (searchView && !searchView.hidden) {
    renderQuery();
  }
}

// 初始化执行
function initApp() {
  const now = new Date();
  selectedReturnStop = "zhang";
  document.querySelectorAll(".stop-button").forEach((btn) => {
    const isZhang = btn.getAttribute("data-stop") === "zhang";
    btn.classList.toggle("active", isZhang);
    btn.setAttribute("aria-pressed", String(isZhang));
  });
  currentActiveDayType = getScheduleType(now);
  selectedQueryScheduleType = currentActiveDayType;
  if (scheduleTypeSelect) {
    scheduleTypeSelect.value = currentActiveDayType;
  }
  syncPillButtons(currentActiveDayType);
  updateClock(now);
  render();
  renderQuery();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

setInterval(updateApp, 1000);
