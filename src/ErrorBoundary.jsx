import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props)
    this.state={hasError:false}
  }

  static getDerivedStateFromError(){
    return {hasError:true}
  }

  componentDidCatch(error,info){
    console.error('KutchPharmaConnect component error',error,info)
  }

  render(){
    if(!this.state.hasError)return this.props.children
    return (
      <div className="admin-state" role="alert">
        <strong>Something went wrong while loading this section.</strong>
        <span>Please refresh the page and try again.</span>
        <button type="button" onClick={()=>window.location.reload()}>Refresh page</button>
      </div>
    )
  }
}
