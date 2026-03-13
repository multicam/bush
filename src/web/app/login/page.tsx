/**
 * Bush Platform - Login Page
 *
 * Login page that redirects to WorkOS AuthKit for authentication.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Spinner } from "@/web/components/ui";
import { useAuth } from "@/web/context";

function LoginContent() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = redirect;
    }
  }, [isAuthenticated, isLoading, redirect]);

  const handleLogin = () => {
    login(redirect);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
        <div className="w-full max-w-[28rem] bg-surface-1 rounded-lg shadow-lg overflow-hidden">
          <div className="p-16 text-center text-secondary">
            <Spinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
        <div className="w-full max-w-[28rem] bg-surface-1 rounded-lg shadow-lg overflow-hidden">
          <div className="p-16 text-center text-secondary">Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <div className="w-full max-w-[28rem] bg-surface-1 rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center bg-surface-2 border-b border-border-default">
          <h1 className="text-[2rem] font-bold text-accent m-0">Bush</h1>
          <p className="mt-2 text-sm text-secondary">Creative Collaboration Platform</p>
        </div>

        <div className="p-8">
          <p className="text-center text-secondary text-sm mb-6">
            Sign in to access your workspaces, projects, and collaborate with your team.
          </p>

          <Button color="bush" onClick={handleLogin} className="w-full">
            Sign in with WorkOS
          </Button>

          <p className="mt-6 text-xs text-muted text-center leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="/terms" className="text-accent no-underline hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-accent no-underline hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <div className="px-8 py-6 bg-surface-2 border-t border-border-default text-center">
          <p className="m-0 text-sm text-secondary">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-accent no-underline hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
          <div className="w-full max-w-[28rem] bg-surface-1 rounded-lg shadow-lg overflow-hidden">
            <div className="p-16 text-center text-secondary">
              <Spinner size="lg" />
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
