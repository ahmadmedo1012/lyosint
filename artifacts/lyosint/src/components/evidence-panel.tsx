import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Search, Shield, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, AlertTriangle, Filter, ArrowUpDown, ExternalLink,
  Clock, Database,
} from "lucide-react";

export interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  confidence: number;
  date: string;
  summary: string;
}

interface EvidencePanelProps {
  evidence: EvidenceItem[];
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  messaging: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  database: "bg-green-500/10 text-green-400 border-green-500/25",
  social: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  breach: "bg-destructive/10 text-destructive border-destructive/30",
  web: "bg-amber-500/10 text-amber-400 border-amber-500/25",
};

type SortField = "confidence" | "date" | "source";
type FilterStatus = "all" | "verified" | "disputed" | "debunked";

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [verificationStatus, setVerificationStatus] = useState<Record<string, "verified" | "disputed" | "debunked">>({});

  const filtered = useMemo(() => evidence
    .filter((ev) => !search || ev.title.includes(search) || ev.summary.includes(search))
    .sort((a, b) => {
      if (sortField === "confidence") return b.confidence - a.confidence;
      if (sortField === "date") return b.date.localeCompare(a.date);
      return a.source.localeCompare(b.source);
    })
    .filter((ev) => {
      if (statusFilter === "all") return true;
      return (verificationStatus[ev.id] ?? "all") === statusFilter;
    }), [evidence, search, sortField, statusFilter, verificationStatus]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="بحث في الأدلة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8 h-9 text-xs" />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-full sm:w-[120px] h-9 text-xs"><ArrowUpDown className="w-3 h-3 ml-1" />ترتيب</SelectTrigger>
          <SelectContent>
            <SelectItem value="confidence">الثقة</SelectItem>
            <SelectItem value="date">التاريخ</SelectItem>
            <SelectItem value="source">المصدر</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-full sm:w-[120px] h-9 text-xs"><Filter className="w-3 h-3 ml-1" />حالة</SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="verified">موثّق</SelectItem>
            <SelectItem value="disputed">مشكوك</SelectItem>
            <SelectItem value="debunked">مدحوض</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Evidence List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/30 rounded-lg">
            <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            لا توجد أدلة مطابقة
          </div>
        ) : filtered.map((ev) => {
          const isExpanded = expandedId === ev.id;
          const verification = verificationStatus[ev.id];
          return (
            <div key={ev.id} className="rounded-lg border border-border/30 bg-card overflow-hidden transition-all hover:border-border/60">
              <button onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                className="w-full text-right p-3.5 flex items-start justify-between gap-3 hover:bg-secondary/10 transition-colors">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{ev.title}</span>
                    <Badge className={`text-[9px] font-mono border ${SOURCE_TYPE_COLORS[ev.sourceType] || "bg-secondary/30 text-muted-foreground border-border/30"}`}>
                      {ev.source}
                    </Badge>
                    {verification && (
                      <Badge className={`text-[9px] font-mono border ${
                        verification === "verified" ? "bg-green-500/10 text-green-400 border-green-500/25" :
                        verification === "disputed" ? "bg-amber-500/10 text-amber-400 border-amber-500/25" :
                        "bg-destructive/10 text-destructive border-destructive/30"
                      }`}>
                        {verification === "verified" ? "موثّق" : verification === "disputed" ? "مشكوك" : "مدحوض"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 font-mono">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ev.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-center">
                    <div className={`text-sm font-bold font-mono tabular-nums ${ev.confidence > 80 ? "text-green-400" : ev.confidence > 50 ? "text-amber-400" : "text-destructive"}`}>
                      {ev.confidence}%
                    </div>
                    <div className="w-full h-1 rounded-full bg-secondary mt-0.5 overflow-hidden min-w-[40px]">
                      <div className={`h-full rounded-full ${ev.confidence > 80 ? "bg-green-500" : ev.confidence > 50 ? "bg-amber-500" : "bg-destructive"}`}
                        style={{ width: `${ev.confidence}%` }} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-0 border-t border-border/20 fade-in">
                  <div className="pt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">{ev.summary}</p>

                    {/* Verification Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono">التحقق:</span>
                      <button onClick={() => setVerificationStatus((v) => ({ ...v, [ev.id]: "verified" }))}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          verification === "verified"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : "bg-secondary/30 text-muted-foreground border border-border/30 hover:border-green-500/30"
                        }`}>
                        <CheckCircle2 className="w-3 h-3" /> توثيق
                      </button>
                      <button onClick={() => setVerificationStatus((v) => ({ ...v, [ev.id]: "disputed" }))}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          verification === "disputed"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-secondary/30 text-muted-foreground border border-border/30 hover:border-amber-500/30"
                        }`}>
                        <AlertTriangle className="w-3 h-3" /> تشكيك
                      </button>
                      <button onClick={() => setVerificationStatus((v) => ({ ...v, [ev.id]: "debunked" }))}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          verification === "debunked"
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-secondary/30 text-muted-foreground border border-border/30 hover:border-destructive/30"
                        }`}>
                        <XCircle className="w-3 h-3" /> دحض
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
