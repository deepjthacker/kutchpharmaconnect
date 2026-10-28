import React,{lazy,Suspense,useState} from 'react'
import {Truck} from 'lucide-react'

const DistributorSubmission = lazy(() => import('./DistributorSubmission'))

export default function DistributorSubmissionLauncher({variant='floating'}){
  const [open,setOpen]=useState(false)
  return <>
    <button className={variant==='inline'?'footer-submit-link':'distributor-submit-cta'} onClick={()=>setOpen(true)}>
      <Truck size={17}/>
      <span><strong>{variant==='inline'?'Add Distributor':'Are you a distributor?'}</strong><small>{variant==='inline'?'Share your details for review':'Add your company & distributorship details'}</small></span>
    </button>
    {open&&<Suspense fallback={null}><DistributorSubmission open={open} onClose={()=>setOpen(false)}/></Suspense>}
  </>
}
