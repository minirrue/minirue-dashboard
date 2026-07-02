import CollabLayoutClient from './CollabLayoutClient';

export const metadata = { title: 'Partner — MiniRue' };

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  return <CollabLayoutClient>{children}</CollabLayoutClient>;
}
