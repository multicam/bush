/**
 * Bush Platform - Signup Page
 *
 * Signup page that redirects to WorkOS AuthKit for registration.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { FolderOpen, Users, Link2 } from "lucide-react";
import { Button } from "@/web/components/ui";

export default function SignupPage() {
  const handleSignup = () => {
    // WorkOS AuthKit handles signup through the same login flow
    // This page exists for marketing/SEO purposes and to provide a dedicated signup URL
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <div className="w-full max-w-[28rem] bg-surface-1 rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center bg-surface-2 border-b border-border-default">
          <h1 className="text-[2rem] font-bold text-accent m-0">Bush</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Creative Collaboration Platform
          </p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
            Get Started
          </h2>
          <p className="text-center text-text-secondary text-sm mb-6">
            Create your account and start collaborating with your team.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-sm">
              <FolderOpen size={20} className="text-accent" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text-primary">Unlimited Projects</span>
                <span className="text-xs text-text-secondary">Organize all your work</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-sm">
              <Users size={20} className="text-accent" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text-primary">Team Collaboration</span>
                <span className="text-xs text-text-secondary">Work together seamlessly</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-sm">
              <Link2 size={20} className="text-accent" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text-primary">Easy Sharing</span>
                <span className="text-xs text-text-secondary">Share with anyone instantly</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleSignup}
            className="w-full"
          >
            Create Account
          </Button>

          <p className="mt-6 text-xs text-text-muted text-center leading-relaxed">
            By creating an account, you agree to our{" "}
            <a href="/terms" className="text-accent no-underline hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="text-accent no-underline hover:underline">Privacy Policy</a>.
          </p>
        </div>

        <div className="px-8 py-6 bg-surface-2 border-t border-border-default text-center">
          <p className="m-0 text-sm text-text-secondary">
            Already have an account?{" "}
            <a href="/login" className="text-accent no-underline hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
