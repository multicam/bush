/**
 * Bush Platform - New Share Page
 *
 * Create a new share.
 */
"use client";

import { useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { ShareBuilder } from "@/web/components/shares";
import { useAuth } from "@/web/context";
import { SpinnerIcon } from "@/web/lib/icons";

export default function NewSharePage() {
  const { isAuthenticated, isLoading: authLoading, login, currentAccount } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      login(window.location.pathname);
    }
  }, [authLoading, isAuthenticated, login]);

  if (authLoading || !isAuthenticated || !currentAccount) {
    return (
      <AppLayout>
        <div className="min-h-screen p-8">
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <SpinnerIcon className="w-8 h-8 mb-4" />
            <p>Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleSave = () => {
    window.location.href = "/shares";
  };

  const handleCancel = () => {
    window.location.href = "/shares";
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary m-0 mb-1">Create Share</h1>
          <p className="text-secondary text-sm m-0">
            Create a new share link to present assets to stakeholders
          </p>
        </div>

        <ShareBuilder accountId={currentAccount.id} onSave={handleSave} onCancel={handleCancel} />
      </div>
    </AppLayout>
  );
}
