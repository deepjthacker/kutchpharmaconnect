import React,{lazy,Suspense,useState} from 'react'
import {Truck} from 'lucide-react'

const DistributorSubmission = lazy(() => import('./DistributorSubmission'))

export default function DistributorSubmissionLauncher(){
  const [open,setOpen]=useState(false)
  return <>
    <button className="distributor-submit-cta" onClick={()=>setOpen(true)}>
      <Truck size={17}/>
      <span><strong>Are you a distributor?</strong><small>Add your company & distributorship details</small></span>
    </button>
    {open&&<Suspense fallback={null}><DistributorSubmission open={open} onClose={()=>setOpen(false)}/></Suspense>}
  </>
}
