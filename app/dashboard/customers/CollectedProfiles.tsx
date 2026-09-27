'use client';

import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import DashboardActionBar from '@/components/dashboard/DashboardActionBar';
import { SideSheet } from '@/components/dashboard/AnimatedControls';
import { getAssistedCustomers,getAssistedCustomer,type AssistedCustomer } from '@/lib/api/assisted-sales';
import { formatEgpMinor } from '@/components/dashboard/charts';
import './collected-profiles.css';

type ProfileDetail=Awaited<ReturnType<typeof getAssistedCustomer>>;
const errorText=(e:unknown)=>e&&typeof e==='object'&&'message'in e?String(e.message):'Could not load customer profiles. Please try again.';

export default function CollectedProfiles(){
  const detailRequest=useRef(0);
  const [query,setQuery]=useState('');const [profiles,setProfiles]=useState<AssistedCustomer[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [selected,setSelected]=useState<AssistedCustomer|null>(null);const [detail,setDetail]=useState<ProfileDetail|null>(null);const [detailError,setDetailError]=useState('');const [detailLoading,setDetailLoading]=useState(false);
  useEffect(()=>{let current=true;const timer=setTimeout(()=>{setLoading(true);setError('');getAssistedCustomers(query.trim()).then(r=>{if(current)setProfiles(r.data);}).catch(e=>{if(current)setError(errorText(e));}).finally(()=>{if(current)setLoading(false);});},220);return()=>{current=false;clearTimeout(timer);};},[query,revision]);
  async function open(profile:AssistedCustomer){const request=++detailRequest.current;setSelected(profile);setDetail(null);setDetailError('');setDetailLoading(true);try{const response=await getAssistedCustomer(profile.id);if(request===detailRequest.current)setDetail(response);}catch(e){if(request===detailRequest.current)setDetailError(errorText(e));}finally{if(request===detailRequest.current)setDetailLoading(false);}}
  return <div className="collected-profiles"><header className="dash-page-header"><div><h1 className="dash-page-title">Collected customer profiles</h1><p className="dash-page-subtitle">Ground and assisted online customers, grouped by phone number.</p></div></header><label className="collected-search">Search name or phone<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or +20 mobile number"/></label>
    {loading?<div className="dash-card" role="status">Loading profiles…</div>:error?<div className="dash-card"><p className="dash-inline-error" role="alert">{error}</p><button className="dash-btn-secondary" onClick={()=>setRevision(n=>n+1)}>Try again</button></div>:profiles.length===0?<div className="dash-card"><h2>{query?'No matching profiles':'No collected profiles yet'}</h2><p>{query?'Try their name or another phone format.':'Profiles are created when staff prepare an assisted order.'}</p></div>:<div className="dash-card collected-list">{profiles.map(profile=><article className="collected-row" key={profile.id}><div><strong>{profile.firstName} {profile.lastName}</strong><span dir="ltr">{profile.phone}</span><small>{profile.email||'No email supplied'}</small></div><span className="collected-status" data-linked={profile.registrationStatus==='LINKED'}>{profile.registrationStatus==='LINKED'?'Linked account':'Not signed up'}</span><span className="collected-count">{profile.orderCount??0} orders</span><button className="dash-btn-secondary" onClick={()=>void open(profile)}>View history</button></article>)}</div>}
    <DashboardActionBar title="Customer profiles" description="Phone-only account claims await verified signup"><Link href="/orders/new" className="dash-btn-primary"><Plus size={18}/>New manual order</Link></DashboardActionBar>
    <SideSheet open={!!selected} onClose={()=>setSelected(null)} title={selected?`${selected.firstName} ${selected.lastName||''}`.trim():'Customer'} description={selected?.phone||'Customer purchase history'} footer={<button className="dash-btn-secondary" onClick={()=>setSelected(null)}>Close</button>}>
      <span className="collected-status" data-linked={selected?.registrationStatus==='LINKED'}>{selected?.registrationStatus==='LINKED'?'Linked account':'Not signed up'}</span><p className="collected-explainer">A collected profile stores purchases under one phone number. Account access requires verification.</p>{detailLoading?<p role="status">Loading purchase history…</p>:detailError?<p className="dash-inline-error" role="alert">{detailError}</p>:detail?.orders.length?detail.orders.map(order=><div className="collected-order" key={order.id}><div><Link href={`/orders/${order.id}`}>{order.orderNumber}</Link><small>{order.salesMode==='GROUND'?'Ground':'Assisted online'} · {order.status} · {new Date(order.createdAt).toLocaleDateString('en-GB')}</small></div><strong>{formatEgpMinor(order.totalMinor)}</strong></div>):<p>No completed orders for this profile yet.</p>}
    </SideSheet>
  </div>;
}
