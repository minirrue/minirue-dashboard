import CustomerNeedsClient from './CustomerNeedsClient';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
export const metadata = { title: 'Customer needs — MiniRue Admin' };
export default function Page() { return <><CatalogSubnav/><CustomerNeedsClient/></>; }
