import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, } from "recharts";
const DOWNLOAD_COLS = [
    { id: "spend", label: "소진금액", group: "광고 지표" },
    { id: "impressions", label: "노출수", group: "광고 지표" },
    { id: "clicks", label: "클릭수", group: "광고 지표" },
    { id: "cpc", label: "평균 CPC 클릭단가", group: "광고 지표" },
];
const COL_GROUPS = ["광고 지표", "행동 지표", "상품권"];
const FIXED_FIELDS = [
    { key: "date", label: "날짜", description: "데이터가 집계된 날짜입니다." },
    { key: "spend", label: "소진금액", description: "선택한 날짜에 광고를 통해 실제 사용된 비용입니다." },
    { key: "impressions", label: "노출수", description: "광고가 사용자 화면에 노출된 횟수입니다." },
    { key: "clicks", label: "클릭수", description: "노출된 광고를 사용자가 클릭한 횟수입니다." },
    { key: "cpc", label: "평균 CPC 클릭단가", description: "광고 클릭 1회당 평균으로 발생한 광고 비용입니다." },
];
const EXTRA_FIELDS = [
    { key: "photoViews", label: "사진 조회", description: "매장 사진을 조회한 횟수입니다." },
    { key: "reviewViews", label: "리뷰 조회", description: "매장 리뷰를 조회한 횟수입니다." },
    { key: "addressViews", label: "주소 조회", description: "매장 주소를 확인한 횟수입니다." },
    { key: "saves", label: "즐겨찾기", description: "사용자가 매장을 즐겨찾기에 추가한 횟수입니다." },
    { key: "storeViews", label: "매장 조회", description: "매장 상세 페이지를 조회한 횟수입니다." },
    { key: "voucherViews", label: "상품권 조회", description: "상품권 정보를 조회한 횟수입니다." },
    { key: "phoneViews", label: "전화 조회", description: "매장 전화번호를 확인한 횟수입니다." },
    { key: "menuViews", label: "추천메뉴 조회", description: "추천 메뉴를 조회한 횟수입니다." },
    { key: "shares", label: "공유", description: "매장 또는 광고를 공유한 횟수입니다." },
    { key: "promotionClaims", label: "핫이벤트 수령", description: "핫이벤트 혜택을 수령한 횟수입니다." },
    { key: "voucherOrders", label: "상품권 판매량", description: "상품권 판매가 발생한 횟수입니다." },
];
// ─── Mock Data ────────────────────────────────────────────────────────────────
const STORES = [
    { id: "9000193", name: "일편등심 강남점", balance: 3500 },
    { id: "9000194", name: "일편등심 명동점", balance: 4280 },
    { id: "9000195", name: "일편등심 홍대점", balance: 2970 },
    { id: "9000211", name: "서울갈비 여의도점", balance: 5120 },
    { id: "9000237", name: "한상차림 성수점", balance: 1880 },
];
function generateData(days, seed) {
    const result = [];
    const now = new Date(2026, 7, 18);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const base = seed * 0.8 + Math.sin(i * 0.4 + seed) * seed * 0.2;
        const spike = i === Math.floor(days * 0.6) || i === Math.floor(days * 0.3);
        const impressions = Math.round((base * 1800 + (spike ? base * 900 : 0)) * (0.85 + Math.random() * 0.3));
        const ctr = +(((spike ? 3.8 : 2.1) + Math.random() * 1.4) / 100).toFixed(4);
        const clicks = Math.round(impressions * ctr);
        const cpc = +(0.28 + Math.random() * 0.16 - (spike ? 0.08 : 0)).toFixed(2);
        const spend = +(clicks * cpc).toFixed(2);
        let anomaly;
        if (spike && i === Math.floor(days * 0.6))
            anomaly = "clicks";
        if (spike && i === Math.floor(days * 0.3))
            anomaly = "spend";
        result.push({
            date: dateStr, dateKey, impressions, clicks, spend, cpc, anomaly,
            photoViews: Math.round(clicks * 0.72), reviewViews: Math.round(clicks * 0.48),
            addressViews: Math.round(clicks * 0.31), saves: Math.round(clicks * 0.18),
            storeViews: Math.round(clicks * 0.82), voucherViews: Math.round(clicks * 0.22),
            phoneViews: Math.round(clicks * 0.12), menuViews: Math.round(clicks * 0.35),
            shares: Math.round(clicks * 0.08), promotionClaims: Math.round(clicks * 0.11),
            voucherOrders: Math.round(clicks * 0.05), orders: Math.round(clicks * 0.09),
        });
    }
    return result;
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtNum(n) { return n.toLocaleString("ko-KR"); }
function fmtYuan(n) { return `${n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}위안`; }
function fmtVal(metric, v) {
    if (metric === "spend" || metric === "cpc")
        return fmtYuan(v);
    return `${fmtNum(v)}회`;
}
function sumData(data) {
    return data.reduce((acc, d) => ({ impressions: acc.impressions + d.impressions, clicks: acc.clicks + d.clicks, spend: acc.spend + d.spend }), { impressions: 0, clicks: 0, spend: 0 });
}
function avgData(data) {
    const s = sumData(data);
    return { ...s, cpc: +(s.spend / (s.clicks || 1)).toFixed(2) };
}
// ─── InfoTooltip ──────────────────────────────────────────────────────────────
function InfoTooltip({ text }) {
    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [position, setPosition] = useState(null);
    const ref = useRef(null);
    const show = hovered || pinned;
    function updatePosition() {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect)
            return;
        const tooltipHalfWidth = 120;
        setPosition({
            top: rect.top - 8,
            left: Math.min(window.innerWidth - tooltipHalfWidth - 8, Math.max(tooltipHalfWidth + 8, rect.left + rect.width / 2)),
        });
    }
    return (<span className="inline-flex items-center" onMouseEnter={() => { updatePosition(); setHovered(true); }} onMouseLeave={() => setHovered(false)}>
      <button ref={ref} type="button" aria-label="컬럼 설명" aria-expanded={show} onClick={(event) => { event.stopPropagation(); updatePosition(); setPinned((value) => !value); }} className="text-[#c4c9d4] hover:text-[#2563eb] cursor-help transition-colors text-[11px] leading-none">ⓘ</button>
      {show && position && createPortal(<span role="tooltip" className="fixed pointer-events-none" style={{ top: position.top, left: position.left, transform: "translate(-50%, -100%)", zIndex: 9999 }}>
          <span className="block w-60 rounded-lg bg-[#1e2330] text-white text-[11px] leading-[1.55] px-3 py-2.5 shadow-2xl whitespace-normal">
            {text}
          </span>
          <span className="block mx-auto mt-0" style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid #1e2330",
                marginLeft: "auto",
                marginRight: "auto",
                position: "relative",
                left: 0,
            }}/>
        </span>, document.body)}
    </span>);
}
// ─── DownloadModal ────────────────────────────────────────────────────────────
function DownloadModal({ store, platform, dateRange, onClose, }) {
    const [selected, setSelected] = useState(new Set(["spend", "impressions", "clicks", "cpc", "ctr"]));
    const [downloading, setDownloading] = useState(false);
    const allIds = DOWNLOAD_COLS.map((c) => c.id);
    const allSelected = allIds.every((id) => selected.has(id));
    function toggle(id) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    function selectAll() { setSelected(new Set(allIds)); }
    function clearAll() { setSelected(new Set()); }
    const dateLabel = dateRange === "today" ? "오늘" :
        dateRange === "7d" ? "최근 7일" :
            dateRange === "30d" ? "최근 30일" : "직접 설정";
    function handleDownload() {
        if (selected.size === 0)
            return;
        setDownloading(true);
        setTimeout(() => {
            setDownloading(false);
            onClose();
        }, 1200);
    }
    return (<div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-[440px] max-w-[calc(100vw-2rem)] flex flex-col">
        {/* Modal header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#f3f4f6]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0f1117]">다운로드할 데이터 선택</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                {store.name} · {platform} · {dateLabel}
              </p>
            </div>
            <button onClick={onClose} className="text-[#9ca3af] hover:text-[#6b7280] transition-colors text-lg leading-none mt-0.5">
              ✕
            </button>
          </div>
          {/* Select all / clear */}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={selectAll} className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${allSelected
            ? "bg-[#eff6ff] text-[#2563eb]"
            : "text-[#6b7280] hover:bg-[#f3f4f6]"}`}>
              전체 선택
            </button>
            <button onClick={clearAll} className="text-xs font-medium px-2.5 py-1 rounded-md text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
              선택 초기화
            </button>
            <span className="ml-auto text-xs text-[#9ca3af]">
              {selected.size}개 선택됨
            </span>
          </div>
        </div>

        {/* Column groups */}
        <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto max-h-[360px]">
          {COL_GROUPS.map((group) => {
            const cols = DOWNLOAD_COLS.filter((c) => c.group === group);
            return (<div key={group}>
                <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">{group}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {cols.map((col) => {
                    const checked = selected.has(col.id);
                    return (<label key={col.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${checked
                            ? "border-[#2563eb] bg-[#eff6ff]"
                            : "border-[#e4e7ed] bg-white hover:border-[#93c5fd]"}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${checked
                            ? "bg-[#2563eb] border-[#2563eb]"
                            : "border-[#d1d5db] bg-white"}`}>
                          {checked && (<svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>)}
                        </span>
                        <span className={`text-xs font-medium ${checked ? "text-[#1d4ed8]" : "text-[#374151]"}`}>
                          {col.label}
                        </span>
                      </label>);
                })}
                </div>
              </div>);
        })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f3f4f6] flex items-center justify-between">
          <p className="text-xs text-[#9ca3af]">
            날짜 컬럼은 항상 포함됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
              취소
            </button>
            <button onClick={handleDownload} disabled={selected.size === 0 || downloading} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${selected.size === 0
            ? "bg-[#e5e7eb] text-[#9ca3af] cursor-not-allowed"
            : downloading
                ? "bg-[#2563eb] text-white opacity-70"
                : "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"}`}>
              {downloading ? (<>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"/>
                  처리 중...
                </>) : (<>
                  <span>⬇</span> Excel 다운로드
                </>)}
            </button>
          </div>
        </div>
      </div>
    </div>);
}
function KpiCard({ label, value }) {
    return (<div className="bg-white border border-[#e4e7ed] rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <span className="text-sm font-medium text-[#6b7280]">{label}</span>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight text-[#0f1117]">{value}</span>
      </div>
    </div>);
}
const METRIC_CONFIG = {
    impressions: { label: "노출수", color: "#2563eb", format: (v) => `${fmtNum(v)}회` },
    clicks: { label: "클릭수", color: "#7c3aed", format: (v) => `${fmtNum(v)}회` },
    spend: { label: "소진금액", color: "#d97706", format: fmtYuan },
    cpc: { label: "평균 CPC 클릭단가", color: "#059669", format: fmtYuan },
};
const METRIC_ORDER = ["impressions", "clicks", "spend", "cpc"];
function ChartTooltip({ active, payload, label, metric, anomalyDates }) {
    if (!active || !payload?.length)
        return null;
    const isAnomaly = label ? anomalyDates.has(label) : false;
    return (<div className="bg-white border border-[#e4e7ed] rounded-lg shadow-lg px-3.5 py-3 text-sm min-w-[140px]">
      <p className="text-[#6b7280] font-medium mb-1.5">{label}</p>
      <p className="font-semibold text-[#0f1117]">{fmtVal(metric, payload[0].value)}</p>
      {isAnomaly && <p className="text-xs text-[#d97706] mt-1 font-medium">⚠ 이상 변화 감지</p>}
    </div>);
}
function PerformanceChart({ metric, data, anomalyDates, anomalyRows, height = 240, }) {
    const config = METRIC_CONFIG[metric];
    return (<ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "DM Mono" }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(data.length / 8) - 1)}/>
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "DM Mono" }} axisLine={false} tickLine={false} tickFormatter={(value) => config.format(value)} width={64}/>
        <Tooltip content={<ChartTooltip metric={metric} anomalyDates={anomalyDates}/>}/>
        {anomalyRows.map((row) => (<ReferenceLine key={row.date} x={row.date} stroke={config.color} strokeDasharray="4 4" strokeOpacity={0.35}/>))}
        <Line type="monotone" dataKey={metric} stroke={config.color} strokeWidth={2} dot={(props) => {
            const { cx, cy, payload } = props;
            if (payload.anomaly)
                return <circle key={payload.date} cx={cx} cy={cy} r={4} fill={config.color} stroke="white" strokeWidth={2}/>;
            return <circle key={payload.date} cx={cx} cy={cy} r={0} fill="transparent"/>;
        }} activeDot={{ r: 5, strokeWidth: 2, stroke: "white", fill: config.color }}/>
      </LineChart>
    </ResponsiveContainer>);
}
// ─── Table column definitions ─────────────────────────────────────────────────
// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
    const [storeSearch, setStoreSearch] = useState("");
    const [selectedStore, setSelectedStore] = useState(STORES[0]);
    const [activeMetric, setActiveMetric] = useState("all");
    const [sortCol, setSortCol] = useState("date");
    const [sortDir, setSortDir] = useState("desc");
    const [storeOpen, setStoreOpen] = useState(false);
    const [dateOpen, setDateOpen] = useState(false);
    const [startDate, setStartDate] = useState("2026-05-21");
    const [endDate, setEndDate] = useState("2026-08-18");
    const [fieldOpen, setFieldOpen] = useState(false);
    const [selectedFields, setSelectedFields] = useState(new Set());
    const seed = STORES.indexOf(selectedStore) + 1;
    const allData = useMemo(() => generateData(90, seed), [seed]);
    const currentData = useMemo(() => allData.filter((row) => row.dateKey >= startDate && row.dateKey <= endDate), [allData, startDate, endDate]);
    const curr = avgData(currentData);
    const anomalyDates = useMemo(() => new Set(currentData.filter((d) => d.anomaly).map((d) => d.date)), [currentData]);
    const anomalyRows = useMemo(() => currentData.filter((d) => d.anomaly), [currentData]);
    const sortedData = useMemo(() => {
        return [...currentData].sort((a, b) => {
            const av = sortCol === "date" ? a.dateKey : a[sortCol];
            const bv = sortCol === "date" ? b.dateKey : b[sortCol];
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [currentData, sortCol, sortDir]);
    function handleSort(col) {
        if (sortCol === col)
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortCol(col);
            setSortDir("desc");
        }
    }
    const filteredStores = STORES.filter((s) => {
        const query = storeSearch.trim().toLowerCase();
        return s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
    });
    const kpis = [
        { label: "잔액", value: `${fmtNum(selectedStore.balance)}위안` },
        { label: "소진금액", value: fmtYuan(curr.spend) },
        { label: "노출수", value: `${fmtNum(curr.impressions)}회` },
        { label: "클릭수", value: `${fmtNum(curr.clicks)}회` },
        { label: "평균 CPC 클릭단가", value: fmtYuan(curr.cpc) },
    ];
    const visibleFields = [
        ...FIXED_FIELDS,
        ...EXTRA_FIELDS.filter((field) => selectedFields.has(field.key)),
    ];
    const dateLabel = `${startDate.split("-").join(".")} ~ ${endDate.split("-").join(".")}`;
    function toggleField(key) {
        setSelectedFields((previous) => {
            const next = new Set(previous);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }
    function formatTableValue(row, key) {
        if (key === "date")
            return row.date;
        if (key === "spend" || key === "cpc")
            return fmtYuan(row[key]);
        const value = row[key];
        return typeof value === "number" ? `${fmtNum(value)}회` : "-";
    }
    function downloadCsv() {
        const header = ["매장명", "매장 ID", ...visibleFields.map((field) => field.label)];
        const rows = sortedData.map((row) => [
            selectedStore.name,
            selectedStore.id,
            ...visibleFields.map((field) => formatTableValue(row, field.key)),
        ]);
        const csv = [header, ...rows]
            .map((line) => line.map((value) => `"${String(value).split('"').join('""')}"`).join(","))
            .join("\n");
        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedStore.name}_${selectedStore.id}_광고데이터.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return (<div className="min-h-screen bg-[#f8f9fb] font-sans">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-14 bg-white border-r border-[#e4e7ed] flex flex-col items-center py-5 gap-5 shrink-0">
          <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white text-xs font-bold">A</div>
          {[
            { icon: "▤", title: "대시보드", active: true },
            { icon: "⊞", title: "매장 목록", active: false },
            { icon: "◑", title: "보고서", active: false },
            { icon: "⚙", title: "설정", active: false },
        ].map((item) => (<button key={item.title} title={item.title} className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${item.active ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"}`}>
              {item.icon}
            </button>))}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="bg-white border-b border-[#e4e7ed] px-6 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9ca3af]">광고 성과 분석</span>
              <span className="text-xs text-[#d1d5db]">/</span>
              <span className="text-xs font-medium text-[#0f1117]">대시보드</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#16a34a]"></div>
              <span className="text-xs text-[#6b7280]">광고 정상 운영 중</span>
              <span className="text-xs text-[#d1d5db] mx-1">|</span>
              <span className="text-xs text-[#9ca3af]">마지막 업데이트: 2026.08.18 14:32</span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {/* Filter bar */}
            <div className="bg-white border border-[#e4e7ed] rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-3">
              {/* Store selector */}
              <div className="relative">
                <button onClick={() => setStoreOpen((v) => !v)} className="flex items-center gap-2 px-3 py-2 border border-[#e4e7ed] rounded-lg text-sm text-[#0f1117] bg-white hover:border-[#2563eb] transition-colors min-w-[220px] sm:min-w-[260px] justify-between">
                  <span className="font-medium truncate">{selectedStore.name}</span>
                  <span className="text-[#9ca3af] text-xs">▾</span>
                </button>
                {storeOpen && (<div className="absolute top-full left-0 mt-1 bg-white border border-[#e4e7ed] rounded-lg shadow-lg z-20 w-72">
                    <div className="p-2 border-b border-[#f3f4f6]">
                      <input value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="매장명 또는 매장 ID 검색" className="w-full text-sm px-2.5 py-1.5 border border-[#e4e7ed] rounded-md outline-none focus:border-[#2563eb] text-[#0f1117] placeholder-[#9ca3af]"/>
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredStores.map((s) => (<button key={s.id} onClick={() => { setSelectedStore(s); setStoreOpen(false); setStoreSearch(""); }} className={`w-full text-left px-3 py-2 text-sm transition-colors ${s.id === selectedStore.id ? "bg-[#eff6ff] text-[#2563eb] font-medium" : "text-[#0f1117] hover:bg-[#f9fafb]"}`}>
                          <div>{s.name}</div>
                          <div className="text-xs text-[#9ca3af] mt-0.5">ID: {s.id}</div>
                        </button>))}
                    </div>
                  </div>)}
              </div>

              <div className="relative flex flex-wrap items-center gap-2">
                <button onClick={() => setDateOpen((value) => !value)} className={`px-3.5 py-2 border rounded-lg text-xs font-medium transition-colors ${dateOpen ? "border-[#2563eb] text-[#2563eb] bg-[#eff6ff]" : "border-[#e4e7ed] text-[#6b7280] hover:border-[#2563eb] hover:text-[#2563eb]"}`}>
                  직접설정
                </button>
                <span className="px-3 py-2 rounded-lg bg-[#f9fafb] text-xs font-mono text-[#6b7280] whitespace-nowrap">{dateLabel}</span>
                {dateOpen && (<div className="absolute left-0 top-full mt-2 z-30 bg-white border border-[#e4e7ed] rounded-xl shadow-xl p-4 w-[300px] max-w-[calc(100vw-3rem)]">
                    <p className="text-xs font-semibold text-[#0f1117] mb-3">조회 기간 설정</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-[#6b7280]">
                        시작일
                        <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} onInput={(event) => setStartDate(event.currentTarget.value)} className="mt-1 w-full px-2 py-2 border border-[#e4e7ed] rounded-lg text-xs text-[#0f1117] outline-none focus:border-[#2563eb]"/>
                      </label>
                      <label className="text-[11px] text-[#6b7280]">
                        종료일
                        <input type="date" value={endDate} min={startDate} max="2026-08-18" onChange={(event) => setEndDate(event.target.value)} onInput={(event) => setEndDate(event.currentTarget.value)} className="mt-1 w-full px-2 py-2 border border-[#e4e7ed] rounded-lg text-xs text-[#0f1117] outline-none focus:border-[#2563eb]"/>
                      </label>
                    </div>
                    <button onClick={() => setDateOpen(false)} className="mt-3 w-full py-2 rounded-lg bg-[#2563eb] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors">
                      적용
                    </button>
                  </div>)}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {kpis.map(({ label, value }) => (<KpiCard key={label} label={label} value={value}/>))}
            </div>

            {/* Chart section */}
            <div className="bg-white border border-[#e4e7ed] rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#0f1117]">광고 성과 추이</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {selectedStore.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="chart-metric" className="text-xs font-medium text-[#6b7280]">광고지표</label>
                  <select id="chart-metric" value={activeMetric} onChange={(event) => setActiveMetric(event.target.value)} className="min-w-[160px] px-3 py-2 border border-[#e4e7ed] rounded-lg bg-white text-xs font-medium text-[#0f1117] outline-none focus:border-[#2563eb]">
                    <option value="all">전체</option>
                    {METRIC_ORDER.map((key) => (<option key={key} value={key}>{METRIC_CONFIG[key].label}</option>))}
                  </select>
                </div>
              </div>

              {activeMetric === "all" ? (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {METRIC_ORDER.map((metric) => (<div key={metric} className="border border-[#e4e7ed] rounded-xl p-4 bg-[#fcfcfd] min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_CONFIG[metric].color }}/>
                        <h3 className="text-xs font-semibold text-[#374151]">{METRIC_CONFIG[metric].label} 추이</h3>
                      </div>
                      <PerformanceChart metric={metric} data={currentData} anomalyDates={anomalyDates} anomalyRows={anomalyRows} height={210}/>
                    </div>))}
                </div>) : (<PerformanceChart metric={activeMetric} data={currentData} anomalyDates={anomalyDates} anomalyRows={anomalyRows}/>)}

            </div>

            {/* Table */}
            <div className="bg-white border border-[#e4e7ed] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#0f1117]">일자별 상세 데이터</h2>
                  <span className="text-xs text-[#9ca3af]">총 {currentData.length}일</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button onClick={() => setFieldOpen((value) => !value)} className={`px-3.5 py-2 border rounded-lg text-xs font-medium transition-colors ${fieldOpen ? "border-[#2563eb] text-[#2563eb] bg-[#eff6ff]" : "border-[#e4e7ed] text-[#6b7280] hover:border-[#2563eb] hover:text-[#2563eb]"}`}>
                      광고지표 ▾{selectedFields.size > 0 ? ` (${selectedFields.size})` : ""}
                    </button>
                    {fieldOpen && (<div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#e4e7ed] rounded-xl shadow-xl z-30 p-3">
                        <div className="flex items-center justify-between px-1 mb-2">
                          <p className="text-xs font-semibold text-[#0f1117]">추가 필드</p>
                          <span className="text-[11px] text-[#9ca3af]">복수 선택 가능</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {EXTRA_FIELDS.map((field) => (<label key={field.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer text-xs text-[#374151]">
                              <input type="checkbox" checked={selectedFields.has(field.key)} onChange={() => toggleField(field.key)} className="accent-[#2563eb]"/>
                              {field.label}
                            </label>))}
                        </div>
                      </div>)}
                  </div>
                  <button onClick={downloadCsv} className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e4e7ed] rounded-lg text-xs font-medium text-[#6b7280] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
                    <span>↓</span> 데이터 다운로드
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f9fafb]">
                      {visibleFields.map(({ key, label, description }) => (<th key={key} onClick={() => handleSort(key)} className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] cursor-pointer select-none hover:text-[#0f1117] transition-colors">
                          <span className="flex items-center gap-1">
                            {label}
                            {key !== "date" && <InfoTooltip text={description}/>}
                            <span className="ml-1 text-[#d1d5db]">
                              {sortCol === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </span>
                        </th>))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {sortedData.map((row) => {
            return (<tr key={row.date} className={`transition-colors hover:bg-[#f9fafb] ${row.anomaly ? "bg-[#fffbeb] hover:bg-[#fef9c3]" : ""}`}>
                          {visibleFields.map((field) => (<td key={field.key} className="px-4 py-3 font-mono text-xs text-[#0f1117] whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {formatTableValue(row, field.key)}
                                {field.key === "date" && row.anomaly && <span className="text-[#d97706] text-xs">⚠</span>}
                              </div>
                            </td>))}
                        </tr>);
        })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click-outside to close store dropdown */}
      {storeOpen && <div className="fixed inset-0 z-10" onClick={() => setStoreOpen(false)}/>}

    </div>);
}
