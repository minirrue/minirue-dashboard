'use client';

import { useState } from 'react';
import CustomersClient from './CustomersClient';
import CollectedProfiles from './CollectedProfiles';

export default function CustomersWorkspace(){
  const [tab,setTab]=useState<'accounts'|'profiles'>('accounts');
  return <><div className="dash-tabstrip" role="tablist" aria-label="Customer records">{[{id:'accounts' as const,label:'Registered accounts'},{id:'profiles' as const,label:'Collected profiles'}].map(item=><button key={item.id} id={`customer-tab-${item.id}`} role="tab" type="button" aria-selected={tab===item.id} aria-controls={`customer-panel-${item.id}`} tabIndex={tab===item.id?0:-1} className={tab===item.id?'dash-btn-primary':'dash-btn-secondary'} onClick={()=>setTab(item.id)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=tab==='accounts'?'profiles':'accounts';setTab(next);document.getElementById(`customer-tab-${next}`)?.focus();}}}>{item.label}</button>)}</div><div role="tabpanel" id={`customer-panel-${tab}`} aria-labelledby={`customer-tab-${tab}`}>{tab==='accounts'?<CustomersClient/>:<CollectedProfiles/>}</div></>;
}
