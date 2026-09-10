import React from 'react';
export function FullAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="app">{children}</div>;
}
