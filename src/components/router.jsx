import React, {Component} from 'react';
import DynamicForm from '../services/dynamicForm.js';
import {Alert } from './utils.jsx';
import t from 'transducers.js';
const { into,  map } = t;

const DEFAULT_LANDING = 'AdminTileList';

// router.jsx - root format  
// http://host/<# admin / ListPage >?props=eyJmb3JtIjp7Il9pZCI6IjMwMzAzMDMwMzAzMDMwMzAzMDYxMzAzMCJ9fQ%3D%3D
// {"appid":"admin","component":"ListPage","props":{"form":{"_id":"303030303030303030613030"}},"urlparms":[]}
// Logic
//  <#/ if no appid, use the current app, else, use the users default app
//  if no compoenet, use the apps default comonent

let _backUrl = null;
export default class Router extends Component {

  constructor(props) {
    super(props)
    //console.log ('router.jsx - constructor')
    this.bind__chng_route_fn  = this._chng_route_fn.bind(this);
  }

  static set backUrl(val) {
    _backUrl = val;
  }
  static get backUrl() {
    return _backUrl;
  }

  // =====================================     Called from React JSX
  static URLfor(appid, comp, form, record, params) {
    let df = DynamicForm.instance,
        effectiveappid;

    if (typeof appid === "boolean")
      // if 'true', then its the current app
      effectiveappid = appid && df.app && df.app._id;
    else
      effectiveappid = appid || false;

    let props = {}, routeJson = {appid: effectiveappid};
    if (comp) routeJson.component = comp;
    if (form) props.form = {_id: form};
    if (record) props.xid =  `"${record}"`;
    if (params) props = Object.assign(props, params);
    if (Object.keys(props).length > 0) routeJson.props = props;

    // console.log ('Router.URLFor : ' + JSON.stringify(routeJson));
    return Router._encodeHash (routeJson);
  }

  // =====================================     Processes navigation routes Called from React JS 
  static navTo(appid, comp, form, record, params, backiflist) {
    if (window) {
      if (Router.backUrl && backiflist && (Router.backUrl.component === "ListPage" || Router.backUrl.component === DEFAULT_LANDING))
        window.location.href = Router._encodeHash(Router.backUrl);
      else
        window.location.href = Router.URLfor(appid, comp, form, record, params);
    }
  }

  static _encodeHash ({appid, component, props}) {
    let ulrstr = "#";
    if (appid) ulrstr+= appid ;
    ulrstr+=  "/";
    if (component)  ulrstr+= component;
    if (props && Object.keys(props).length >0) ulrstr+= "?props=" + encodeURIComponent(btoa(JSON.stringify(props)));
    return ulrstr;
  }

  static _decodeHash (hashuri) {

    let retval = {appid: null, component: null, props: {}, urlparms: []};

    // url format: #[<appid>/]<compoment>
    if (hashuri &&  hashuri !== "undefined") {
      let [main, urlparms] = hashuri.split('?');

      if (main) {
        if (main.indexOf("/") > -1) {
          // we have the format <app>/..., strip
          //console.log (`router.jsx - _decodeHash: we have a url #format <app>/<other>, get the app`)
          let [appid, component] = main.split('/');
          if (appid &&  appid !== "undefined") retval.appid = appid;
          if (component &&  component !== "undefined") retval.component = component;
        } else {
          //console.log (`router.jsx - _decodeHash: we have a url #format without '/', no app`)
          retval.hash = (main === '_=_') ? "": main // strip out the component facebook adds when redirect
        }
      }
      // params to props
      if (urlparms) {
        let objparam = into({},
            map(p => p.split("=")),
           urlparms.split("&"));
        for (let p in objparam) {
          if (p === "props") {
            retval.props = JSON.parse(atob(decodeURIComponent(objparam[p])));
          } else {
            retval.urlparms[p] = objparam[p];
          }
        }
      }

    }
    //console.log (`router.jsx - _decodeHash: ${hashuri} -> ${JSON.stringify(retval)}`);
    return (retval);
  }

  static decodeCurrentURI () {
    if (typeof window  !== 'undefined') {
      //console.log (`router.jsx - decodeCurrentURI : ${window.location.href.split('#')[1]}`)
      return Router._decodeHash(decodeURI(window.location.href.split('#')[1]));
    } else
      return {};
  }

  static ensureAppInUrl (newappid) {
    let currentroute = Router.decodeCurrentURI();
    if (currentroute.appid && (currentroute.appid !== newappid)) {
      //console.log ("router.jsx - ensureAppInUrl: !Chaning apps! Ensure the hash and params are wiped");
      delete currentroute.component;
      delete currentroute.params;
    }
    currentroute.appid = newappid;
    const newstate = Router._encodeHash(currentroute)
    //console.log (`router.jsx - ensureAppInUrl: replaceState : ${JSON.stringify(currentroute)} -> ${newstate}`)
    if (window) window.history.replaceState("", "", newstate);
  }

  // ============================================================= Processes <a hrefs> and back/forward
  // always contains the state object for the URI you've just come back to, not the one you just came from
  _chng_route_fn (event)  {
    //console.log ('router.jsx - _chng_route_fn (popstate event)')
    let df = DynamicForm.instance,
        currentLoadedApp = df.app || {},
        updateRouteFn = this.props.updateRoute,
        newrouteRequested = Router.decodeCurrentURI();

    // update browser url bar (Creates a new history entry)
    //if (window) window.history.pushState("", "Title", Router._encodeHash(newroute))
    //console.log ('router.jsx - _chng_route_fn (popstate event) : ['+ this.props.currentApp._id +']  current appid: ' + currentLoadedApp._id);

    //console.log ('Router: chng_route_fn, SAME app, updating state with newroute: ' + JSON.stringify(newroute));

    // Notify the parent 'App' we are updating the route based on this appid
    if (updateRouteFn) updateRouteFn (newrouteRequested.appid);

    if (currentLoadedApp._id === newrouteRequested.appid) {
        //console.log ('router.jsx - _chng_route_fn : Same app, just update state.newroute')

      // event.state always contains the state object for the URI you've just come back to, not the one you just came from
      // if event.state == null - you have just navigated to the website
      // Save current route before overriding for backURL
      if (event && event.state) Router.backUrl = this.state.newroute;
      this.setState({newroute: newrouteRequested});
    }
  }

 componentWillMount() {
  //console.log ("router.jsx - COMPONENTWILLMOUNT: attaching popstate" + this.props.currentApp._id);

  if (window && window.addEventListener) {
    window.addEventListener('popstate', this.bind__chng_route_fn, false);
  } else if (window) {
    window.attachEvent('popstate', this.bind__chng_route_fn);
  }
   this._chng_route_fn();
 }

 componentWillUnmount() {
    //console.log ('router.jsx - COMPONENTWILLUNMOUNT: removing popstate');
    if (window && window.addEventListener) {
      window.removeEventListener('popstate', this.bind__chng_route_fn, false);
    } else if (window) {
      window.detachEvent('popstate', this.bind__chng_route_fn);
    }
  }

  render() {
    let df = DynamicForm.instance,
        template3 = (comps) => {
      return (
      <div className="slds-grid slds-wrap">
        { comps.head && <div className="slds-col slds-size--1-of-1">{comps.head}
          </div>
        }
        { comps.main && <div className="slds-col slds-size--1-of-1 slds-medium-size--2-of-3">{comps.main}
          </div>
        }
        { comps.side && <div className="slds-col slds-size--1-of-1 slds-medium-size--1-of-3">{comps.side}
        </div>
        }
        { comps.foot && <div className="slds-col slds-size--1-of-1">{comps.foot}
        </div>
        }
      </div>
        );
    }
    //console.log ('Router: render');
    if (df.app && !this.state.newroute.component) { // app landingpage
      let comps = {};
      if (df.app.landingpage) for (let pagecomp of df.app.landingpage) {
        let cf = this.props.componentFactories[pagecomp.component._id];
        //console.log (`Router: render:  component "${pagecomp.component._id}", for position "${pagecomp.position}"`);
        if (!comps[pagecomp.position]) comps[pagecomp.position] = [];
        if (cf) {
          //console.log (`Router: render: component ${pagecomp.component._id} with props ${JSON.stringify(pagecomp.props)}`);
          comps[pagecomp.position].push (cf(Object.assign({key: pagecomp.component._id}, pagecomp.props)));
        } else
          comps[pagecomp.position].push (<Alert message={`Cannot find component ${pagecomp.component._id}`}/>);
      }
    //  console.log (`Router: rendering components : ${JSON.stringify(comps)}`);
      if (Object.keys(comps).length >0) {
        return template3(comps);
      } else
        return (<Alert message="No landing page defined for app" alert={true}/>);
    } else {
      // component direct
      let cf = this.props.componentFactories[this.state.newroute.component];
      if (cf) {
        //console.log (`Router: render: component ${this.state.newroute.component} with props ${JSON.stringify(this.state.newroute.props)}`);
        return cf(Object.assign({key: JSON.stringify(this.state.newroute.props)}, this.state.newroute.props));
      } else return (<Alert message={"Unknown Compoent " + this.state.newroute.component} alert={true}/>);
    }
  }
}
/*
Router.propTypes = {
  currentApp: React.PropTypes.shape({
    _id: React.PropTypes.string.isRequired
  })
}
*/
