import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth";

const Login = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { ok, error } = await login(username, password);
    setLoading(false);
    if (ok) nav("/");
    else {
      const map: Record<string, string> = {
        invalid_credentials: "Invalid username or password.",
        user_not_found: "Account not found.",
        ldap_unavailable: "Directory service is unavailable.",
        login_failed: "Login failed.",
      };
      setError(map[error || "login_failed"]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-destructive text-sm">{error}</div>}
          <Button type="submit" disabled={loading || !username || !password}>{loading ? "Signing in..." : "Sign In"}</Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
