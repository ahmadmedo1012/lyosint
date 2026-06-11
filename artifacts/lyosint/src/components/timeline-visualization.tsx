import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, CalendarDays } from "lucide-react";

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  confidence: number;
}

interface TimelineProps {
  events: TimelineEvent[];
}

type GroupMode = "day" | "week" | "month" | "year";

function getConfidenceColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-destructive";
}

function getConfidenceBadge(score: number): string {
  if (score >= 80) return "bg-green-500/10 text-green-400 border-green-500/25";
  if (score >= 50) return "bg-amber-500/10 text-amber-400 border-amber-500/25";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function groupEvents(events: TimelineEvent[], mode: GroupMode): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.date);
    let key: string;
    if (mode === "day") key = ev.date;
    else if (mode === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      key = start.toISOString().split("T")[0];
    } else if (mode === "month") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    else key = `${d.getFullYear()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function formatGroupLabel(key: string, mode: GroupMode): string {
  if (mode === "day") {
    const d = new Date(key);
    return d.toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  if (mode === "week") {
    const d = new Date(key);
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return `${d.toLocaleDateString("ar", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("ar", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (mode === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("ar", { year: "numeric", month: "long" });
  }
  return key;
}

export function TimelineVisualization({ events }: TimelineProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("day");
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const grouped = groupEvents(events, groupMode);

  const handleZoom = (dir: number) => {
    setZoom((z) => Math.max(0.5, Math.min(3, z + dir * 0.25)));
  };

  const scroll = (dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        لا توجد أحداث في الخط الزمني
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="ltr">
      {/* Controls */}
      <div className="flex items-center justify-between" dir="rtl">
        <div className="flex items-center gap-1.5">
          {(["day", "week", "month", "year"] as GroupMode[]).map((mode) => (
            <button key={mode} onClick={() => setGroupMode(mode)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all ${
                groupMode === mode
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}>
              {mode === "day" ? "يوم" : mode === "week" ? "أسبوع" : mode === "month" ? "شهر" : "سنة"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => handleZoom(-1)} className="p-1 rounded hover:bg-secondary/30 text-muted-foreground"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => handleZoom(1)} className="p-1 rounded hover:bg-secondary/30 text-muted-foreground"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" dir="rtl">
        <div className="flex items-center gap-1 mb-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll(-1)}><ChevronRight className="w-3 h-3" /></Button>
          <div ref={scrollRef} className="flex-1 overflow-x-auto scroll-smooth no-scrollbar">
            <div className="relative" style={{ minWidth: `${grouped.size * 220 * zoom}px` }}>
              {/* Center line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/30 -translate-y-1/2" />

              <div className="flex items-start gap-4 py-4" style={{ transform: `scaleX(${zoom})`, transformOrigin: "right center" }}>
                {Array.from(grouped.entries()).map(([key, evs]) => (
                  <div key={key} className="flex flex-col items-center gap-2 min-w-[180px]">
                    {/* Date marker */}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mb-2 bg-card px-2 py-1 rounded-md border border-border/30 whitespace-nowrap">
                      <CalendarDays className="w-3 h-3" />
                      {formatGroupLabel(key, groupMode)}
                    </div>

                    {/* Events */}
                    <div className="space-y-2 w-full">
                      {evs.map((ev, i) => (
                        <Popover key={`${ev.date}-${i}`}>
                          <PopoverTrigger asChild>
                            <button className="w-full text-right p-3 rounded-lg border border-border/30 bg-card hover:border-primary/30 hover:bg-primary/4 transition-all group">
                              <div className="flex items-start gap-2">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getConfidenceColor(ev.confidence)}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium group-hover:text-primary transition-colors line-clamp-1">{ev.title}</div>
                                  <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{ev.description}</div>
                                </div>
                                <Badge className={`text-[8px] font-mono border shrink-0 mt-0.5 ${getConfidenceBadge(ev.confidence)}`}>
                                  {ev.confidence}%
                                </Badge>
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" side="top">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${getConfidenceColor(ev.confidence)}`} />
                                <span className="font-bold text-sm">{ev.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{ev.description}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
                                <span>{ev.date}</span>
                                <Badge className={`text-[8px] font-mono border ${getConfidenceBadge(ev.confidence)}`}>
                                  الثقة: {ev.confidence}%
                                </Badge>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll(1)}><ChevronLeft className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
}
