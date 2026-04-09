import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AuthDialogProps {
  children: React.ReactNode;
  defaultMode?: "login" | "signup";
  onClose?: () => void;
}

export function AuthDialog({ children, defaultMode = "login", onClose }: AuthDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const { toast } = useToast();

  const handleSuccess = (user: { id: string; username: string }) => {
    toast({
      title: mode === "login" ? "Welcome back!" : "Account created!",
      description: `${mode === "login" ? "Successfully signed in" : "Successfully created account"} as ${user.username}`,
    });
    setIsOpen(false);
    onClose?.();
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setMode(defaultMode); // Reset to default mode when closing
      onClose?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild data-testid="trigger-auth-dialog">
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-none shadow-none">
        <DialogTitle className="sr-only">
          {mode === "login" ? "Sign In" : "Create Account"}
        </DialogTitle>
        {mode === "login" ? (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToSignup={() => setMode("signup")}
          />
        ) : (
          <SignupForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setMode("login")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}