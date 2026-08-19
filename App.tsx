import { useState, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = "today" | "7d" | "30d" | "custom";
type Metric = "impressions" | "clicks" | "spend" | "cpc" | "ctr";

interface DayData {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  ctr: number;
  anomaly?: Metric;
}

interface Store {
  id: string;
  name: string;
  platform: string;
}

// ─── Download column definitions ──────────────────────────────────────────────

interface DownloadCol {
  id: string;
  label: string;
  group: "광고 지표" | "행동 지표" | "상품권";
}

const DOWNLOAD_COLS: DownloadCol[] = [
  { id: "spend", label: "광고비", group: "광고 지표" },
  { id: "impressions", label: "노출수", group: "광고 지표" },
  { id: "clicks", label: "클릭수", group: "광고 지표" },
  { id: "cpc", label: "평균 CPC", group: "광고 지표" },
  { id: "ctr", label: "CTR", group: "광고 지표" },
  { id: "save", label: "저장", group: "행동 지표" },
  { id: "share", label: "공유", group: "행동 지표" },
  { id: "voucher_view", label: "상품권 조회", group: "상품권" },
  { id: "voucher_order", label: "상품권 주문", group: "상품권" },
];

const COL_GROUPS: DownloadCol["group"][] = ["광고 지표", "행동 지표", "상품권"];

// ─── Column tooltips ──────────────────────────────────────────────────────────

const COL_TIPS: Record<string, string> = {
  date: "데이터가 집계된 날짜입니다.",
  spend: "해당 날짜에 사용된 총 광고 비용입니다.",
  impressions: "광고가 사용자 화면에 노출된 횟수입니다.",
  clicks: "광고 노출 후 사용자가 광고를 클릭한 횟수입니다.",
  ctr: "광고 노출 대비 클릭이 발생한 비율입니다. 클릭수 ÷ 노출수 × 100으로 계산합니다.",
  cpc: "클릭 1회당 평균으로 발생한 광고 비용입니다. 광고비 ÷ 클릭수로 계산합니다.",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const STORES: Store[] = [
  { id: "s1", name: "스타벅스 강남점", platform: "Naver" },
  { id: "s2", name: "올리브영 홍대점", platform: "Kakao" },
  { id: "s3", name: "BBQ 서초점", platform: "Naver" },
  { id: "s4", name: "맥도날드 이태원점", platform: "Coupang" },
  { id: "s5", name: "GS25 신촌점", platform: "Naver" },
];

const PLATFORMS = ["전체", "Naver", "Kakao", "Coupang", "Google"];

function generateData(days: number, seed: number): DayData[] {
  const result: DayData[] = [];
  const now = new Date(2026, 7, 18);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const base = seed * 0.8 + Math.sin(i * 0.4 + seed) * seed * 0.2;
    const spike = i === Math.floor(days * 0.6) || i === Math.floor(days * 0.3);
    const impressions = Math.round((base * 1800 + (spike ? base * 900 : 0)) * (0.85 + Math.random() * 0.3));
    const ctr = +(((spike ? 3.8 : 2.1) + Math.random() * 1.4) / 100).toFixed(4);
    const clicks = Math.round(impressions * ctr);
    const cpc = +(280 + Math.random() * 160 - (spike ? 80 : 0)).toFixed(0);
    const spend = Math.round(clicks * cpc);
    let anomaly: Metric | undefined;
    if (spike && i === Math.floor(days * 0.6)) anomaly = "clicks";
    if (spike && i === Math.floor(days * 0.3)) anomaly = "spend";
    result.push({ date: dateStr, impressions, clicks, spend, cpc, ctr: +(ctr * 100).toFixed(2), anomaly });
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString("ko-KR"); }
function fmtWon(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return `₩${fmtNum(n)}`;
}
function fmtVal(metric: Metric, v: number) {
  if (metric === "spend" || metric === "cpc") return `₩${fmtNum(v)}`;
  if (metric === "ctr") return `${v.toFixed(2)}%`;
  return fmtNum(v);
}
function delta(curr: number, prev: number) {
  if (prev === 0) return 0;
  return +((((curr - prev) / prev) * 100).toFixed(1));
}
function sumData(data: DayData[]) {
  return data.reduce(
    (acc, d) => ({ impressions: acc.impressions + d.impressions, clicks: acc.clicks + d.clicks, spend: acc.spend + d.spend }),
    { impressions: 0, clicks: 0, spend: 0 }
  );
}
function avgData(data: DayData[]) {
  const s = sumData(data);
  return { ...s, ctr: +(s.clicks / (s.impressions || 1) * 100).toFixed(2), cpc: +(s.spend / (s.clicks || 1)).toFixed(0) };
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-[#c4c9d4] hover:text-[#2563eb] cursor-default transition-colors text-[11px] leading-none select-none">ⓘ</span>
      {show && (
        <span
          className="absolute z-50 pointer-events-none"
          style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}
        >
          <span className="block w-56 bg-[#1e2330] text-white text-[11px] leading-[1.6] px-3 py-2.5 shadow-2xl whitespace-normal">
            {text}
          </span>
          <span
            className="block mx-auto mt-0"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #1e2330",
              marginLeft: "auto",
              marginRight: "auto",
              position: "relative",
              left: 0,
            }}
          />
        </span>
      )}
    </span>
  );
}

// ─── DownloadModal ────────────────────────────────────────────────────────────

function DownloadModal({
  store,
  platform,
  dateRange,
  onClose,
}: {
  store: Store;
  platform: string;
  dateRange: DateRange;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["spend", "impressions", "clicks", "cpc", "ctr"])
  );
  const [downloading, setDownloading] = useState(false);

  const allIds = DOWNLOAD_COLS.map((c) => c.id);
  const allSelected = allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(allIds)); }
  function clearAll() { setSelected(new Set()); }

  const dateLabel =
    dateRange === "today" ? "오늘" :
    dateRange === "7d" ? "최근 7일" :
    dateRange === "30d" ? "최근 30일" : "직접 설정";

  function handleDownload() {
    if (selected.size === 0) return;
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      onClose();
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
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
            <button
              onClick={onClose}
              className="text-[#9ca3af] hover:text-[#6b7280] transition-colors text-lg leading-none mt-0.5"
            >
              ✕
            </button>
          </div>
          {/* Select all / clear */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={selectAll}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                allSelected
                  ? "bg-[#eff6ff] text-[#2563eb]"
                  : "text-[#6b7280] hover:bg-[#f3f4f6]"
              }`}
            >
              전체 선택
            </button>
            <button
              onClick={clearAll}
              className="text-xs font-medium px-2.5 py-1 rounded-md text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
            >
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
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">{group}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {cols.map((col) => {
                    const checked = selected.has(col.id);
                    return (
                      <label
                        key={col.id}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                          checked
                            ? "border-[#2563eb] bg-[#eff6ff]"
                            : "border-[#e4e7ed] bg-white hover:border-[#93c5fd]"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                            checked
                              ? "bg-[#2563eb] border-[#2563eb]"
                              : "border-[#d1d5db] bg-white"
                          }`}
                        >
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-xs font-medium ${checked ? "text-[#1d4ed8]" : "text-[#374151]"}`}>
                          {col.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f3f4f6] flex items-center justify-between">
          <p className="text-xs text-[#9ca3af]">
            날짜 컬럼은 항상 포함됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDownload}
              disabled={selected.size === 0 || downloading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selected.size === 0
                  ? "bg-[#e5e7eb] text-[#9ca3af] cursor-not-allowed"
                  : downloading
                  ? "bg-[#2563eb] text-white opacity-70"
                  : "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
              }`}
            >
              {downloading ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  처리 중...
                </>
              ) : (
                <>
                  <span>⬇</span> Excel 다운로드
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  prevValue: string;
  pct: number;
  showCompare: boolean;
  icon: React.ReactNode;
}

function KpiCard({ label, value, prevValue, pct, showCompare, icon }: KpiCardProps) {
  const isUp = pct >= 0;
  const absP = Math.abs(pct);
  return (
    <div className="bg-white border border-[#e4e7ed] rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6b7280]">{label}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight text-[#0f1117]">{value}</span>
        {showCompare && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${isUp ? "text-[#16a34a] bg-[#f0fdf4]" : "text-[#dc2626] bg-[#fef2f2]"}`}>
              {isUp ? "▲" : "▼"} {absP}%
            </span>
            <span className="text-xs text-[#9ca3af]">이전 {prevValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const METRIC_CONFIG: Record<Metric, { label: string; color: string; format: (v: number) => string }> = {
  impressions: { label: "노출수", color: "#2563eb", format: fmtNum },
  clicks: { label: "클릭수", color: "#7c3aed", format: fmtNum },
  spend: { label: "광고비", color: "#0891b2", format: (v) => `₩${fmtNum(v)}` },
  cpc: { label: "평균 CPC", color: "#d97706", format: (v) => `₩${fmtNum(v)}` },
  ctr: { label: "CTR", color: "#059669", format: (v) => `${v.toFixed(2)}%` },
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: Metric;
  anomalyDates: Set<string>;
}

function ChartTooltip({ active, payload, label, metric, anomalyDates }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const isAnomaly = label ? anomalyDates.has(label) : false;
  return (
    <div className="bg-white border border-[#e4e7ed] rounded-lg shadow-lg px-3.5 py-3 text-sm min-w-[140px]">
      <p className="text-[#6b7280] font-medium mb-1.5">{label}</p>
      <p className="font-semibold text-[#0f1117]">{fmtVal(metric, payload[0].value)}</p>
      {isAnomaly && <p className="text-xs text-[#d97706] mt-1 font-medium">⚠ 이상 변화 감지</p>}
    </div>
  );
}

// ─── Table column definitions ─────────────────────────────────────────────────

const TABLE_COLS: Array<{ key: keyof DayData; label: string }> = [
  { key: "date", label: "날짜" },
  { key: "spend", label: "광고비" },
  { key: "impressions", label: "노출수" },
  { key: "clicks", label: "클릭수" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "평균 CPC" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store>(STORES[0]);
  const [selectedPlatform, setSelectedPlatform] = useState("전체");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [showCompare, setShowCompare] = useState(true);
  const [activeMetric, setActiveMetric] = useState<Metric>("clicks");
  const [sortCol, setSortCol] = useState<keyof DayData>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [storeOpen, setStoreOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : 30;
  const seed = STORES.indexOf(selectedStore) + 1;

  const currentData = useMemo(() => generateData(days, seed), [days, seed]);
  const prevData = useMemo(() => generateData(days, seed * 1.15), [days, seed]);

  const curr = avgData(currentData);
  const prev = avgData(prevData);

  const anomalyDates = useMemo(
    () => new Set(currentData.filter((d) => d.anomaly).map((d) => d.date)),
    [currentData]
  );
  const anomalyRows = useMemo(() => currentData.filter((d) => d.anomaly), [currentData]);

  const sortedData = useMemo(() => {
    return [...currentData].sort((a, b) => {
      const av = a[sortCol] as number | string;
      const bv = b[sortCol] as number | string;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [currentData, sortCol, sortDir]);

  function handleSort(col: keyof DayData) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const filteredStores = STORES.filter((s) =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const kpis: Array<{ label: string; metric: keyof typeof curr; format: (v: number) => string; icon: string }> = [
    { label: "광고비", metric: "spend", format: fmtWon, icon: "₩" },
    { label: "노출수", metric: "impressions", format: fmtNum, icon: "👁" },
    { label: "클릭수", metric: "clicks", format: fmtNum, icon: "🖱" },
    { label: "평균 CPC", metric: "cpc", format: (v) => `₩${fmtNum(v)}`, icon: "⚡" },
    { label: "CTR", metric: "ctr", format: (v) => `${v}%`, icon: "%" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-14 bg-white border-r border-[#e4e7ed] flex flex-col items-center py-5 gap-5 shrink-0">
          <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white text-xs font-bold">A</div>
          {[
            { icon: "▤", title: "대시보드", active: true },
            { icon: "⊞", title: "매장 목록", active: false },
            { icon: "◑", title: "보고서", active: false },
            { icon: "⚙", title: "설정", active: false },
          ].map((item) => (
            <button
              key={item.title}
              title={item.title}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${
                item.active ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
              }`}
            >
              {item.icon}
            </button>
          ))}
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
                <button
                  onClick={() => setStoreOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 border border-[#e4e7ed] rounded-lg text-sm text-[#0f1117] bg-white hover:border-[#2563eb] transition-colors min-w-[180px] justify-between"
                >
                  <span className="font-medium truncate">{selectedStore.name}</span>
                  <span className="text-[#9ca3af] text-xs">▾</span>
                </button>
                {storeOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-[#e4e7ed] rounded-lg shadow-lg z-20 w-56">
                    <div className="p-2 border-b border-[#f3f4f6]">
                      <input
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        placeholder="매장 검색..."
                        className="w-full text-sm px-2.5 py-1.5 border border-[#e4e7ed] rounded-md outline-none focus:border-[#2563eb] text-[#0f1117] placeholder-[#9ca3af]"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredStores.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStore(s); setStoreOpen(false); setStoreSearch(""); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            s.id === selectedStore.id ? "bg-[#eff6ff] text-[#2563eb] font-medium" : "text-[#0f1117] hover:bg-[#f9fafb]"
                          }`}
                        >
                          <div>{s.name}</div>
                          <div className="text-xs text-[#9ca3af]">{s.platform}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Platform */}
              <div className="flex items-center gap-1">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedPlatform === p ? "bg-[#2563eb] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#e4e7ed]" />

              {/* Date range */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: "today", label: "오늘" },
                    { key: "7d", label: "최근 7일" },
                    { key: "30d", label: "최근 30일" },
                    { key: "custom", label: "직접 설정" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setDateRange(r.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      dateRange === r.key ? "bg-[#0f1117] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#e4e7ed]" />

              {/* Compare toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setShowCompare((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${showCompare ? "bg-[#2563eb]" : "bg-[#d1d5db]"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showCompare ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-[#6b7280] font-medium">이전 기간 비교</span>
              </label>

              {/* Download button */}
              <div className="ml-auto">
                <button
                  onClick={() => setDownloadOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e4e7ed] rounded-lg text-xs font-medium text-[#6b7280] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                >
                  <span>↓</span> 데이터 다운로드
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              {kpis.map(({ label, metric, format, icon }) => {
                const cv = curr[metric] as number;
                const pv = prev[metric] as number;
                return (
                  <KpiCard
                    key={metric}
                    label={label}
                    value={format(cv)}
                    prevValue={format(pv)}
                    pct={delta(cv, pv)}
                    showCompare={showCompare}
                    icon={<span className="text-base">{icon}</span>}
                  />
                );
              })}
            </div>

            {/* Chart section */}
            <div className="bg-white border border-[#e4e7ed] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#0f1117]">광고 성과 추이</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {selectedStore.name} · {dateRange === "today" ? "오늘" : dateRange === "7d" ? "최근 7일" : dateRange === "30d" ? "최근 30일" : "직접 설정"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(Object.entries(METRIC_CONFIG) as [Metric, typeof METRIC_CONFIG[Metric]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setActiveMetric(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeMetric === key ? "text-white shadow-sm" : "text-[#6b7280] hover:bg-[#f3f4f6]"}`}
                      style={activeMetric === key ? { backgroundColor: cfg.color } : {}}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={currentData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "DM Mono" }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(currentData.length / 8) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "DM Mono" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => METRIC_CONFIG[activeMetric].format(v).replace("₩", "")}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip metric={activeMetric} anomalyDates={anomalyDates} />} />
                  {anomalyRows.map((row) => (
                    <ReferenceLine key={row.date} x={row.date} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.6} />
                  ))}
                  <Line
                    type="monotone"
                    dataKey={activeMetric}
                    stroke={METRIC_CONFIG[activeMetric].color}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.anomaly) return <circle key={payload.date} cx={cx} cy={cy} r={5} fill="#d97706" stroke="white" strokeWidth={2} />;
                      return <circle key={payload.date} cx={cx} cy={cy} r={0} fill="transparent" />;
                    }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                  />
                </LineChart>
              </ResponsiveContainer>

            </div>

            {/* Table */}
            <div className="bg-white border border-[#e4e7ed] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0f1117]">일자별 상세 데이터</h2>
                <span className="text-xs text-[#9ca3af]">총 {currentData.length}일</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f9fafb]">
                      {TABLE_COLS.map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] cursor-pointer select-none hover:text-[#0f1117] transition-colors"
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            {COL_TIPS[key] && <InfoTooltip text={COL_TIPS[key]} />}
                            <span className="text-[#d1d5db]">
                              {sortCol === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {sortedData.map((row, i) => {
                      const prevRow = sortedData[i + 1];
                      const clickDelta = prevRow ? delta(row.clicks, prevRow.clicks) : null;
                      return (
                        <tr
                          key={row.date}
                          className={`transition-colors hover:bg-[#f9fafb] ${row.anomaly ? "bg-[#fffbeb] hover:bg-[#fef9c3]" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[#6b7280] font-medium">
                            <div className="flex items-center gap-2">
                              {row.date}
                              {row.anomaly && <span className="text-[#d97706] text-xs">⚠</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#0f1117]">₩{fmtNum(row.spend)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#0f1117]">{fmtNum(row.impressions)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#0f1117]">{fmtNum(row.clicks)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#0f1117]">{row.ctr.toFixed(2)}%</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#0f1117]">₩{fmtNum(row.cpc)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click-outside to close store dropdown */}
      {storeOpen && <div className="fixed inset-0 z-10" onClick={() => setStoreOpen(false)} />}

      {/* Download modal */}
      {downloadOpen && (
        <DownloadModal
          store={selectedStore}
          platform={selectedPlatform}
          dateRange={dateRange}
          onClose={() => setDownloadOpen(false)}
        />
      )}
    </div>
  );
}
