import { useGetPlatformCoverage } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Search, Database, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { PlatformInfoCategory } from "@workspace/api-client-react/src/generated/api.schemas";

export default function PlatformsPage() {
  const { data: platforms, isLoading } = useGetPlatformCoverage();
  const [search, setSearch] = useState("");

  const filteredPlatforms = useMemo(() => {
    if (!platforms) return [];
    if (!search.trim()) return platforms;
    const lower = search.toLowerCase();
    return platforms.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.category.toLowerCase().includes(lower) ||
      (p.libyaSpecific && "libya".includes(lower))
    );
  }, [platforms, search]);

  const categories = useMemo(() => {
    const cats: Record<string, typeof platforms> = {};
    if (!filteredPlatforms) return cats;
    
    filteredPlatforms.forEach(p => {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    return cats;
  }, [filteredPlatforms]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-2 font-mono">
            <Globe className="w-8 h-8" />
            Global Platform Matrix
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Current system coverage across social networks, databases, and region-specific endpoints.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-secondary/50 p-3 rounded-lg border border-border font-mono text-sm">
           <div className="flex items-center gap-2">
             <span className="text-muted-foreground">TOTAL:</span>
             <span className="text-primary font-bold">{platforms?.length || 0}</span>
           </div>
           <div className="w-[1px] h-4 bg-border"></div>
           <div className="flex items-center gap-2">
             <span className="text-muted-foreground">ACTIVE:</span>
             <span className="text-green-500 font-bold">{platforms?.filter(p => p.active).length || 0}</span>
           </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Filter platforms by name, category, or region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 font-mono bg-card border-border h-12"
          data-testid="input-filter-platforms"
        />
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-48 bg-secondary/50" />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-20 w-full bg-secondary/30" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-mono uppercase tracking-widest text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                {category === 'libyan' && <Database className="w-4 h-4 text-primary" />}
                {category === 'social' && <Globe className="w-4 h-4 text-primary" />}
                {category === 'professional' && <Lock className="w-4 h-4 text-primary" />}
                {category} Enclaves
                <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{items.length}</Badge>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {items.map(platform => (
                  <div 
                    key={platform.slug}
                    className={`p-3 rounded border font-mono flex flex-col justify-between h-20 ${
                      platform.active 
                        ? 'bg-card border-border hover:border-primary/50 transition-colors' 
                        : 'bg-secondary/10 border-border/30 opacity-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold truncate pr-2 text-foreground/90" title={platform.name}>
                        {platform.name}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${platform.active ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    </div>
                    {platform.libyaSpecific && (
                      <Badge className="bg-primary/20 text-primary border-primary/20 text-[8px] uppercase px-1 py-0 w-fit">
                        LY Node
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredPlatforms.length === 0 && (
             <div className="text-center p-12 text-muted-foreground border border-dashed border-border rounded-lg font-mono text-sm uppercase">
               No platforms match the specified criteria.
             </div>
          )}
        </div>
      )}
    </div>
  );
}
