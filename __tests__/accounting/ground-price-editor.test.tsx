import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import GroundPriceEditor from '@/app/dashboard/accounting/GroundPriceEditor';
import { previewGroundPrices, saveGroundPrices, type GroundPrices } from '@/lib/api/ground-pricing';

jest.mock('@/lib/api/ground-pricing', () => ({ ...jest.requireActual('@/lib/api/ground-pricing'), previewGroundPrices: jest.fn(), saveGroundPrices: jest.fn() }));
jest.mock('@/components/dashboard/AnimatedControls', () => ({
  MenuSelect: ({label,value,options,onChange}: {label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}) => <select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>,
  SideSheet: ({children,footer}: {children:ReactNode;footer:ReactNode}) => <div>{children}{footer}</div>,
}));
const overview: GroundPrices = {revision:7,rule:{type:'PERCENT',value:1000},items:[{id:'v1',kind:'VARIANT',name:'Mask',sku:'M1',onlinePriceMinor:10000,groundPriceMinor:11000,costMinor:5000,marginBp:5455,mode:'SYSTEM',rule:null}]};
beforeEach(()=>jest.clearAllMocks());
it('previews before writing and saves the original revision, not the proposed revision', async()=>{
  (previewGroundPrices as jest.Mock).mockResolvedValue({...overview,revision:8});
  (saveGroundPrices as jest.Mock).mockResolvedValue({...overview,revision:8,runId:'r1'});
  const onSaved=jest.fn();
  render(<GroundPriceEditor overview={overview} selected={[]} onClose={jest.fn()} onSaved={onSaved}/>);
  fireEvent.change(screen.getByLabelText('Percentage above online'),{target:{value:'15'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}));
  await screen.findByRole('button',{name:'Save Ground prices'});
  const patch={revision:7,defaultRule:{type:'PERCENT',value:1500},items:[{id:'v1',kind:'VARIANT',mode:'SYSTEM'}]};
  expect(previewGroundPrices).toHaveBeenCalledWith(patch);
  expect(saveGroundPrices).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Save Ground prices'}));
  await waitFor(()=>expect(saveGroundPrices).toHaveBeenCalledWith(patch));
  expect(onSaved).toHaveBeenCalled();
});
it('invalidates the reviewed prices after editing and displays server conflicts', async()=>{
  (previewGroundPrices as jest.Mock).mockResolvedValue(overview);
  render(<GroundPriceEditor overview={overview} selected={['VARIANT:v1']} onClose={jest.fn()} onSaved={jest.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}));
  await screen.findByRole('button',{name:'Save Ground prices'});
  fireEvent.change(screen.getByLabelText('Percentage above online'),{target:{value:'25'}});
  expect(screen.queryByRole('button',{name:'Save Ground prices'})).not.toBeInTheDocument();
  (previewGroundPrices as jest.Mock).mockRejectedValue({status:409,message:'Prices changed. Reload and try again.'});
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Prices changed. Reload and try again.');
  expect(saveGroundPrices).not.toHaveBeenCalled();
});
it('rejects a manual Ground price at or below online price', async()=>{
  render(<GroundPriceEditor overview={overview} item={overview.items[0]} selected={[]} onClose={jest.fn()} onSaved={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('Ground pricing mode'),{target:{value:'MANUAL'}});
  fireEvent.change(screen.getByLabelText('Ground price (EGP)'),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('greater than the online price');
  expect(previewGroundPrices).not.toHaveBeenCalled();
});
it('applies fixed EGP only to selected items without changing the shared rule', async()=>{
  (previewGroundPrices as jest.Mock).mockResolvedValue(overview);
  render(<GroundPriceEditor overview={overview} selected={['VARIANT:v1']} onClose={jest.fn()} onSaved={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('Add above online'),{target:{value:'FIXED'}});
  fireEvent.change(screen.getByLabelText('EGP added to online'),{target:{value:'25.50'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}));
  await screen.findByRole('button',{name:'Save Ground prices'});
  expect(previewGroundPrices).toHaveBeenCalledWith({revision:7,items:[{id:'v1',kind:'VARIANT',mode:'SYSTEM',rule:{type:'FIXED',value:2550}}]});
});
