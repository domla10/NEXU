import { Header } from '@/components/ui';
export default function AuthLayout({ children }: { children: React.ReactNode }) { return <><Header /><main className="content auth-content">{children}</main></>; }
