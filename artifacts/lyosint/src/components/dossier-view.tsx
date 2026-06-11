import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown, ChevronUp, FileText, User, Shield, GitFork,
  Clock, Database, CheckCircle2, AlertTriangle, Download,
} from "lucide-react";

interface DossierData {
  id: string;
  title: string;
  entityName: string;
  status: string;
  version: number;
}

interface DossierSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: string[];
}

const MOCK_SECTIONS: DossierSection[] = [
  {
    id: "summary", title: "الملخص التنفيذي", icon: FileText,
    content: [
      "تحقيق شامل في هوية وبيانات الهدف أحمد علي محمد، يشمل تحليل الهوية الرقمية، حسابات التواصل، والأدلة المجمعة من مصادر مفتوحة.",
      "نسبة الثقة الإجمالية: 92% - تعتبر عالية جداً بناءً على تعدد مصادر التأكيد وتقاطع المعلومات.",
      "تم تحديد 5 كيانات مرتبطة و 48 دليلاً موزعين على 12 مصدراً مختلفاً.",
    ],
  },
  {
    id: "identity", title: "تحليل الهوية", icon: User,
    content: [
      "الاسم الكامل: أحمد علي محمد",
      "الأسماء المشابهة: أحمد علي، Ahmed Ali، أحمد علي المصراتي",
      "الجنسية: ليبي (محتمل)",
      "المنطقة: طرابلس الكبرى (محتمل بناءً على تحليل الميتاداتا)",
      "تم التأكيد عبر 3 مصادر مستقلة.",
    ],
  },
  {
    id: "evidence", title: "مراجعة الأدلة", icon: Shield,
    content: [
      "إجمالي الأدلة المجمعة: 48 دليلاً",
      "أدلة عالية الثقة (80%+): 32 دليلاً (67%)",
      "أدلة متوسطة الثقة (50-80%): 12 دليلاً (25%)",
      "أدلة منخفضة الثقة (-50%): 4 أدلة (8%)",
      "أبرز المصادر: تيليغرام، فيسبوك، X، قاعدة بيانات اتصالات، تسريبات 2024.",
    ],
  },
  {
    id: "relationships", title: "خريطة العلاقات", icon: GitFork,
    content: [
      "تم تحديد 7 علاقات مباشرة بين الكيانات.",
      "الشبكة تضم: 5 أشخاص، 3 أرقام هواتف، 2 معرفات، 2 بريد إلكتروني، مؤسستين.",
      "أقوى العلاقات: صلة قرابة (82%)، علاقة عمل (88%)، اتصال هاتفي (75%).",
    ],
  },
  {
    id: "timeline", title: "الخط الزمني", icon: Clock,
    content: [
      "2026-06-03: فتح التحقيق بناءً على بلاغ.",
      "2026-06-05: ربط 3 حسابات على منصات مختلفة بنفس الهوية.",
      "2026-06-07: اكتشاف تسريب بيانات يحتوي البريد الإلكتروني للهدف.",
      "2026-06-08: تحديد موقع جغرافي محتمل عبر تحليل الميتاداتا.",
      "2026-06-09: تأكيد ملكية رقم الهاتف عبر قاعدة بيانات المشغل.",
      "2026-06-10: رصد حساب تيليغرام نشط مرتبط بالهدف.",
    ],
  },
  {
    id: "sources", title: "مراجع المصادر", icon: Database,
    content: [
      "Telegram API - حساب مباشر للهدف",
      "Phone Database API - سجلات مشغل اتصالات",
      "BreachDB - تسريب بيانات 2024",
      "Facebook Graph API - منشور عام",
      "X API - تغريدات مرتبطة",
      "OSINT Framework - أدوات مفتوحة المصدر",
    ],
  },
  {
    id: "confidence", title: "تقييم الثقة", icon: CheckCircle2,
    content: [
      "تطابق الاسم: 95% - تأكيد من 3 مصادر مستقلة",
      "تطابق الهاتف: 92% - تأكيد عبر قاعدة بيانات المشغل",
      "تطابق البريد الإلكتروني: 88% - تأكيد عبر تسريب ومصدر آخر",
      "نشاط التواصل الاجتماعي: 85% - نشاط مستمر منذ 3 سنوات",
      "تسريبات البيانات: 76% - معلومات جزئية في قاعدة مسربة",
      "التوصية: تعتبر الهوية موثوقة بدرجة عالية ومناسبة للاستخدام في الإجراءات الرسمية.",
    ],
  },
];

export function DossierView({ dossier }: { dossier: DossierData }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(MOCK_SECTIONS.map((s) => s.id)));
  const [activeSection, setActiveSection] = useState<string>(MOCK_SECTIONS[0].id);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex gap-4">
      {/* TOC Sidebar */}
      <div className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-20 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-2 px-2">المحتويات</p>
          {MOCK_SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-right flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                activeSection === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              }`}>
              <s.icon className="w-3 h-3 shrink-0" />
              {s.title}
            </button>
          ))}
        </div>
      </div>

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

          {/* Notion-like Sections */}
          {MOCK_SECTIONS.map((section) => {
            const isOpen = expandedSections.has(section.id);
            return (
              <div key={section.id} className="group" id={`section-${section.id}`}>
                <button onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-secondary/20 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <section.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-base font-bold flex-1 text-right">{section.title}</h2>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
                </button>
                {isOpen && (
                  <div className="pr-12 pb-4 space-y-3 fade-in">
                    {section.content.map((line, i) => (
                      <p key={i} className={`text-sm leading-relaxed ${line.startsWith("إجمالي") || line.startsWith("أقوى") || line.startsWith("التوصية") ? "font-medium" : "text-foreground/85"}`}>
                        {line.startsWith("- ") ? (
                          <span className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                            <span>{line.slice(2)}</span>
                          </span>
                        ) : line.startsWith("2026") ? (
                          <span className="flex items-start gap-2">
                            <span className="text-[10px] font-mono text-primary/70 mt-0.5 shrink-0 w-24 text-left">{line.split(":")[0]}</span>
                            <span>{line.split(":").slice(1).join(":").trim()}</span>
                          </span>
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                  </div>
                )}
                <Separator className="border-border/20" />
              </div>
            );
          })}

          {/* Footer */}
          <div className="text-center py-6 text-[10px] text-muted-foreground/40 font-mono">
            <p>تم إنشاء هذا الملف تلقائياً بواسطة منصة Lyosint</p>
            <p>تاريخ الإنشاء: 2026-06-10 | المعرف: {dossier.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
