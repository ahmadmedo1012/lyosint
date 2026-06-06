import { useParams } from "wouter";
import { useGetSearchStatus, getGetSearchStatusQueryKey, useGetSearchResult } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, Phone, AtSign, CheckCircle2, AlertTriangle, XCircle, Search, ExternalLink, MapPin, Network, Info, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchResult, SearchTaskStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export default function SearchResultPage() {
  const { id } = useParams();
  
  const { data: statusData } = useGetSearchStatus(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetSearchStatusQueryKey(id!),
      refetchInterval: (data) => {
        // Stop polling if completed or failed
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        return 1500;
      }
    }
  });

  const isCompleted = statusData?.status === 'completed';
  const isFailed = statusData?.status === 'failed';
  
  const { data: resultData, isLoading: resultLoading } = useGetSearchResult(id!, {
    query: {
      enabled: !!id && isCompleted,
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-primary uppercase tracking-wider">
              Dossier: {statusData?.query || 'Unknown'}
            </h1>
            <Badge variant="outline" className="font-mono uppercase text-[10px] border-primary/50 text-primary">
              {statusData?.type || '...'}
            </Badge>
          </div>
          <div className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            Task ID: <span className="text-foreground/70">{id}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
           {statusData?.status === 'running' || statusData?.status === 'pending' ? (
             <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/50 uppercase font-mono animate-pulse">
               Processing
             </Badge>
           ) : statusData?.status === 'completed' ? (
             <Badge className="bg-green-500/20 text-green-500 border border-green-500/50 uppercase font-mono">
               Completed
             </Badge>
           ) : statusData?.status === 'failed' ? (
             <Badge variant="destructive" className="uppercase font-mono">
               Failed
             </Badge>
           ) : null}
        </div>
      </div>

      {(!isCompleted && !isFailed) && (
        <Card className="bg-secondary/30 border-primary/30">
          <CardContent className="pt-6 space-y-6">
             <div className="flex justify-between items-center font-mono text-sm uppercase">
               <span className="text-muted-foreground flex items-center gap-2">
                 <Search className="w-4 h-4 animate-spin text-primary" />
                 Scanning Networks...
               </span>
               <span className="text-primary font-bold">{statusData?.progress || 0}%</span>
             </div>
             <Progress value={statusData?.progress || 0} className="h-2 bg-secondary" indicatorClassName="bg-primary transition-all duration-500" />
             <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
               <span>Platforms Searched: {statusData?.platformsSearched || 0}</span>
               <span>Total Targets: {statusData?.platformsTotal || 0}</span>
             </div>
          </CardContent>
        </Card>
      )}

      {isFailed && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6 flex items-center gap-4 text-destructive font-mono">
            <XCircle className="w-8 h-8" />
            <div>
              <div className="font-bold uppercase tracking-wider text-lg">Operation Failed</div>
              <div className="text-sm opacity-80 mt-1">Unable to complete intelligence gathering for this target.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {isCompleted && resultLoading && (
        <div className="space-y-4">
           <Skeleton className="h-32 w-full bg-secondary/30" />
           <Skeleton className="h-64 w-full bg-secondary/30" />
        </div>
      )}

      {isCompleted && resultData && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
           
           {/* Confidence Score Header */}
           {resultData.confidenceScore !== undefined && resultData.confidenceScore !== null && (
             <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between">
                <div className="font-mono text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Target Confidence Score
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  resultData.confidenceScore > 80 ? 'text-green-500' :
                  resultData.confidenceScore > 40 ? 'text-amber-500' : 'text-destructive'
                }`}>
                  {resultData.confidenceScore}%
                </div>
             </div>
           )}

           {/* Name Results */}
           {resultData.nameResult && (
             <Card className="border-primary/20 bg-card">
               <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                 <CardTitle className="text-sm font-mono uppercase text-foreground flex items-center gap-2">
                   <User className="w-4 h-4 text-primary" /> Personal Intelligence
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Full Name</div>
                      <div className="font-mono text-lg font-bold text-foreground">{resultData.nameResult.fullName || 'UNKNOWN'}</div>
                    </div>
                    
                    {resultData.nameResult.possibleVariations && resultData.nameResult.possibleVariations.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Known Aliases</div>
                        <div className="flex flex-wrap gap-2">
                          {resultData.nameResult.possibleVariations.map(alias => (
                            <Badge key={alias} variant="secondary" className="font-mono text-xs font-normal">{alias}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>

                 <div className="space-y-4">
                    {resultData.nameResult.phoneNumbers && resultData.nameResult.phoneNumbers.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1">
                           <Phone className="w-3 h-3" /> Associated Phones
                        </div>
                        <ul className="space-y-1 font-mono text-sm">
                          {resultData.nameResult.phoneNumbers.map(phone => (
                            <li key={phone} className="text-primary">{phone}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {resultData.nameResult.addresses && resultData.nameResult.addresses.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1">
                           <MapPin className="w-3 h-3" /> Locations
                        </div>
                        <ul className="space-y-2 font-mono text-xs text-foreground/80">
                          {resultData.nameResult.addresses.map(addr => (
                            <li key={addr} className="bg-secondary/50 p-2 rounded border border-border/50">{addr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Phone Results */}
           {resultData.phoneResult && (
             <Card className="border-primary/20 bg-card">
               <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                 <CardTitle className="text-sm font-mono uppercase text-foreground flex items-center gap-2">
                   <Phone className="w-4 h-4 text-primary" /> Telecommunications Data
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-2xl font-bold text-foreground">
                        {resultData.phoneResult.nationalFormat || resultData.phoneResult.phone}
                      </div>
                      <Badge variant="outline" className={`font-mono text-xs uppercase ${resultData.phoneResult.valid ? 'text-green-500 border-green-500/50' : 'text-destructive border-destructive'}`}>
                        {resultData.phoneResult.valid ? 'VALID' : 'INVALID'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/30 p-3 rounded border border-border/50">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Carrier</div>
                        <div className="font-mono text-sm font-bold flex items-center gap-2">
                          <Network className="w-3 h-3 text-primary" />
                          <span className={
                            resultData.phoneResult.carrier?.includes('Madar') ? 'text-blue-400' :
                            resultData.phoneResult.carrier?.includes('Libyana') ? 'text-purple-400' : 'text-foreground'
                          }>
                            {resultData.phoneResult.carrier || 'UNKNOWN'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-secondary/30 p-3 rounded border border-border/50">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Line Type</div>
                        <div className="font-mono text-sm font-bold text-foreground">
                          {resultData.phoneResult.lineType || 'UNKNOWN'}
                        </div>
                      </div>
                    </div>

                    {(resultData.phoneResult.possibleOwner || resultData.phoneResult.possibleOwnerEn) && (
                      <div className="bg-primary/5 p-4 rounded border border-primary/20">
                        <div className="text-[10px] font-mono text-primary uppercase mb-2 flex items-center gap-1">
                          <User className="w-3 h-3" /> Possible Owner Match
                        </div>
                        <div className="font-mono text-lg">{resultData.phoneResult.possibleOwner}</div>
                        {resultData.phoneResult.possibleOwnerEn && (
                          <div className="font-mono text-sm text-muted-foreground mt-1">{resultData.phoneResult.possibleOwnerEn}</div>
                        )}
                      </div>
                    )}
                 </div>

                 <div className="space-y-6">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Connected Platforms</div>
                      <div className="flex gap-4">
                        <Badge variant="outline" className={`font-mono text-xs px-3 py-1 ${resultData.phoneResult.whatsapp ? 'bg-green-500/10 text-green-500 border-green-500/50' : 'opacity-40'}`}>
                          WhatsApp {resultData.phoneResult.whatsapp && '✓'}
                        </Badge>
                        <Badge variant="outline" className={`font-mono text-xs px-3 py-1 ${resultData.phoneResult.telegramRegistered ? 'bg-blue-500/10 text-blue-500 border-blue-500/50' : 'opacity-40'}`}>
                          Telegram {resultData.phoneResult.telegramRegistered && '✓'}
                        </Badge>
                      </div>
                    </div>

                    {resultData.phoneResult.breachInfo && resultData.phoneResult.breachInfo.length > 0 && (
                      <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3">
                        <div className="text-[10px] font-mono text-amber-500 uppercase mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Data Breaches
                        </div>
                        <ul className="list-disc list-inside pl-4 text-xs font-mono text-amber-500/80 space-y-1">
                          {resultData.phoneResult.breachInfo.map(breach => (
                            <li key={breach}>{breach}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Username Results */}
           {resultData.usernameResult && (
             <Card className="border-primary/20 bg-card">
               <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-sm font-mono uppercase text-foreground flex items-center gap-2">
                     <AtSign className="w-4 h-4 text-primary" /> Digital Footprint
                   </CardTitle>
                   <div className="text-xs font-mono text-muted-foreground">
                     Found <span className="text-primary font-bold">{resultData.usernameResult.totalFound}</span> / {resultData.usernameResult.totalPlatformsSearched} platforms
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="pt-6">
                  {resultData.usernameResult.possibleEmail && (
                    <div className="mb-6 bg-secondary/30 p-3 rounded inline-block border border-border/50 font-mono text-sm">
                      <span className="text-[10px] text-muted-foreground uppercase mr-2">Associated Email:</span>
                      <span className="text-primary">{resultData.usernameResult.possibleEmail}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {resultData.usernameResult.profilesFound && Object.entries(resultData.usernameResult.profilesFound).map(([platform, profile]) => (
                      <div 
                        key={platform} 
                        className={`p-4 rounded border font-mono ${
                          profile.exists 
                            ? 'bg-primary/5 border-primary/30 relative overflow-hidden group' 
                            : 'bg-secondary/10 border-border/30 opacity-50 grayscale'
                        }`}
                      >
                        {profile.exists && (
                          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                           <Globe className="w-3 h-3 text-primary" />
                           {platform}
                        </div>
                        {profile.exists ? (
                           <div className="space-y-2 mt-3 text-xs">
                             {profile.displayName && (
                               <div className="text-foreground truncate" title={profile.displayName}>{profile.displayName}</div>
                             )}
                             {profile.followers !== undefined && profile.followers !== null && (
                               <div className="text-muted-foreground">Followers: <span className="text-primary">{profile.followers.toLocaleString()}</span></div>
                             )}
                             {profile.url && (
                               <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2 transition-colors">
                                 Link <ExternalLink className="w-3 h-3" />
                               </a>
                             )}
                           </div>
                        ) : (
                           <div className="text-[10px] text-muted-foreground mt-2 uppercase">Not Found</div>
                        )}
                      </div>
                    ))}
                  </div>
               </CardContent>
             </Card>
           )}

        </div>
      )}
    </div>
  );
}
