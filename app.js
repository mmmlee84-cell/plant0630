/* ───────────────────────────────────────────────────────────
   초록일지 — 내 식물 돌봄 노트  (vanilla JS)
   대시보드 / 사진 기록 / 물주기 일정 관리 · localStorage 저장
─────────────────────────────────────────────────────────── */

/* ── 저장소 (localStorage) ── */
const KEY_INDEX = "chorok:plants";
const KEY_JOURNAL = (id) => `chorok:journal:${id}`;

function loadPlants() {
  try { return JSON.parse(localStorage.getItem(KEY_INDEX)) || null; }
  catch { return null; }
}
function savePlants() {
  try { localStorage.setItem(KEY_INDEX, JSON.stringify(state.plants)); }
  catch (e) { console.error("저장 실패:", e); alert("저장 공간이 부족합니다. 사진 수를 줄여보세요."); }
}
function loadJournal(id) {
  try { return JSON.parse(localStorage.getItem(KEY_JOURNAL(id))) || []; }
  catch { return []; }
}
function saveJournal(id, entries) {
  try { localStorage.setItem(KEY_JOURNAL(id), JSON.stringify(entries)); }
  catch (e) { console.error(e); alert("저장 공간이 부족합니다. 사진 용량을 줄여보세요."); }
}
function deleteJournal(id) { localStorage.removeItem(KEY_JOURNAL(id)); }

/* ── 날짜 유틸 ── */
const DAY = 86400000;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const toISO = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromISO = (s) => new Date(s + "T00:00:00").getTime();
const daysSince = (iso) => Math.floor((today0() - fromISO(iso)) / DAY);
function fmtKDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
}

/* ── 식물 상태 계산 ── */
function status(p) {
  const since = daysSince(p.lastWatered);
  const left = p.interval - since;
  return {
    since, left,
    moisture: Math.max(0, 1 - since / p.interval),
    due: left <= 0,
    overdue: left < 0,
  };
}

/* ── 이미지 리사이즈 → base64 (저장 용량 절감) ── */
function fileToThumb(file, max = 560, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = (h * max) / w; w = max; }
        else if (h > max) { w = (w * max) / h; h = max; }
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── 안전한 텍스트 삽입 ── */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── SVG 컴포넌트 ── */
function moistureRing(moisture, overdue, size = 52) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, moisture));
  const color = overdue ? "var(--dry)" : moisture < 0.34 ? "var(--sun)" : "var(--water)";
  const label = overdue ? "물 줄 시기 지남" : `흙 수분 ${Math.round(filled * 100)}%`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none" aria-label="${label}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - filled)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .5s ease,stroke .3s"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
      font-family="var(--mono)" font-size="${size * 0.26}" fill="${color}" font-weight="600">
      ${overdue ? "!" : Math.round(filled * 100)}</text>
  </svg>`;
}
const PLANT_IMG_MAP = [
  { keys: ["알스토니"], file: "img/알스토니.jpg" },
  { keys: ["덴드로비움","덴드로","난초","den"], file: "img/den.jpg" },
  { keys: ["세덤","sedum","돌나물","다육"], file: "img/sedum.jpg" },
  { keys: ["sed","세드"], file: "img/sed.jpg" },
];

function speciesImg(species) {
  const s = species.toLowerCase();
  for (const { keys, file } of PLANT_IMG_MAP) {
    if (keys.some((k) => s.includes(k.toLowerCase()))) return file;
  }
  return null;
}

function plantPlaceholder(seed = 0, size = 84) {
  const greens = ["#16C653", "#0FA843", "#1AAD55", "#13954A"];
  const g = greens[seed % greens.length];
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M30 78 L70 78 L65 96 L35 96 Z" fill="var(--soil)" opacity=".9"/>
    <rect x="30" y="74" width="40" height="6" rx="2" fill="#7a5a45"/>
    <path d="M50 74 C50 50 50 40 50 36" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M50 52 C36 50 28 40 26 28 C42 30 50 40 50 52Z" fill="${g}"/>
    <path d="M50 46 C64 44 72 33 75 22 C58 24 50 35 50 46Z" fill="${g}" opacity=".85"/>
    <path d="M50 40 C50 28 50 20 50 14 C58 20 58 30 50 40Z" fill="${g}" opacity=".7"/>
  </svg>`;
}

/* ── 예시 데이터 ── */
function seedPlants() {
  const t = today0();
  return [
    { id: "p1", name: "몬순", species: "몬스테라 델리시오사", acquired: toISO(t - 80 * DAY), interval: 7, lastWatered: toISO(t - 6 * DAY), seed: 0 },
    { id: "p2", name: "올리브", species: "올리브 나무", acquired: toISO(t - 200 * DAY), interval: 10, lastWatered: toISO(t - 11 * DAY), seed: 1 },
    { id: "p3", name: "솜이", species: "스투키", acquired: toISO(t - 30 * DAY), interval: 14, lastWatered: toISO(t - 3 * DAY), seed: 3 },
  ];
}

/* ── 상태 ── */
const state = { plants: [], journalCache: {}, seeded: false };
const $ = (sel) => document.querySelector(sel);
const modalRoot = () => $("#modalRoot");

function journalOf(id) {
  if (!(id in state.journalCache)) state.journalCache[id] = loadJournal(id);
  return state.journalCache[id];
}

/* ── 초기화 ── */
function init() {
  const stored = loadPlants();
  if (stored) {
    state.plants = stored;
  } else {
    state.plants = seedPlants();
    state.seeded = true;
    savePlants();
  }
  $("#seedNote").hidden = !state.seeded;
  render();
}

/* ── 렌더: 대시보드 ── */
function render() {
  const withS = state.plants.map((p) => ({ ...p, s: status(p) }));
  const due = withS.filter((p) => p.s.due).sort((a, b) => a.s.left - b.s.left);

  // 오늘 칩
  const chipText = $("#todayChipText");
  const dot = $("#todayChip .pj-dot");
  if (due.length) { chipText.textContent = `오늘 물 줄 식물 ${due.length}`; dot.style.background = "var(--sun)"; }
  else { chipText.textContent = "오늘은 다 촉촉해요"; dot.style.background = "var(--leaf)"; }

  // 오늘 할 일
  const today = $("#todayList");
  if (due.length === 0) {
    today.innerHTML = `<div class="pj-empty-today"><span style="font-size:18px">🌿</span>물 줄 식물이 없어요. 모두 잘 자라고 있습니다.</div>`;
  } else {
    today.innerHTML = due.map((p) => `
      <div class="pj-taskrow ${p.s.overdue ? "overdue" : ""}">
        ${moistureRing(p.s.moisture, p.s.overdue, 44)}
        <div style="min-width:0">
          <div class="pj-task-name">${esc(p.name)} <span class="sp"> · ${esc(p.species)}</span></div>
          <div class="pj-task-sub">${p.s.since}일 전에 물 줌</div>
        </div>
        <div class="pj-task-meta">
          <span class="pj-status ${p.s.overdue ? "over" : "due"}">${p.s.overdue ? Math.abs(p.s.left) + "일 지남" : "오늘"}</span>
          <button class="pj-btn pj-btn-water" data-water="${p.id}">물 줬어요</button>
        </div>
      </div>`).join("");
  }

  // 내 식물 그리드
  $("#plantsEyebrow").textContent = `내 식물 · ${state.plants.length}`;
  const grid = $("#plantGrid");
  grid.innerHTML = withS.map((p) => {
    const j = journalOf(p.id);
    const photos = j.filter((e) => e.photo);
    const cover = photos[0]?.photo || speciesImg(p.species);
    const waterLine = p.s.overdue ? `물주기 ${Math.abs(p.s.left)}일 지남`
      : p.s.due ? "오늘 물 주기" : `${p.s.left}일 뒤 물주기`;
    return `
      <div class="pj-card" role="button" tabindex="0" data-open="${p.id}">
        <div class="pj-thumb">
          ${cover ? `<img src="${cover}" alt="${esc(p.name)}"/>` : `<div class="pj-thumb-ph">${plantPlaceholder(p.seed ?? 0)}</div>`}
          ${photos.length ? `<span class="pj-photocount">사진 ${photos.length}</span>` : ""}
        </div>
        <div class="pj-card-body">
          <div class="pj-card-info">
            <div class="pj-card-name">${esc(p.name)}</div>
            <div class="pj-card-species">${esc(p.species)}</div>
            <div class="pj-card-water">${waterLine}</div>
          </div>
          ${moistureRing(p.s.moisture, p.s.overdue)}
        </div>
      </div>`;
  }).join("") + `
    <button class="pj-add" id="addPlantBtn">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      식물 추가
    </button>`;
}

/* ── 동작 ── */
function waterNow(id) {
  const p = state.plants.find((x) => x.id === id);
  if (!p) return;
  p.lastWatered = toISO(today0());
  savePlants();
  render();
  // 상세가 열려 있으면 갱신
  if (openDetailId === id) renderDetail();
}

/* ── 모달: 닫기 헬퍼 ── */
function closeModal() { modalRoot().innerHTML = ""; openDetailId = null; }
function mountScrim(innerHTML) {
  modalRoot().innerHTML = `<div class="pj-scrim"><div class="pj-modal" role="dialog" aria-modal="true">${innerHTML}</div></div>`;
  const scrim = $(".pj-scrim");
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ── 식물 추가 모달 ── */
function openAddPlant() {
  mountScrim(`
    <div class="pj-modal-pad">
      <div class="pj-modal-head">
        <div>
          <p class="pj-eyebrow" style="margin:0">새 식물</p>
          <h2 class="pj-modal-title">식물 등록</h2>
        </div>
        <button class="pj-x" data-close aria-label="닫기">×</button>
      </div>
      <label class="pj-field"><span class="pj-label">애칭</span>
        <input class="pj-input" id="ap-name" placeholder="예: 몬순" autofocus></label>
      <label class="pj-field"><span class="pj-label">종류</span>
        <input class="pj-input" id="ap-species" placeholder="예: 몬스테라 델리시오사"></label>
      <div class="pj-row2">
        <label class="pj-field"><span class="pj-label">물주기 주기 (일)</span>
          <input class="pj-input" id="ap-interval" type="number" min="1" value="7"></label>
        <label class="pj-field"><span class="pj-label">들인 날</span>
          <input class="pj-input" id="ap-acquired" type="date" value="${toISO(today0())}"></label>
      </div>
      <div class="pj-actions">
        <button class="pj-btn pj-btn-ghost" data-close>취소</button>
        <button class="pj-btn pj-btn-leaf" id="ap-submit" disabled>등록하기</button>
      </div>
    </div>`);

  const name = $("#ap-name"), submit = $("#ap-submit");
  name.addEventListener("input", () => { submit.disabled = !name.value.trim(); });
  name.focus();
  submit.addEventListener("click", () => {
    if (!name.value.trim()) return;
    state.plants.push({
      id: "p" + Date.now().toString(36),
      name: name.value.trim(),
      species: $("#ap-species").value.trim() || "이름 모를 식물",
      acquired: $("#ap-acquired").value || toISO(today0()),
      interval: Math.max(1, Number($("#ap-interval").value) || 7),
      lastWatered: toISO(today0()),
      seed: Math.floor(Math.random() * 4),
    });
    savePlants();
    closeModal();
    render();
  });
}

/* ── 식물 상세 모달 ── */
let openDetailId = null;
let pendingThumb = null;

function openDetail(id) {
  openDetailId = id;
  pendingThumb = null;
  renderDetail();
}

function renderDetail() {
  const p = state.plants.find((x) => x.id === openDetailId);
  if (!p) return closeModal();
  const s = status(p);
  const entries = journalOf(p.id);

  const nextText = s.overdue ? `${Math.abs(s.left)}일 지남` : s.due ? "오늘" : `${s.left}일 뒤`;
  const nextColor = s.overdue ? "var(--dry)" : s.due ? "var(--sun)" : "var(--ink)";

  const timeline = entries.length === 0
    ? `<p class="pj-journal-empty">아직 기록이 없어요. 첫 사진을 남겨 변화를 추적해보세요.</p>`
    : `<div class="pj-timeline">${entries.map((e) => `
        <div class="pj-entry">
          <div class="pj-entry-date">${fmtKDate(e.date)}</div>
          ${e.photo ? `<div class="pj-entry-photo"><img src="${e.photo}" alt="${fmtKDate(e.date)}"/></div>` : ""}
          ${e.note ? `<div class="pj-entry-note">${esc(e.note)}</div>` : ""}
        </div>`).join("")}</div>`;

  mountScrim(`
    <div class="pj-detail-hero">
      ${moistureRing(s.moisture, s.overdue, 64)}
      <div style="flex:1;min-width:0">
        <div class="pj-detail-name">${esc(p.name)}</div>
        <div class="pj-detail-species">${esc(p.species)}</div>
      </div>
      <button class="pj-x" data-close aria-label="닫기">×</button>
    </div>
    <div class="pj-modal-pad">
      <div class="pj-detail-stats">
        <div class="pj-stat">마지막 급수<b>${s.since}일 전</b></div>
        <div class="pj-stat">다음 급수<b style="color:${nextColor}">${nextText}</b></div>
        <div class="pj-stat">물주기 주기
          <div id="intWrap"><b class="editable" id="intLabel">${p.interval}일마다 ✎</b></div>
        </div>
      </div>

      <div style="margin-top:16px"><button class="pj-btn pj-btn-water" id="d-water">오늘 물 줬어요</button></div>

      <p class="pj-eyebrow" style="margin-top:26px">성장 기록 남기기</p>
      <div class="pj-uploader">
        <img class="pj-preview" id="d-preview" style="${pendingThumb ? "" : "display:none"}" src="${pendingThumb || ""}" alt="미리보기">
        <button class="pj-btn pj-btn-ghost" id="d-pick">📷 ${pendingThumb ? "사진 변경" : "사진 선택"}</button>
        <input type="file" id="d-file" accept="image/*" hidden>
        <input class="pj-input" id="d-date" type="date" value="${toISO(today0())}" style="width:160px">
      </div>
      <textarea class="pj-textarea" id="d-note" style="margin-top:10px" placeholder="새 잎이 났어요 / 분갈이 함 / 잎끝이 마름… 오늘의 메모"></textarea>
      <div style="margin-top:10px"><button class="pj-btn pj-btn-leaf" id="d-add" disabled>기록 추가</button></div>

      <p class="pj-eyebrow" style="margin-top:26px">성장 일지</p>
      ${timeline}

      <div style="margin-top:26px;padding-top:16px;border-top:1px solid var(--line)">
        <button class="pj-btn pj-btn-danger" id="d-delete">식물 삭제</button>
      </div>
    </div>`);

  // 물주기
  $("#d-water").addEventListener("click", () => waterNow(p.id));

  // 주기 인라인 편집
  $("#intLabel").addEventListener("click", () => {
    $("#intWrap").innerHTML = `<div class="pj-intedit">
      <input class="pj-input" id="intInput" type="number" min="1" value="${p.interval}" style="width:64px;padding:4px 8px">
      <button class="pj-btn pj-btn-leaf" id="intSave" style="padding:5px 10px">저장</button></div>`;
    $("#intInput").focus();
    $("#intSave").addEventListener("click", () => {
      p.interval = Math.max(1, Number($("#intInput").value) || p.interval);
      savePlants(); render(); renderDetail();
    });
  });

  // 사진 선택
  const fileInput = $("#d-file");
  $("#d-pick").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    $("#d-pick").textContent = "불러오는 중…";
    try {
      pendingThumb = await fileToThumb(f);
      const prev = $("#d-preview");
      prev.src = pendingThumb; prev.style.display = "";
      $("#d-pick").textContent = "📷 사진 변경";
      updateAddState();
    } catch { $("#d-pick").textContent = "📷 사진 선택"; }
  });

  // 기록 추가 활성화
  const noteEl = $("#d-note"), addBtn = $("#d-add");
  function updateAddState() { addBtn.disabled = !pendingThumb && !noteEl.value.trim(); }
  noteEl.addEventListener("input", updateAddState);
  addBtn.addEventListener("click", () => {
    if (!pendingThumb && !noteEl.value.trim()) return;
    const entry = { id: "e" + Date.now().toString(36), date: $("#d-date").value, photo: pendingThumb, note: noteEl.value.trim() };
    const list = [entry, ...journalOf(p.id)];
    state.journalCache[p.id] = list;
    saveJournal(p.id, list);
    pendingThumb = null;
    render();       // 표지/사진 수 갱신
    renderDetail(); // 타임라인 갱신
  });

  // 삭제
  $("#d-delete").addEventListener("click", () => {
    if (confirm(`'${p.name}' 기록을 삭제할까요?`)) {
      state.plants = state.plants.filter((x) => x.id !== p.id);
      deleteJournal(p.id);
      delete state.journalCache[p.id];
      savePlants();
      closeModal();
      render();
    }
  });
}

/* ── 이벤트 위임 ── */
document.addEventListener("click", (e) => {
  const water = e.target.closest("[data-water]");
  if (water) { waterNow(water.dataset.water); return; }

  const open = e.target.closest("[data-open]");
  if (open) { openDetail(open.dataset.open); return; }

  if (e.target.closest("#addPlantBtn")) { openAddPlant(); return; }
  if (e.target.closest("[data-close]")) { closeModal(); return; }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest && e.target.closest("[data-open]");
    if (card && document.activeElement === card) { e.preventDefault(); openDetail(card.dataset.open); }
  }
});

init();
