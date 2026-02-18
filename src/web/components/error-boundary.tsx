/**
 * Bush Platform - Error Boundary
 *
 * Catches React errors to prevent the entire app from crashing.
 * Displays a user-friendly error message with a retry button.
 */
"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{
            maxWidth: "32rem",
            padding: "2rem",
            borderRadius: "0.5rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
          }}>
            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "#dc2626",
              marginBottom: "1rem",
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: "#7f1d1d",
              marginBottom: "1.5rem",
            }}>
              An unexpected error occurred. Please try again or refresh the page.
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre style={{
                fontSize: "0.75rem",
                color: "#991b1b",
                backgroundColor: "#fee2e2",
                padding: "0.75rem",
                borderRadius: "0.25rem",
                overflow: "auto",
                marginBottom: "1rem",
                textAlign: "left",
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#fff",
                  backgroundColor: "#dc2626",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#dc2626",
                  backgroundColor: "transparent",
                  border: "1px solid #dc2626",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
