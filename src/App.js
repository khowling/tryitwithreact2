import React, {useState, useEffect} from 'react'
import { Alert } from './components/utils.jsx'
import Router from './components/router.jsx'
import {PageHeader} from './components/headers.jsx'
import DynamicForm from './services/dynamicForm.js'


export default function App() {
  console.log ('App')
  // we recommend to split state into multiple state variables based on which values tend to change together.
  const df = DynamicForm.instance
  const [ appState, setAppState] = useState ({user: null, currentApp: null, booted: false, booterr: false,  bootmsg: "Loading...."})

  // think of useEffect Hook as componentDidMount, componentDidUpdate, and componentWillUnmount combined
  // Think of effects as an escape hatch from React’s purely functional world into the imperative world
  // passing in a empty array, tells React that your effect doesn’t depend on any values from props or state, so it never needs to re-run. This isn’t handled as a special case — it follows directly from how the inputs array always wor
  useEffect(() => {
    console.log ('_loadApp')
    _loadApp(Router.decodeCurrentURI().appid)
  }, [])

  function _loadApp(appid) {
    console.log (`App.jsx - _loadApp with appid from url: ${appid}`)
    df.loadApp(appid).then (() => {
      if (df.app) {
        //console.log (`App.jsx - _loadApp : got app from server "${this.dynamicForm.app._id}" ensureAppInUrl, so Router knows if we are changing apps`);
        Router.ensureAppInUrl (df.app._id);
      }
      setAppState({ booted: true, booterr: false, bootmsg: null, user: df.user, currentApp: df.app});
    }, (e) => {
      setAppState({ booted: false, booterr: true, bootmsg: 'Error loading app : ' + e.error});
    });
  }

  function routeUpdated (appid) {
    //console.log ('App: router noitified App route updated');
    if (appid !== appState.currentApp._id) {
      _loadApp(appid);
    }
  }

  function _logout() {
    //console.log ('App: _logout router noitified');
    df.logOut().then(succ => {
      setAppState({ booted: false, booterr: false, bootmsg: "Loading....", user: null, currentApp: null})
      window.location.href = Router.URLfor(false,"Login");
      _loadApp (null);
    });
  }


  if (appState.booted)  return (
    <div className="viewport">
      <PageHeader currentApp={appState.currentApp} user={appState.user} logoutFn={_logout.bind(this)}/>
      <section style={{"marginTop": "50px"}}>
        <Router key={appState.currentApp ? appState.currentApp._id : 'none'} currentApp={appState.currentApp} updateRoute={routeUpdated.bind(this)}/>
      </section>
    </div>
  ); else if (appState.booterr) return (
    <div>
      <Alert message={"User/App is not correctly configured, please email the system ower with this message:  " + appState.bootmsg}/>
      <div className="slds-align--absolute-center" style={{"marginTop": "50px"}}><span className="slds-badge"><a href="/">Return to Home</a></span></div>
    </div>
  ); else return (
    <div className="slds">
      <div className="slds-spinner_container">
        <div className="slds-spinner--brand slds-spinner slds-spinner--large" role="alert">
          <div className="slds-spinner__dot-a"></div>
          <div className="slds-spinner__dot-b"></div>
        </div>
      </div>
      <div className="slds-align--absolute-center"><span className="slds-badge">{appState.bootmsg}</span></div>
    </div>
  )
}
