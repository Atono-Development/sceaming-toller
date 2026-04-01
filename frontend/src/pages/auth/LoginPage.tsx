import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from || "/";

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center items-center pt-2">
            <div className="p-2 bg-white rounded-2xl">
              <img 
                src="/favicon_improved.png" 
                alt="Toller Dome Logo" 
                className="w-30 h-30 object-contain"
              />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black text-center uppercase tracking-tighter text-slate-900">
              Welcome to The Toller Dome
            </CardTitle>
            <CardDescription className="text-center text-slate-500 font-medium italic">
              Log in or sign up for toller ball
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <Button onClick={() => login(from)} className="w-full py-6 text-lg">
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
