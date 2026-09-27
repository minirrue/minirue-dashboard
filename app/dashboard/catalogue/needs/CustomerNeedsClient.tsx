'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Archive } from 'lucide-react';
import DashboardActionBar from '@/components/dashboard/DashboardActionBar';
import { SideSheet } from '@/components/dashboard/AnimatedControls';
import RetryingImage from '@/components/dashboard/RetryingImage';
import { getCustomerNeeds, saveCustomerNeed, archiveCustomerNeed, type CustomerNeed } from '@/lib/api/assisted-sales';
import { listProducts } from '@/lib/catalog/api';
import type { ProductListItem } from '@/lib/catalog/types';
import './customer-needs.css';

const messageOf = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not save the category. Please try again.';

export default function CustomerNeedsClient() {
  const [needs,setNeeds] = useState<CustomerNeed[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [editing,setEditing] = useState<CustomerNeed | 'new' | null>(null);
  const [name,setName] = useState('');
  const [description,setDescription] = useState('');
  const [active,setActive] = useState(true);
  const [productIds,setProductIds] = useState<string[]>([]);
  const [products,setProducts] = useState<ProductListItem[]>([]);
  const [query,setQuery] = useState('');
  const [productsLoading,setProductsLoading] = useState(false);
  const [productError,setProductError] = useState('');
  const [busy,setBusy] = useState(false);
  const [saveError,setSaveError] = useState('');

  const reload = async () => { setLoading(true); setError(''); try { const res=await getCustomerNeeds();setNeeds(res.data); } catch(e){setError(messageOf(e));} finally{setLoading(false);} };
  useEffect(() => { let active=true;getCustomerNeeds().then(r=>{if(active)setNeeds(r.data);}).catch(e=>{if(active)setError(messageOf(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;}; }, []);
  useEffect(() => {
    if(!editing)return;
    let active=true;
    const timer=setTimeout(()=>{setProductsLoading(true);setProductError('');listProducts({search:query.trim(),limit:50}).then(r=>{if(active)setProducts(r.items);}).catch(e=>{if(active)setProductError(messageOf(e));}).finally(()=>{if(active)setProductsLoading(false);});},200);
    return()=>{active=false;clearTimeout(timer);};
  },[editing,query]);
  const open = (need: CustomerNeed | 'new') => {setEditing(need);setName(need==='new'?'':need.name);setDescription(need==='new'?'':need.description||'');setActive(need==='new'?true:need.isActive);setProductIds(need==='new'?[]:need.productIds);setQuery('');setSaveError('');};
  const save = async () => {
    if(!name.trim()){setSaveError('Enter a category name.');return;}
    if(!productIds.length){setSaveError('Choose at least one recommended product.');return;}
    setBusy(true);setSaveError('');
    try{await saveCustomerNeed({name:name.trim(),description:description.trim(),productIds,isActive:active},editing && editing!=='new'?editing.id:undefined);setEditing(null);await reload();}catch(e){setSaveError(messageOf(e));}finally{setBusy(false);}
  };
  const archive = async () => {if(!editing||editing==='new')return;setBusy(true);setSaveError('');try{await archiveCustomerNeed(editing.id);setEditing(null);await reload();}catch(e){setSaveError(messageOf(e));}finally{setBusy(false);}};
  return <div className="needs-page"><header className="dash-page-header"><div><h1 className="dash-page-title">Customer needs</h1><p className="dash-page-subtitle">Organize recommended products for staff-assisted orders.</p></div><Link href="/orders/new" className="dash-btn-secondary">Create an order</Link></header>
    {loading?<div className="dash-card" role="status">Loading categories…</div>:error?<div className="dash-card"><p className="dash-inline-error" role="alert">{error}</p><button className="dash-btn-secondary" onClick={()=>void reload()}>Try again</button></div>:needs.length===0?<div className="dash-card needs-empty"><h2>No customer-need categories yet</h2><p>Create a category and choose the products staff should suggest.</p></div>:<div className="dash-card needs-list">{needs.map(need=><article className="needs-row" key={need.id}><div><h2>{need.name}</h2>{need.description&&<p>{need.description}</p>}<span>{need.productIds.length} recommended products · {need.isActive?'Active':'Archived'}</span></div><button className="dash-btn-secondary" onClick={()=>open(need)} aria-label={`Edit ${need.name}`}><Pencil size={16}/>Edit</button></article>)}</div>}
    <DashboardActionBar title="Customer needs" description="Admin-managed recommendations"><button className="dash-btn-primary" onClick={()=>open('new')}><Plus size={18}/>New category</button></DashboardActionBar>
    <SideSheet open={!!editing} onClose={()=>setEditing(null)} title={editing==='new'?'New customer need':'Edit customer need'} description="Choose clear customer language and the products staff can recommend." busy={busy} footer={<>{editing&&editing!=='new'&&<button className="dash-btn-secondary" disabled={busy} onClick={()=>void archive()}><Archive size={16}/>Archive</button>}<button className="dash-btn-secondary" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button><button className="dash-btn-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save category'}</button></>}>
      <div className="needs-fields"><label>Category name<input value={name} maxLength={100} onChange={e=>setName(e.target.value)} placeholder="For example, dry hair"/></label><label>Description<textarea rows={3} value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)}/></label><h3>Recommended products <span>({productIds.length} selected)</span></h3><label className="needs-search"><Search size={18}/><input aria-label="Search products" placeholder="Search product or SKU" value={query} onChange={e=>setQuery(e.target.value)}/></label>{productsLoading&&<p role="status">Loading products…</p>}{productError&&<p className="dash-inline-error" role="alert">{productError}</p>}<div className="needs-products">{products.map(product=><label className="needs-product" key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={e=>setProductIds(ids=>e.target.checked?[...ids,product.id]:ids.filter(id=>id!==product.id))}/>{product.coverUrl&&<RetryingImage src={product.coverUrl} alt="" className="needs-thumb"/>}<span><strong>{product.name}</strong><small>{product.sku}</small></span></label>)}</div><p className="needs-hint">Search shows up to 50 matching products. Existing selections remain selected when you search.</p>{saveError&&<p className="dash-inline-error" role="alert">{saveError}</p>}</div>
      <label className="needs-available"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Available to staff</label>
    </SideSheet>
  </div>;
}
