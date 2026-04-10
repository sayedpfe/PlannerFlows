import * as React from "react";

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  IErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ModernTable] Render error:", error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: {
          padding: "20px",
          color: "#dc2626",
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "13px",
        },
      },
        React.createElement("div", { style: { fontWeight: 600, marginBottom: "8px" } },
          "Modern Table - Rendering Error"
        ),
        React.createElement("div", null,
          this.state.error?.message || "An unexpected error occurred while rendering the table."
        ),
        React.createElement("div", { style: { marginTop: "8px", color: "#92400e", fontSize: "12px" } },
          "Try removing the People Column Name value or check that it matches your data source."
        )
      );
    }

    return this.props.children;
  }
}
