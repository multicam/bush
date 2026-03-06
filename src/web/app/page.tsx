/**
 * Bush Platform - Home Page
 *
 * Landing page that redirects authenticated users to dashboard,
 * shows marketing content to unauthenticated users.
 */
"use client";

import { useEffect } from "react";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import {
  VideoCameraIcon,
  FolderOpenIcon,
  ShareIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChatBubbleLeftIcon,
  SpinnerIcon,
} from "@/web/lib/icons";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-secondary">
          <SpinnerIcon className="w-6 h-6" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-secondary">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-sticky bg-surface-1 border-b border-border-default">
        <div className="w-full max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-accent">Bush</div>
          <nav className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-secondary no-underline transition-colors hover:text-primary"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-secondary no-underline transition-colors hover:text-primary"
            >
              Pricing
            </a>
            <a
              href="/login"
              className="text-sm font-medium text-secondary no-underline transition-colors hover:text-primary"
            >
              Sign In
            </a>
            <Button color="bush" onClick={() => (window.location.href = "/signup")}>
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 text-center bg-gradient-to-b from-surface-2 to-surface-1">
          <div className="w-full max-w-5xl mx-auto px-6">
            <h1 className="text-5xl font-bold text-primary leading-tight m-0 mb-6">
              Creative Collaboration,
              <br />
              Simplified
            </h1>
            <p className="text-lg text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
              Bush is the cloud-based platform for video, design, and marketing teams to collaborate
              on media assets in real-time.
            </p>
            <div className="flex gap-4 justify-center">
              <Button color="bush" onClick={() => (window.location.href = "/signup")}>
                Start Free Trial
              </Button>
              <Button outline onClick={() => (window.location.href = "/login")}>
                Sign In
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 bg-surface-1">
          <div className="w-full max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-primary text-center m-0 mb-12">
              Everything you need to collaborate
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <VideoCameraIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">Video Review</h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Frame-accurate commenting and annotation tools for video review workflows.
                </p>
              </div>
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <FolderOpenIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">Asset Management</h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Organize files with workspaces, projects, folders, and custom metadata.
                </p>
              </div>
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <ShareIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">Easy Sharing</h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Create beautiful share links with custom branding and permissions.
                </p>
              </div>
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <BoltIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">Fast Uploads</h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Chunked uploads with resume support for files up to 5TB.
                </p>
              </div>
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <ShieldCheckIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">Secure & Private</h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Enterprise-grade security with SSO, 2FA, and audit logging.
                </p>
              </div>
              <div className="p-6 bg-surface-2 border border-border-default rounded-md text-center">
                <ChatBubbleLeftIcon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <h3 className="text-base font-semibold text-primary m-0 mb-2">
                  Real-time Comments
                </h3>
                <p className="text-sm text-secondary m-0 leading-relaxed">
                  Collaborate in real-time with threaded comments and @mentions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-surface-2 border-t border-border-default">
        <div className="w-full max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-secondary m-0">© 2024 Bush. All rights reserved.</p>
          <div className="flex gap-6">
            <a
              href="/privacy"
              className="text-sm text-secondary no-underline transition-colors hover:text-primary"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-sm text-secondary no-underline transition-colors hover:text-primary"
            >
              Terms
            </a>
            <a
              href="/contact"
              className="text-sm text-secondary no-underline transition-colors hover:text-primary"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
