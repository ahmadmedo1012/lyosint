import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetStats,
  useSearchByName,
  useSearchByPhone,
  useSearchByUsername,
  useDeepSearch,
  useListRecentSearches,
  getListRecentSearchesQueryKey
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Phone, AtSign, Zap, Activity, Clock, ShieldAlert, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [, setLocation] = useState();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  const searchByName = useSearchByName();
  const searchByPhone = useSearchByPhone();
  const searchByUsername = useSearchByUsername();
  const deepSearch = useDeepSearch();

  const handleSuccess = (data: any) => {
    queryClient.invalidateQueries({ queryKey: getListRecentSearchesQueryKey() });
    setLocation(`/search/${data.id}`);
  };

  const handleNameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    searchByName.mutate(
      { data: { name } },
      { onSuccess: handleSuccess }
    );
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    searchByPhone.mutate(
      { data: { phone } },
      { onSuccess: handleSuccess }
    );
  };

  const handleUsernameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    searchByUsername.mutate(
      { data: { username } },
      { onSuccess: handleSuccess }
    );
  };

  const handleDeepSearch = () => {
    if (!name.trim() && !phone.trim() && !username.trim()) return;
    deepSearch.mutate(
      { data: { name: name || undefined, phone: phone || undefined, username: username || undefined } },
      { onSuccess: handleSuccess }
    );
  };

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recent, isLoading: recentLoading } = useListRecentSearches({ limit: 5 });

  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-2">
          <Activity className="w-8 h-8" />
          Intelligence Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Select investigation vector. All queries are logged and monitored.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Initiate Query
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="name" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/50 mb-6">
                  <TabsTrigger value="name" className="font-mono uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <User className="w-4 h-4 mr-2" /> Name
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="font-mono uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Phone className="w-4 h-4 mr-2" /> Phone
                  </TabsTrigger>
                  <TabsTrigger value="username" className="font-mono uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <AtSign className="w-4 h-4 mr-2" /> Username
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="name">
                  <form onSubmit={handleNameSearch} className="flex gap-4">
                    <Input 
                      placeholder="Enter full or partial name (Ar/En)" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="font-mono text-lg h-12 bg-background border-primary/30 focus-visible:ring-primary"
                      data-testid="input-search-name"
                    />
                    <Button type="submit" disabled={isAnyLoading || !name.trim()} className="h-12 px-8 font-mono uppercase font-bold tracking-wider" data-testid="button-search-name">
                      Execute
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="phone">
                  <form onSubmit={handlePhoneSearch} className="flex gap-4">
                    <Input 
                      placeholder="e.g. +21891XXXXXXX or 092XXXXXXX" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)}
                      className="font-mono text-lg h-12 bg-background border-primary/30 focus-visible:ring-primary"
                      data-testid="input-search-phone"
                    />
                    <Button type="submit" disabled={isAnyLoading || !phone.trim()} className="h-12 px-8 font-mono uppercase font-bold tracking-wider" data-testid="button-search-phone">
                      Execute
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="username">
                  <form onSubmit={handleUsernameSearch} className="flex gap-4">
                    <Input 
                      placeholder="Enter username handle" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)}
                      className="font-mono text-lg h-12 bg-background border-primary/30 focus-visible:ring-primary"
                      data-testid="input-search-username"
                    />
                    <Button type="submit" disabled={isAnyLoading || !username.trim()} className="h-12 px-8 font-mono uppercase font-bold tracking-wider" data-testid="button-search-username">
                      Execute
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-8 pt-6 border-t border-border/50 flex flex-col items-center gap-4">
                <div className="text-xs text-muted-foreground uppercase tracking-widest text-center">
                  Cross-Reference Engine
                </div>
                <Button 
                  onClick={handleDeepSearch}
                  disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
                  variant="destructive"
                  className="w-full max-w-md h-12 font-mono uppercase tracking-widest font-bold bg-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/50"
                  data-testid="button-deep-search"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Deep Search All Vectors
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Operations
            </h2>
            <div className="grid gap-3">
              {recentLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-secondary/50 rounded-lg" />
                ))
              ) : recent?.map((item) => (
                <Link key={item.id} href={`/search/${item.id}`}>
                  <div className="bg-card border border-border hover:border-primary/50 transition-colors p-4 rounded-lg flex items-center justify-between cursor-pointer group" data-testid={`history-item-${item.id}`}>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="uppercase font-mono text-[10px] text-primary border-primary/30 bg-primary/5">
                        {item.type}
                      </Badge>
                      <span className="font-mono font-medium group-hover:text-primary transition-colors">
                        {item.query}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                         <div className="flex items-center gap-2">
                           <span className="text-muted-foreground font-mono text-[10px] uppercase">Conf:</span>
                           <span className={`font-mono ${item.confidenceScore > 75 ? 'text-green-500' : item.confidenceScore > 40 ? 'text-amber-500' : 'text-destructive'}`}>
                             {item.confidenceScore}%
                           </span>
                         </div>
                      )}
                      <span className="text-muted-foreground text-xs font-mono">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              {recent?.length === 0 && (
                <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-lg font-mono text-sm">
                  No recent operations found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-secondary/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 font-mono">
              {statsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : stats ? (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">Total Inquiries</div>
                    <div className="text-2xl font-bold text-primary">{stats.totalSearches.toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">Findings Rate</div>
                    <div className="text-2xl font-bold text-foreground">
                      {Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">Platforms Covered</div>
                    <div className="text-2xl font-bold text-primary">{stats.platformsCovered}</div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
