import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-6" dir="rtl">
      <Card className="w-full max-w-md mx-auto border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
            <p className="text-sm text-muted-foreground">لم نعثر على الصفحة التي تبحث عنها.</p>
          </div>
          <Button onClick={() => navigate("/")} className="gap-2">
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
