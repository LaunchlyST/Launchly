import React from 'react';
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="app app--auth"><main className="app__main">{children}</main></div>;
}
