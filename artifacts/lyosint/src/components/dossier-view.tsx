import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown, ChevronUp, FileText, User, Shield, GitFork,
  Clock, Database, CheckCircle2,
} from "lucide-react";

interface DossierData {
  id: string;
  title: string;
  entityName: string;
  status: string;
  version: number;
  sections?: Array<{ type: string; title: string; content: string }>;
  summary?: string;
}

const SECTION_ICONS: Record<string, React.ElementType> = {
  summary: FileText,
  identity: User,
  evidence: Shield,
  relationships: GitFork,
  timeline: Clock,
  sources: Database,
  confidence: CheckCircle2,
};

const DEFAULT_ICON = FileText;

export function DossierView({ dossier }: { dossier: DossierData }) {
  const sections = dossier.sections || [];
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((_, i) => `section-${i}`))
  );
  const [activeSection, setActiveSection] = useState<string>(
    sections.length > 0 ? `section-0` : ""
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const TOC_ENTRIES = sections.map((s, i) => ({
    id: `section-${i}`,
    title: s.title,
    type: s.type,
  }));

  return (
    <div className="flex gap-4">
      {/* TOC Sidebar */}
      {TOC_ENTRIES.length > 0 && (
        <div className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-20 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-2 px-2">المحتويات</p>
            {TOC_ENTRIES.map((s) => {
              const Icon = SECTION_ICONS[s.type] || DEFAULT_ICON;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full text-right flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                    activeSection === s.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                  }`}>
                  <Icon className="w-3 h-3 shrink-0" />
                  {s.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Document */}
      <div className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto space-y-1">
          {/* Title Page */}
          <div className="text-center py-8 mb-4 border-b border-border/30">
            <h1 className="text-2xl font-bold mb-2">{dossier.title}</h1>
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground font-mono">
              <span>إصدار {dossier.version}</span>
              <span>•</span>
              <span>{dossier.entityName}</span>
              <span>•</span>
              <Badge className="text-[9px] font-mono">سرّي</Badge>
            </div>
          </div>

          {/* Summary */}
          {dossier.summary && (
            <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-3 mb-4">
              <p className="text-sm text-muted-foreground leading-relaxed" dir="auto">{dossier.summary}</p>
            </div>
          )}

          {/* Sections */}
          {sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد أقسام في هذا الملف</p>
            </div>
          ) : (
            sections.map((section, i) => {
              const sectionId = `section-${i}`;
              const isOpen = expandedSections.has(sectionId);
              const Icon = SECTION_ICONS[section.type] || DEFAULT_ICON;
              const lines = section.content.split("\n").filter(Boolean);
              return (
                <div key={i} className="group" id={sectionId}>
                  <button onClick={() => toggleSection(sectionId)}
                    className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-secondary/20 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h2 className="text-base font-bold flex-1 text-right">{section.title}</h2>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
                  </button>
                  {isOpen && (
                    <div className="pr-12 pb-4 space-y-3 fade-in">
                      {lines.map((line, j) => (
                        <p key={j} className="text-sm leading-relaxed text-foreground/85" dir="auto">{line}</p>
                      ))}
                    </div>
                  )}
                  <Separator className="border-border/20" />
                </div>
              );
            })
          )}

          {/* Footer */}
          <div className="text-center py-6 text-[10px] text-muted-foreground/40 font-mono">
            <p>تم إنشاء هذا الملف تلقائياً بواسطة منصة Lyosint</p>
            <p>المعرف: {dossier.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
