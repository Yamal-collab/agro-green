import React from "react";

export default function PageHeader({ title, subtitle, action, testid }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 flex-wrap" data-testid={testid}>
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-2">
          AgriBiz / {title}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
