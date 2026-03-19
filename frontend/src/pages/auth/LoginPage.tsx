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

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to Screaming Toller
          </CardTitle>
          <CardDescription className="text-center">
            Log in or sign up to manage your teams
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <Button onClick={login} className="w-full py-6 text-lg">
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
