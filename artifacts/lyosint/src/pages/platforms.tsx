import { useGetPlatformCoverage } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Search, Database, Code, MessageSquare, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";

const CATEGORY_LABELS: Record<string, string> = {
  social: "شبكات التواصل",
  libyan: "منصات ليبية",
  professional: "مهني",
  messaging: "مراسلة",
  code: "البرمجة",
  other: "أخرى",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  social: <Globe className="w-4 h-4 text-primary" />,
  libyan: <Database className="w-4 h-4 text-primary" />,
  professional: <Briefcase className="w-4 h-4 text-primary" />,
  messaging: <MessageSquare className="w-4 h-4 text-primary" />,
  code: <Code className="w-4 h-4 text-primary" />,
  other: <Globe className="w-4 h-4 text-primary" />,
};

const CATEGORY_ORDER = ["libyan", "social", "messaging", "professional", "code", "other"];

export default function PlatformsPage() {
  const { data: platforms, isLoading } = useGetPlatformCoverage();
  const [search, setSearch] = useState("");

  const filteredPlatforms = useMemo(() => {
    if (!platforms) return [];
    if (!search.trim()) return platforms;
    const lower = search.toLowerCase();
    return platforms.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower) ||
        (p.libyaSpecific && "libya".includes(lower))
    );
  }, [platforms, search]);

  const categories = useMemo(() => {
    const cats: Record<string, typeof filteredPlatforms> = {};
    filteredPlatforms.forEach((p) => {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    return cats;
  }, [filteredPlatforms]);

  const orderedCategories = CATEGORY_ORDER.filter((c) => categories[c]);

  return (
    <div className="space-y-6 sm:space-y-8 page-transition" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-2 sm:gap-3 text-glow">
            <Globe className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            مصفوفة المنصات
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            تغطية النظام عبر الشبكات الاجتماعية وقواعد البيانات والنقاط الإقليمية.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-secondary/40 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-border font-mono text-sm shrink-0 self-start">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">الإجمالي:</span>
            <span className="text-primary font-bold">{platforms?.length || 0}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">نشط:</span>
            <span className="text-green-500 font-bold">{platforms?.filter((p) => p.active).length || 0}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="ابحث عن منصة بالاسم أو الفئة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-card border-border h-11"
          data-testid="input-filter-platforms"
          dir="auto"
        />
      </div>

      {isLoading ? (
        <div className="space-y-6 sm:space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3 sm:space-y-4">
              <Skeleton className="h-7 w-40 bg-secondary/50" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                {Array(6).fill(0).map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full bg-secondary/30" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {orderedCategories.map((category) => {
            const items = categories[category];
            return (
              <div key={category} className="space-y-3 sm:space-y-4">
                <h2 className="text-sm sm:text-base uppercase tracking-widest text-foreground flex items-center gap-2 border-b border-border/40 pb-3 font-mono">
                  {CATEGORY_ICONS[category]}
                  {CATEGORY_LABELS[category] ?? category}
                  <Badge variant="secondary" className="mr-2 font-mono text-[10px]">
                    {items.length}
                  </Badge>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                  {items.map((platform, idx) => (
                    <div
                      key={platform.slug}
                      className={`p-3 rounded border font-mono flex flex-col justify-between min-h-[4.5rem] sm:h-20 transition-all duration-200 stagger-item ${
                        platform.active
                          ? "bg-card border-border hover:border-primary/40 hover:bg-primary/5 group"
                          : "bg-secondary/10 border-border/20 opacity-40"
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                      data-testid={`platform-${platform.slug}`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span
                          className="text-xs sm:text-sm font-bold truncate text-foreground/90 group-hover:text-primary transition-colors"
                          title={platform.name}
                        >
                          {platform.name}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                            platform.active
                              ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                              : "bg-red-500"
                          }`}
                        />
                      </div>
                      {platform.libyaSpecific && (
                        <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] uppercase px-1.5 py-0.5 w-fit mt-1">
                          LY Node
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredPlatforms.length === 0 && (
            <div className="text-center p-10 sm:p-14 text-muted-foreground border border-dashed border-border rounded-lg text-sm">
              لا توجد منصات تطابق المعايير المحددة.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
