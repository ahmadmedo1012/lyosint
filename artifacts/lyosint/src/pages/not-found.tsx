import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
          <p className="text-sm text-muted-foreground">لم نعثر على الصفحة التي تبحث عنها.</p>
        </div>
        <Button onClick={() => navigate("/")} className="gap-2">
          <Home className="w-4 h-4" />
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
}
