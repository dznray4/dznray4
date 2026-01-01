import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  BatteryCharging,
  Bell,
  Bolt,
  Box,
  Building2,
  CheckCircle2,
  Clock3,
  Cloud,
  DoorOpen,
  Factory,
  Fan,
  Flame,
  Gauge,
  HardHat,
  LayoutGrid,
  Lightbulb,
  Link as LinkIcon,
  Lock,
  LockOpen,
  MapPin,
  Pause,
  Play,
  Power,
  ShieldCheck,
  Siren,
  SkipForward,
  Speaker,
  Sun,
  Thermometer,
  UserPlus,
  Users,
  Wrench,
  Volume2,
  VolumeX,
  BadgeCheck,
  CalendarClock
} from "lucide-react";

/** ---------- Stations & Types ---------- */
const DEFAULT_STATIONS = [
  { id: "rec", name: "Receiving", icon: Box },
  { id: "cut", name: "Cutting / Prep", icon: Wrench },
  { id: "frame", name: "Framing", icon: Building2 },
  { id: "plumb", name: "Plumbing", icon: Gauge },
  { id: "elec", name: "Electrical", icon: Bolt },
  { id: "hvac", name: "HVAC", icon: Fan },
  { id: "insul", name: "Insulation", icon: ShieldCheck },
  { id: "int", name: "Interior Finish", icon: Lightbulb },
  { id: "ext", name: "Exterior Finish", icon: Sun },
  { id: "qa", name: "QA / Inspect", icon: HardHat },
  { id: "dock", name: "Shipping Dock", icon: DoorOpen }
] as const;

type StationId = (typeof DEFAULT_STATIONS)[number]["id"];

type StationState = {
  power: boolean;
  lux: number; // lights %
  fan: number; // fans %
  locked: boolean;
  alert: boolean;
  crew: number; // seed only; live counts derived from employees
  oee: number;
  wip: number;
};

type StationTimer = { startedAt?: number; targetMins: number };

type Employee = {
  id: string;
  name: string;
  role: string;
  onFloor: boolean;
  stationId?: StationId;
  clockEvents: { t: number; type: "in" | "out" }[];
};

/** ---------- Compliance Types ---------- */
type ProjectType = "housing" | "modular"; // per user ask (modular used here as commercial-like)
type CodeCycle = "pre2026" | "post2026";

type Project = {
  id: string;
  label: string; // e.g., "2022 Plan"
  unitId?: string; // optional unit number / name
  projectType: ProjectType;
  cycle: CodeCycle;
  approvalDate: string; // ISO date
};

type ProjectWithDerived = Project & {
  expiresAt?: string; // ISO date if applicable
  status: "valid" | "expiring" | "expired" | "compliant"; // compliant used for post2026
  monthsLeft?: number;
};

function addMonths(d: Date, months: number) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt;
}

function formatMMMYYYY(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function computeCompliance(p: Project): ProjectWithDerived {
  if (p.cycle === "post2026") {
    return { ...p, status: "compliant" };
  }
  // Pre-2026 grandfathered windows
  const base = new Date(p.approvalDate);
  const months = p.projectType === "housing" ? 36 : 15; // housing 36m, modular 15m
  const expires = addMonths(base, months);
  const now = new Date();
  const monthsLeft = Math.max(0, Math.round((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); // approx
  const status: ProjectWithDerived["status"] = expires < now ? "expired" : monthsLeft < 6 ? "expiring" : "valid";
  return { ...p, expiresAt: expires.toISOString(), monthsLeft, status };
}

function badgeTone(status: ProjectWithDerived["status"]) {
  switch (status) {
    case "valid":
    case "compliant":
      return "bg-emerald-600 text-white"; // 🟢
    case "expiring":
      return "bg-amber-600 text-white"; // 🟡
    case "expired":
      return "bg-rose-600 text-white"; // 🔴
  }
}

function statusLabel(p: ProjectWithDerived) {
  if (p.cycle === "post2026") return "CBSC 2026+ — Compliant";
  if (p.status === "expired") return "Expired";
  if (p.status === "expiring") return `Expires in ${p.monthsLeft}m`;
  return "Valid";
}

/** ---------- Seed + Layouts (unchanged parts condensed) ---------- */
const seedState = (): Record<StationId, StationState> => {
  return Object.fromEntries(
    DEFAULT_STATIONS.map((s, i) => [
      s.id,
      {
        power: i !== 0,
        lux: [0, 40, 60, 75, 90][i % 5],
        fan: [0, 30, 50, 70, 90][(i + 2) % 5],
        locked: false,
        alert: false,
        crew: (i % 3) + 2,
        oee: 80 - (i % 4) * 5,
        wip: (i % 5) + 1
      } as StationState
    ])
  ) as Record<StationId, StationState>;
};

const MAP_TILES = [
  { key: "rec", stationId: "rec", label: "Receiving", x: 1, y: 1, w: 3, h: 3 },
  { key: "cut", stationId: "cut", label: "Cut / Prep", x: 4, y: 1, w: 3, h: 2 },
  { key: "frame", stationId: "frame", label: "Framing", x: 7, y: 1, w: 3, h: 3 },
  { key: "plumb", stationId: "plumb", label: "Plumbing", x: 10, y: 1, w: 3, h: 2 },
  { key: "elec", stationId: "elec", label: "Electrical", x: 1, y: 4, w: 3, h: 2 },
  { key: "hvac", stationId: "hvac", label: "HVAC", x: 4, y: 3, w: 2, h: 3 },
  { key: "insul", stationId: "insul", label: "Insulation", x: 6, y: 4, w: 2, h: 2 },
  { key: "int", stationId: "int", label: "Interior", x: 8, y: 4, w: 3, h: 3 },
  { key: "ext", stationId: "ext", label: "Exterior", x: 11, y: 3, w: 2, h: 4 },
  { key: "qa", stationId: "qa", label: "QA / Inspect", x: 1, y: 6, w: 4, h: 2 },
  { key: "dock", stationId: "dock", label: "Shipping Dock", x: 5, y: 6, w: 8, h: 2 }
] as const;

/** ---------- Small UI Bits (brand / clock / weather) ---------- */
const ADXBrand = () => (
  <div className="flex items-center gap-3">
    <div className="h-8 w-8 rounded-full border border-amber-400 grid place-content-center">
      <div className="h-2 w-2 rounded-full bg-amber-400" />
    </div>
    <div className="leading-tight">
      <div className="text-amber-400 tracking-widest text-xs">AERIAL DEVELOPMENT X</div>
      <div className="text-white font-semibold text-lg">ADX — Warehouse Floor</div>
    </div>
  </div>
);

const NowClock: React.FC = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="text-right">
      <div className="text-3xl font-bold text-white">{hh}</div>
      <div className="text-sm text-zinc-400">{date}</div>
    </div>
  );
};

const WeatherMini: React.FC = () => (
  <div className="flex items-center gap-3">
    <Cloud className="h-6 w-6 text-zinc-300" />
    <div>
      <div className="text-sm text-white">Overcast</div>
      <div className="text-xs text-zinc-400">68°F · Light wind</div>
    </div>
  </div>
);

function tileColor(active: boolean, warn: boolean) {
  if (warn) return "bg-amber-500/30 ring-2 ring-amber-400";
  if (active) return "bg-amber-500/20";
  return "bg-zinc-800/70";
}

const KPI: React.FC<{ label: string; value: string; icon: any; sub?: string }> = ({ label, value, icon: Icon, sub }) => (
  <Card className="bg-zinc-900/70 border-zinc-700 rounded-2xl">
    <CardContent className="p-4 flex items-center gap-4">
      <div className="p-2 rounded-xl bg-zinc-800">
        <Icon className="h-5 w-5 text-amber-400" />
      </div>
      <div className="leading-tight">
        <div className="text-zinc-400 text-xs">{label}</div>
        <div className="text-white text-xl font-semibold">{value}</div>
        {sub && <div className="text-zinc-500 text-[11px]">{sub}</div>}
      </div>
    </CardContent>
  </Card>
);

/** ---------- Station Tile (added Code Cycle badge line) ---------- */
const StationTile: React.FC<{
  station: { id: StationId; name: string; icon: any };
  onChange?: (data: Partial<StationState>) => void;
  value: StationState;
  timer?: StationTimer;
  onTimerStart?: (mins: number) => void;
  onTimerStop?: () => void;
  crewHere: number;
  activeProject?: ProjectWithDerived | null;
}> = ({ station, value, onChange, timer, onTimerStart, onTimerStop, crewHere, activeProject }) => {
  const Icon = station.icon;
  const pct = (() => {
    if (!timer?.startedAt) return 0;
    const elapsedMin = (Date.now() - (timer.startedAt || 0)) / 60000;
    return Math.min(100, (elapsedMin / Math.max(1, timer.targetMins)) * 100);
  })();

  const showBadge = !!activeProject;
  const badgeText = activeProject
    ? `${activeProject.label}${
        activeProject.cycle === "pre2026" && activeProject.expiresAt
          ? ` — Expires: ${formatMMMYYYY(new Date(activeProject.expiresAt))}`
          : " — CBSC 2026+"
      }`
    : "";

  return (
    <div className={`rounded-2xl p-3 md:p-4 border border-zinc-700 shadow-inner ${tileColor(value.power, value.alert)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-zinc-300" />
          <div className="text-sm font-medium text-white">{station.name}</div>
        </div>
        <div className="flex items-center gap-2">
          {value.locked ? <Lock className="h-4 w-4 text-zinc-400" /> : <LockOpen className="h-4 w-4 text-zinc-400" />}
          {value.alert ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        </div>
      </div>

      {/* Code Cycle badge line */}
      {showBadge && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-md ${badgeTone(activeProject!.status)}`}>
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" /> {badgeText}
            </span>
          </span>
          <span className="text-zinc-400">{statusLabel(activeProject!)}</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Power</div>
          <Switch checked={value.power} onCheckedChange={(b) => onChange?.({ power: b })} />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Lights</div>
          <Slider value={[value.lux]} onValueChange={(v) => onChange?.({ lux: v[0] })} max={100} />
          <div className="text-xs text-zinc-400">{value.lux}%</div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Fans</div>
          <Slider value={[value.fan]} onValueChange={(v) => onChange?.({ fan: v[0] })} max={100} />
          <div className="text-xs text-zinc-400">{value.fan}%</div>
        </div>
      </div>

      <div className="mt-3">
        <Progress value={pct} className="h-1 bg-zinc-800" />
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <div>{timer?.startedAt ? <span>Running · Target {timer.targetMins}m</span> : <span>Idle</span>}</div>
          <div className="flex items-center gap-2">
            {!timer?.startedAt ? (
              <Button size="sm" className="h-7 rounded-lg bg-zinc-700 hover:bg-zinc-600" onClick={() => onTimerStart?.(45)}>
                Start 45m
              </Button>
            ) : (
              <Button size="sm" className="h-7 rounded-lg bg-zinc-700 hover:bg-zinc-600" onClick={onTimerStop}>
                Stop
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Users className="h-3.5 w-3.5" /> {crewHere} on post
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-zinc-700/80 text-zinc-200">OEE {value.oee}%</Badge>
          <Badge className="bg-zinc-700/80 text-zinc-200">WIP {value.wip}</Badge>
        </div>
      </div>
    </div>
  );
};

/** ---------- Main Component ---------- */
export default function ADXSplash() {
  const [stations, setStations] = useState<Record<StationId, StationState>>(seedState);
  const [timers, setTimers] = useState<Record<StationId, StationTimer>>({});
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const [mapMode, setMapMode] = useState<"grid" | "plan">("grid");

  // Crew seed
  const [employees, setEmployees] = useState<Employee[]>([
    { id: "1001", name: "Alex", role: "Assembler", onFloor: true, stationId: "frame", clockEvents: [] },
    { id: "1002", name: "Bri", role: "QC", onFloor: true, stationId: "qa", clockEvents: [] }
  ]);

  // Projects / Compliance
  const [projects, setProjects] = useState<Project[]>([
    { id: "p22", label: "2022 Plan", projectType: "housing", cycle: "pre2026", approvalDate: "2022-03-15" },
    { id: "p25", label: "2025 Plan", projectType: "modular", cycle: "pre2026", approvalDate: "2025-01-10" },
    { id: "p27", label: "2027 Plan", projectType: "housing", cycle: "post2026", approvalDate: "2027-02-01" }
  ]);
  const derived = useMemo(() => projects.map(computeCompliance), [projects]);
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || "");
  const activeProject = useMemo(() => derived.find((p) => p.id === activeProjectId) || null, [derived, activeProjectId]);

  // Clock-in modal UI state
  const [clockOpen, setClockOpen] = useState(false);
  const [clockName, setClockName] = useState("");
  const [clockStation, setClockStation] = useState<StationId>(DEFAULT_STATIONS[0].id);

  // Add Project modal UI state
  const [projOpen, setProjOpen] = useState(false);
  const [projLabel, setProjLabel] = useState("");
  const [projApproval, setProjApproval] = useState("");
  const [projType, setProjType] = useState<ProjectType>("housing");
  const [projCycle, setProjCycle] = useState<CodeCycle>("pre2026");

  const clockIn = () => {
    const id = Math.random().toString(36).slice(2, 8);
    setEmployees((e) => [
      ...e,
      { id, name: clockName || `Worker ${id}`, role: "Crew", onFloor: true, stationId: clockStation, clockEvents: [{ t: Date.now(), type: "in" }] }
    ]);
    setClockOpen(false);
    setClockName("");
  };

  const clockOutAll = () =>
    setEmployees((e) =>
      e.map((x) => ({ ...x, onFloor: false, stationId: undefined, clockEvents: [...x.clockEvents, { t: Date.now(), type: "out" }] }))
    );

  const addProject = () => {
    if (!projLabel || !projApproval) return;
    const id = Math.random().toString(36).slice(2, 8);
    setProjects((p) => [...p, { id, label: projLabel, projectType: projType, cycle: projCycle, approvalDate: projApproval }]);
    setProjOpen(false);
    setProjLabel("");
    setProjApproval("");
  };

  // VLM mock
  const [vlm, setVlm] = useState<{ state: "IDLE" | "MOVING" | "ERROR"; bay: number; shelf: number; queue: number; doorLocked: boolean }>(
    { state: "IDLE", bay: 12, shelf: 4, queue: 3, doorLocked: true }
  );
  useEffect(() => {
    const t = setInterval(() => {
      setVlm((v) => ({ ...v, state: v.state === "MOVING" ? "IDLE" : "MOVING", bay: (v.bay % 24) + 1, shelf: (v.shelf % 8) + 1 }));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Music player
  const [playlist] = useState<string[]>(["/media/track1.mp3", "/media/track2.mp3"]);
  const [track, setTrack] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const play = () => audioRef.current?.play();
  const pause = () => audioRef.current?.pause();
  const next = () => setTrack((i) => (i + 1) % playlist.length);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : 0.6;
  }, [muted, track]);

  // Totals
  const totals = useMemo(() => {
    const list = Object.values(stations);
    const powered = list.filter((s) => s.power).length;
    const crew = employees.filter((e) => e.onFloor).length;
    const wip = list.reduce((a, b) => a + b.wip, 0);
    return { powered, crew, wip };
  }, [stations, employees]);

  const filtered = useMemo(() => {
    if (!query.trim()) return DEFAULT_STATIONS;
    return DEFAULT_STATIONS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const applyToAll = (upd: Partial<StationState>) => {
    setStations((old) => {
      const next = { ...old } as Record<StationId, StationState>;
      (Object.keys(next) as StationId[]).forEach((k) => (next[k] = { ...next[k], ...upd }));
      return next;
    });
  };

  const triggerScene = (which: string) => {
    if (which === "start") {
      applyToAll({ power: true, lux: 70, fan: 40, alert: false });
    } else if (which === "lunch") {
      applyToAll({ lux: 30, fan: 20 });
    } else if (which === "evac") {
      applyToAll({ power: false, lux: 0, fan: 0, alert: true });
      pause();
    } else if (which === "alloff") {
      applyToAll({ power: false, lux: 0, fan: 0, alert: false });
      pause();
    }
  };

  const percentFor = (id: StationId) => {
    const tt = timers[id];
    if (!tt?.startedAt) return 0;
    const elapsedMin = (Date.now() - tt.startedAt) / 60000;
    return Math.min(100, (elapsedMin / Math.max(1, tt.targetMins)) * 100);
  };

  const activeStations = useMemo(
    () =>
      DEFAULT_STATIONS.filter((s) => {
        const st = stations[s.id];
        const onPost = employees.some((e) => e.onFloor && e.stationId === s.id);
        return st.power || onPost || percentFor(s.id) > 0;
      }),
    [stations, employees, timers]
  );

  // Compliance derived metrics
  const compCounts = useMemo(() => {
    const d = derived;
    return {
      valid: d.filter((x) => x.status === "valid" || x.status === "compliant").length,
      expiring: d.filter((x) => x.status === "expiring").length,
      expired: d.filter((x) => x.status === "expired").length
    };
  }, [derived]);

  const alerts = useMemo(() => derived.filter((x) => x.status === "expiring" || x.status === "expired"), [derived]);

  const crewForStation = (id: StationId) => employees.filter((e) => e.onFloor && e.stationId === id).length;

  const startTimer = (id: StationId, mins: number) =>
    setTimers((t) => ({ ...t, [id]: { startedAt: Date.now(), targetMins: mins } }));
  const stopTimer = (id: StationId) => setTimers((t) => ({ ...t, [id]: { ...t[id], startedAt: undefined } }));

  const updateStation = (id: StationId, data: Partial<StationState>) =>
    setStations((s) => ({ ...s, [id]: { ...s[id], ...data } }));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <ADXBrand />
        <div className="hidden md:flex items-center gap-6">
          <WeatherMini />
          <div className="h-10 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Bell className="h-4 w-4" /> Alerts
            <Badge className={`${alerts.length ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{alerts.length}</Badge>
          </div>
          <div className="h-10 w-px bg-zinc-800" />
          <NowClock />
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Orders in Queue" value={`${totals.wip}`} icon={Box} sub="Current WIP" />
        <KPI label="Stations Online" value={`${totals.powered}/${DEFAULT_STATIONS.length}`} icon={Factory} sub="Power state" />
        <KPI label="Crew On Floor" value={`${totals.crew}`} icon={Users} sub="Clocked in" />
        <KPI label="Energy Load" value="72%" icon={BatteryCharging} sub="Realtime draw" />
        <KPI label="Compliance Status" value={`${compCounts.valid} valid / ${compCounts.expiring} expiring / ${compCounts.expired} expired`} icon={CalendarClock} sub="Code cycle" />
      </div>

      {/* Layout Switch & Controls */}
      <div className="mt-6 grid lg:grid-cols-[2fr,1fr] gap-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search stations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-zinc-900 border-zinc-800 w-56"
              />
              <Button variant="ghost" className="text-zinc-300" onClick={() => setMapMode(mapMode === "grid" ? "plan" : "grid")}>
                {mapMode === "grid" ? <LayoutGrid className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} {mapMode === "grid" ? "Plan" : "Grid"} view
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => triggerScene("start")}>
                <Play className="h-4 w-4 mr-1" /> Start Shift
              </Button>
              <Button size="sm" variant="secondary" className="bg-zinc-800 border-zinc-700" onClick={() => triggerScene("lunch")}>
                <Clock3 className="h-4 w-4 mr-1" /> Lunch
              </Button>
              <Button size="sm" variant="destructive" className="bg-rose-700 hover:bg-rose-600" onClick={() => triggerScene("evac")}>
                <Siren className="h-4 w-4 mr-1" /> Evac
              </Button>
              <Button size="sm" variant="ghost" className="bg-zinc-800 border border-zinc-700" onClick={() => triggerScene("alloff")}>
                <Power className="h-4 w-4 mr-1" /> All Off
              </Button>
            </div>
          </div>

          {mapMode === "grid" ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <StationTile
                  key={s.id}
                  station={s}
                  value={stations[s.id]}
                  crewHere={crewForStation(s.id)}
                  timer={timers[s.id]}
                  onChange={(d) => updateStation(s.id, d)}
                  onTimerStart={(m) => startTimer(s.id, m)}
                  onTimerStop={() => stopTimer(s.id)}
                  activeProject={activeProject}
                />
              ))}
            </div>
          ) : (
            <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="grid grid-cols-12 gap-2 auto-rows-[80px]">
                {MAP_TILES.map((tile) => {
                  const s = stations[tile.stationId];
                  const comp = activeProject;
                  return (
                    <div
                      key={tile.key}
                      className={`rounded-xl border border-zinc-700/70 p-3 ${tileColor(s.power, s.alert)}`}
                      style={{ gridColumn: `${tile.x} / span ${tile.w}`, gridRow: `${tile.y} / span ${tile.h}` }}
                    >
                      <div className="flex items-start justify-between text-xs text-white">
                        <span className="font-semibold">{tile.label}</span>
                        <span className={`px-2 py-0.5 rounded ${comp ? badgeTone(comp.status) : "bg-zinc-800"}`}>
                          {comp ? statusLabel(comp) : "No Project"}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-300 flex items-center gap-2">
                        <Users className="h-3 w-3" /> {crewForStation(tile.stationId)} crew · OEE {s.oee}% · WIP {s.wip}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-0 pointer-events-none border border-dashed border-zinc-700 rounded-2xl" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Compliance */}
          <Card className="bg-zinc-900/80 border-zinc-800 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Compliance / Code Cycle</div>
                  <div className="text-white font-semibold">{activeProject?.label ?? "Select Project"}</div>
                </div>
                <Button size="sm" variant="secondary" className="bg-zinc-800 border-zinc-700" onClick={() => setProjOpen(true)}>
                  <LinkIcon className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="bg-zinc-900 border border-zinc-800 rounded-lg text-sm px-2 py-1"
                  value={activeProjectId}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                >
                  {derived.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {statusLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {derived.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded ${badgeTone(p.status)}`}>{p.label}</span>
                      <span className="text-zinc-400">
                        {p.cycle === "pre2026" && p.expiresAt ? `Expires ${formatMMMYYYY(new Date(p.expiresAt))}` : "CBSC 2026+"}
                      </span>
                    </div>
                    <span className="text-zinc-500">{statusLabel(p)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Alerts */}
          <Card className="bg-zinc-900/80 border border-amber-500/40 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> Compliance Alerts
                </div>
                <Badge className={`${alerts.length ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"}`}>
                  {alerts.length} open
                </Badge>
              </div>
              {alerts.length === 0 && <div className="text-sm text-emerald-300">No open compliance risks.</div>}
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-xs">
                    <div>
                      <div className="text-amber-100 font-semibold">{a.label}</div>
                      <div className="text-amber-200/80">
                        {a.cycle === "pre2026" && a.expiresAt ? `Expires ${formatMMMYYYY(new Date(a.expiresAt))}` : "CBSC 2026+"}
                      </div>
                    </div>
                    <Badge className={badgeTone(a.status)}>{statusLabel(a)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Virtual controls */}
          <Card className="bg-zinc-900/80 border-zinc-800 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-white">
                <div className="flex items-center gap-2">
                  <Speaker className="h-4 w-4" /> Floor Audio
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="bg-zinc-800" onClick={play}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="bg-zinc-800" onClick={pause}>
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="bg-zinc-800" onClick={next}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="bg-zinc-800" onClick={() => setMuted((m) => !m)}>
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <audio src={playlist[track]} ref={audioRef} className="hidden" />
              <div className="text-xs text-zinc-400">{playlist[track]}</div>
            </CardContent>
          </Card>

          {/* Crew */}
          <Card className="bg-zinc-900/80 border-zinc-800 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-white">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Crew
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => setClockOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Clock In
                </Button>
              </div>
              <div className="space-y-2 text-xs">
                {employees.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-2">
                    <div>
                      <div className="text-white font-semibold">{e.name}</div>
                      <div className="text-zinc-400">{e.role}</div>
                    </div>
                    <div className="text-right text-zinc-300">
                      {e.onFloor ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-600/20 text-emerald-200 px-2 py-1 rounded">
                          <CheckCircle2 className="h-3 w-3" /> {e.stationId ? DEFAULT_STATIONS.find((s) => s.id === e.stationId)?.name : "On floor"}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Off</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full bg-zinc-800/70" onClick={clockOutAll}>
                <Lock className="h-4 w-4 mr-1" /> Clock out all
              </Button>
            </CardContent>
          </Card>

          {/* VLM */}
          <Card className="bg-zinc-900/80 border-zinc-800 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" /> VLM 1
                </div>
                <Badge className={`${vlm.state === "MOVING" ? "bg-emerald-600" : "bg-zinc-700"}`}>{vlm.state}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                <div>Bay {vlm.bay}</div>
                <div>Shelf {vlm.shelf}</div>
                <div>Queue {vlm.queue}</div>
                <div className="flex items-center gap-1">Door {vlm.doorLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}</div>
              </div>
              <Progress value={vlm.state === "MOVING" ? 60 : 5} className="h-1" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clock-in modal */}
      {clockOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-content-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-[420px] space-y-4">
            <div className="text-lg font-semibold text-white">Clock In Crew</div>
            <Input placeholder="Name" value={clockName} onChange={(e) => setClockName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
            <div className="space-y-1 text-sm text-zinc-300">
              <div>Station</div>
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2"
                value={clockStation}
                onChange={(e) => setClockStation(e.target.value as StationId)}
              >
                {DEFAULT_STATIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={() => setClockOpen(false)} className="bg-zinc-800 text-zinc-200">
                Cancel
              </Button>
              <Button onClick={clockIn} className="bg-emerald-600 hover:bg-emerald-500">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Clock In
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add project modal */}
      {projOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-content-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-[460px] space-y-4">
            <div className="text-lg font-semibold text-white">Add Project / Unit</div>
            <div className="grid grid-cols-2 gap-3 text-sm text-zinc-200">
              <label className="space-y-1">
                <span>Label</span>
                <Input value={projLabel} onChange={(e) => setProjLabel(e.target.value)} className="bg-zinc-800 border-zinc-700" />
              </label>
              <label className="space-y-1">
                <span>Approval date</span>
                <Input type="date" value={projApproval} onChange={(e) => setProjApproval(e.target.value)} className="bg-zinc-800 border-zinc-700" />
              </label>
              <label className="space-y-1">
                <span>Type</span>
                <select className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2" value={projType} onChange={(e) => setProjType(e.target.value as ProjectType)}>
                  <option value="housing">Housing (36m)</option>
                  <option value="modular">Modular (15m)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span>Code cycle</span>
                <select className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2" value={projCycle} onChange={(e) => setProjCycle(e.target.value as CodeCycle)}>
                  <option value="pre2026">Pre-2026 (grandfathered)</option>
                  <option value="post2026">CBSC 2026+</option>
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setProjOpen(false)} className="bg-zinc-800 text-zinc-200">
                Cancel
              </Button>
              <Button onClick={addProject} className="bg-emerald-600 hover:bg-emerald-500">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
