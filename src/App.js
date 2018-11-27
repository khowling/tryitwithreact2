import React, {Component} from 'react';
import { Alert }           from './components/utils.jsx';
import Router                       from './components/router.jsx';
import {AdminTileList}                   from './components/tiles.jsx';
import {ListMain, ListPage, RecordPage}       from './components/dform.jsx';
import {TimeLine}                   from './components/timeline.jsx';
import {Login, Register, AuthState}  from './components/auth.jsx';

import DynamicForm from './services/dynamicForm.js';

export default class App extends Component {

   static createFactories (...comps) {
     let factories = [],
         navMeta = [];

     for (let mods of comps) {
    //   console.log ('import mods : ' + mods);
       if (typeof mods === "function" ) {
         //if (mods.navProps) {
           //console.log ('App: creating factory : ' + mods.name);
           factories[mods.name] = React.createFactory(mods);
           navMeta.push (mods.navProps);
         //}
       }
     }
     return {factories: factories, navMeta: navMeta};
   }

  constructor (props) {
    super(props);
    this.appComponents = App.createFactories (ListMain, AdminTileList, ListPage, RecordPage, TimeLine, Register, Login, Register);
    //this.nonAppComponents = App.createFactories (Login, Register);
    if (!this.dynamicForm) this.dynamicForm = new DynamicForm();
    this.state = { booted: false, booterr: false,  bootmsg: "Loading....", user: null, currentApp: null};
  }

  componentWillMount() {
    //console.log ("App.jsx - COMPONENTWILLMOUNT, decodeCurrentURI to get appid and _loadApp")
    this._loadApp(Router.decodeCurrentURI().appid)
  }

  _loadApp(appid) {
    console.log (`App.jsx - _loadApp with appid from url: ${appid}`)
    this.dynamicForm.loadApp(appid).then (() => {
      if (this.dynamicForm.app) {
        //console.log (`App.jsx - _loadApp : got app from server "${this.dynamicForm.app._id}" ensureAppInUrl, so Router knows if we are changing apps`);
        Router.ensureAppInUrl (this.dynamicForm.app._id);
      }
      this.setState ({ booted: true, booterr: false, bootmsg: null, user: this.dynamicForm.user, currentApp: this.dynamicForm.app});
    }, (e) => {
      this.setState ({ booted: false, booterr: true, bootmsg: 'Error loading app : ' + e.error});
    });
  }



  routeUpdated (appid) {
    //console.log ('App: router noitified App route updated');
    if (appid !== this.state.currentApp._id) {
      this._loadApp(appid);
    }
  }

  _logout() {
    //console.log ('App: _logout router noitified');
    this.dynamicForm.logOut().then(succ => {
      this.setState ({ booted: false, booterr: false,  bootmsg: "Loading....", user: null, currentApp: null}, () => {
        if (window)
          window.location.href = Router.URLfor(false,"Login");
          this._loadApp (null);
      });
    });
  }

  render () {
    //console.log ("App: render");
    // 
    if (this.state.booted)  return (
      <div className="viewport">

      <header className="slds-global-header_container">
        
        <div className="slds-global-header slds-grid slds-grid--align-spread">
          <div className="slds-global-header__item">
            <div className="slds-global-header__logo">

                <div className="slds-context-bar__primary slds-context-bar__item--divider-right">
                  <div className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger--click slds-no-hover">
                    <div className="slds-context-bar__icon-action">
                      <a href={Router.URLfor(true)} className="slds-icon-waffle_container slds-context-bar__button">
                        <div className="slds-icon-waffle">
                          <div className="slds-r1"></div>
                          <div className="slds-r2"></div>
                          <div className="slds-r3"></div>
                          <div className="slds-r4"></div>
                          <div className="slds-r5"></div>
                          <div className="slds-r6"></div>
                          <div className="slds-r7"></div>
                          <div className="slds-r8"></div>
                          <div className="slds-r9"></div>
                        </div>
                        <span className="slds-assistive-text">Open App Launcher</span>
                      </a>
                    </div>
                    <span className="slds-context-bar__label-action slds-context-bar__app-name">
                      <span className="slds-truncate" title="{ props.appName || 'App Name' }">{ this.state.currentApp && this.state.currentApp.name }</span>
                    </span>
                  </div>
                </div>
            </div>
          </div>
          <div className="slds-global-header__item slds-global-header__item--search">
            <div className="slds-form-element slds-lookup slds-is-o pen">
              <label className="slds-assistive-text" >Search</label>
              <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon--left">
                <svg  className="slds-input__icon">
                  <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#search"></use>
                </svg>
                <input id="global-search-01" className="slds-input slds-lookup__search-input" type="search" placeholder="Search" />
              </div>
            </div>
          </div>
          <ul className="slds-global-header__item slds-grid slds-grid--vertical-align-center">

            <AuthState user={this.state.user} currentApp={this.state.currentApp} onLogout={this._logout.bind(this)}/>
{/*
            <li className="slds-dropdown-trigger slds-dropdown-trigger--click slds-m-left--x-small slds-is-open">
              <button className="slds-button" title="person name" >
                <span className="slds-avatar slds-avatar--circle slds-avatar--medium">
                  <img src="/assets/images/avatar2.jpg" alt="person name" />
                </span>
              </button>
            </li>
*/}
          </ul>
        </div>
      </header>

      <section style={{"marginTop": "50px"}}>
        <Router key={this.state.currentApp ? this.state.currentApp._id : 'none'} componentFactories={this.appComponents.factories} currentApp={this.state.currentApp} updateRoute={this.routeUpdated.bind(this)}/>
      </section>

    </div>
    );
    else if (this.state.booterr) return (
        <Alert message={"Looks like your user is not correctly configured, please email the system ower with this message" + this.state.bootmsg}/>
      );
    else return (
      <div className="slds">
      <div className="slds-spinner_container">
        <div className="slds-spinner--brand slds-spinner slds-spinner--large" role="alert">
          <div className="slds-spinner__dot-a"></div>
          <div className="slds-spinner__dot-b"></div>
        </div>
      </div>
      <div className="slds-align--absolute-center"><span className="slds-badge">{this.state.bootmsg}</span></div>
    </div>
    );
  }
 }
