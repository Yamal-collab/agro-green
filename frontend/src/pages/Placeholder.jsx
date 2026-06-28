import React from "react";
import PageHeader from "@/components/PageHeader";

export default function Placeholder({ title, subtitle }) {
  return (
    <div data-testid={`placeholder-${title}`}>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="bg-white border border-dashed border-border rounded-lg p-12 text-center">
        <div className="text-sm text-muted-foreground mb-2">This module's UI is being built.</div>
        <div className="text-xs text-muted-foreground">All API endpoints for this business unit are live and functional. You can interact with them via API for now, and the full UI will follow in the next iteration.</div>
      </div>
    </div>
  );
}
