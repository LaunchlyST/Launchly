import React from 'react';

export function FrontPageLayout({ children }: { children: React.ReactNode }) {
  return <div className="app app--inside"><main className="app__main">{children}</main></div>;
}
