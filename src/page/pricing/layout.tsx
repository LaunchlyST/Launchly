import React from 'react';
export function UnpaidLayout({ children }: { children: React.ReactNode }) {
  return <div className="app app--unpaid-dashboard"><main className="app__main">{children}</main></div>;
}
