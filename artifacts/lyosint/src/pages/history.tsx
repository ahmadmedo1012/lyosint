import { useListRecentSearches } from "@workspace/api-client-react";
import { Link } from "wouter";
import { History as HistoryIcon, Search, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
  const { data: history, isLoading } = useListRecentSearches({ limit: 50 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-2 font-mono">
          <HistoryIcon className="w-8 h-8" />
          Operation Logs
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Chronological record of all investigation sessions.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-secondary/30 text-xs font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-2">Time</div>
          <div className="col-span-2">Vector</div>
          <div className="col-span-4">Target Query</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Confidence</div>
        </div>

        <div className="divide-y divide-border/50">
          {isLoading ? (
            Array(10).fill(0).map((_, i) => (
              <div key={i} className="p-4 flex gap-4">
                <Skeleton className="h-6 w-full bg-secondary/30" />
              </div>
            ))
          ) : history && history.length > 0 ? (
            history.map((session) => (
              <Link key={session.id} href={`/search/${session.id}`}>
                <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/20 transition-colors cursor-pointer group font-mono text-sm" data-testid={`log-row-${session.id}`}>
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {new Date(session.createdAt).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="uppercase text-[10px] text-primary border-primary/30">
                      {session.type}
                    </Badge>
                  </div>
                  <div className="col-span-4 font-bold text-foreground group-hover:text-primary transition-colors truncate pr-4">
                    {session.query}
                  </div>
                  <div className="col-span-2">
                    <span className={`text-xs uppercase flex items-center gap-1 ${
                      session.status === 'completed' ? 'text-green-500' :
                      session.status === 'failed' ? 'text-destructive' : 'text-amber-500'
                    }`}>
                      {session.status === 'running' && <Search className="w-3 h-3 animate-spin" />}
                      {session.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                      {session.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    {session.confidenceScore !== null && session.confidenceScore !== undefined ? (
                      <span className={`font-bold ${
                        session.confidenceScore > 75 ? 'text-green-500' : 
                        session.confidenceScore > 40 ? 'text-amber-500' : 'text-destructive'
                      }`}>
                        {session.confidenceScore}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
             <div className="p-12 text-center text-muted-foreground font-mono uppercase text-sm">
               No operation logs found in the system.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
