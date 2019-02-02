
import jexl from 'jexl';

// usage:   record_id_expression | get (<form name>)
jexl.addTransform('getbyformId', function(ids, formid) {
  //console.log ('jexl.Transform : ' + ids)
  return DynamicForm.instance.getbyId(formid, ids)
})

// usage:   record_id_expression | get (<form name>)
jexl.addTransform('get', function(ids, form_name) {
  //console.log ('jexl.Transform : ' + ids)
  let df = DynamicForm.instance,
      f = df.getFormByName(form_name)
  if (f) {
    return df.getbyId(f._id, ids)
  } else {
    return Promise.reject(`cannot find view ${form_name}`)
  }
});

jexl.addTransform('toApiName', function(str) {
  return (typeof str === 'string' ? str.replace(/\s+/g, '_').toLowerCase() : null)
});

jexl.addTransform('cloneSObject', function(cloneopts, sobjectdef) {
  let df = DynamicForm.instance,
      SFDCKEY = "Id",
      newform = {
        name: sobjectdef.name,
        store: "sfdc",
        externalid: SFDCKEY,
        source: "records",
        desc: `Cloned from Salesforce ${sobjectdef.name} definition`,
        url: "/services/data/v37.0", //sobjectdef.sobject_url,
        fields: sobjectdef.fields.filter(sf => sf.name !== SFDCKEY).map((sf) => { 

          let lookupform = null
          if (sf.type === "reference") {
            lookupform = df.getFormByName(sf.referenceTo)
          }
          let sfdef = {
            name: sf.name,
            title: sf.label,
            type: sf.type === "datetime"? "datetime": lookupform? "reference": "text",
            search_form: lookupform && {_id: lookupform._id},
            display: (sf.name === "name" || sf.name === "type"  || sf.name === "stage"   || sf.name === "LastName") ? "primary" : ""
          }
        
          return sfdef
      
      }
        
        )}
    console.log (`cloneSObject ${JSON.stringify(newform)}`)
    return df.save (df.getFormByName("Form Metadata")._id, newform)
});

let instance = null;
export default class DynamicForm {

  constructor (server_url = "") {
    if (instance) {
      throw new Error("DynamicForm() only allow to construct once");
    }
    this._host = server_url;
    this.ROUTES = {dform: this._host + '/api/', auth: this._host + '/auth/'};
    instance = this;
    this.clearApp();
    this._user = {};
  }

  static get instance() {
    if (!instance) throw new Error("DynamicForm() need to construct first");
    return instance;
  }

  get host() {
      return this._host
    }
  get user() {
    return this._user
  }
  get app() {
    return this._currentApp
  }
  get appMeta() {
    return this._appMeta
  }
  get readSAS() {
    return this._readSAS
  }
  get appUserData() {
    let userapprec = this.user && this.user.apps && this.user.apps.find (a => a.app._id === this.app._id);
     return (userapprec ? userapprec.appuserdata : {})
  }
  /*
  getComponentMeta(cname) {
    return this.getFormByName("Component Metadata")._data.find(cm => cm.name === cname);
  }
*/
  _callServer(path, mode = 'GET', body) {
    return new Promise( (resolve, reject) => {
      var client = new XMLHttpRequest();

      client.onreadystatechange = () => {
        if (client.readyState === XMLHttpRequest.DONE) {
          if (client.status === 200) {
            resolve(JSON.parse(client.responseText))
          } else if (client.status === 400) { 
            reject(JSON.parse(client.responseText))
          } else {
            reject({error: "Network error"});
          }
        }
      }

      client.addEventListener("error", (evt) => {
        console.log(`An error occurred while transferring the file ${evt}`);
      });

      client.open(mode, path);
      //client.setRequestHeader ("Authorization", "OAuth " + "Junk");
      //client.withCredentials = true;
      
      if (mode === 'POST'  || mode === "PUT") {
        //console.log (`_callServer: POSTING to ${path} ${JSON.stringify(body)}`);
        client.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        client.send(JSON.stringify(body));
      } else {
        client.send();
      }
    });
  }

  clearApp() {
    this._appMeta = [];
    this._currentApp = {};
  }

  getMe() {
    return this._callServer(this.ROUTES.auth + 'me');
  }

  logOut() {
    return this._callServer(this.ROUTES.auth + 'logout').then(succ => {
      this.clearApp();
      this._user = {};
    });
  }

  loadApp(appid) {
    this.clearApp();
    return this._callServer(this.ROUTES.dform + 'loadApp/' + (appid ? ("?appid=" + appid) : '')).then(val => {
      this._appMeta = val.appMeta || [];
      this._user = val.user;
      this._currentApp = val.app;
      this._readSAS = val.readSAS;
    });
  }
  getForm (fid) {
    this._appMeta.length > 0 ||   console.log( "DynamicForm.getForm : FormData Not Loaded");
    if (!fid)
      return this._appMeta;
    else
      return this._appMeta.find(f => f._id === fid);
  }
  getFormByName (fid) {
    this._appMeta.length > 0 ||   console.log( "DynamicForm.getForm : FormData Not Loaded");
    if (!fid)
      return this._appMeta;
    else
      return this._appMeta.find(f => f.name === fid);
  }

  getPrimaryFields (formid) {
    if (!formid) {
      throw "no search form specified"
    }

    const searchview = this.getForm(formid)
    if (!searchview) {
      throw `Form not found in current Application, ref: ${formid}`
    }

    const pri_fieldidx = searchview.fields.findIndex(f => f.display === 'primary' && f.type === 'text')
    const pri_fieldidx_pic = searchview.fields.findIndex(f => f.display === 'primary' && ( f.type === 'icon' || f.type === 'image'))
    if (pri_fieldidx < 0) throw `Form doesnt contain Primary field, ref: ${formid}`
    return {primary_text: searchview.fields[pri_fieldidx].name, primary_image: pri_fieldidx_pic >= 0 && searchview.fields[pri_fieldidx_pic].name}
  }
  // get 1 or many by ID
  getbyId(formid, ids, display = 'all') {
    
    const f = DynamicForm.instance.getForm (formid)

    if (f.store === 'metadata') {
      return Promise.resolve(f._data.find(m => m._id === ids))
    } else if  (f.store === "rest") {
      return this._callServer(f.url+"?_id="+ids)
    } else {
      if (!Array.isArray(ids)) ids = [ids]
      return this._callServer(`${this.ROUTES.dform}db/${formid}?d=${display}${ids ? ("&_id=" + ids.join(",")) : ''}`)
    }
  }
  
  // search by primary field (return primary fields by default)
  search(formid, str, display = 'primary') {
    if (!formid) {
      throw "no search view specified"
    }
    
    const searchview = this.getForm(formid)
    if (!searchview) {
      return Promise.reject({error: `Search form not found in current Application, ref: ${formid}`})
    }

    if (searchview.store === "metadata") {
      const {primary_text, primary_image} = this.getPrimaryFields (formid)
      return Promise.resolve (searchview._data.filter(r => str === null || r[primary_text].startsWith(str)).map(r => { return {_id: r._id, [primary_text]: r[primary_text], [primary_image]: r[primary_image]}}))

    } else return new Promise ((resolve, reject) => {
      this._callServer(`${this.ROUTES.dform}db/${formid}?d=${display}${(str ? ("&p=" + str) : '')}`).then(succVal => {
        if (searchview.name === "Form Metadata")
          resolve (succVal.concat( this.appMeta));
        else
          resolve (succVal);
      }, errVal => reject(errVal));
    });
  }
  // full query
  query(formid, q, display = 'list') {
    const f = DynamicForm.instance.getForm (formid)
    if (f.store === 'metadata') {
      return Promise.resolve(f._data)
    } else if  (f.store === "rest") {
      return this._callServer(f.url)
    } else {
      return this._callServer(`${this.ROUTES.dform}db/${formid}?d=${display}${(q ? ("&q=" + encodeURIComponent(JSON.stringify(q))) : '')}`)
    } 
  }

  save(formid, body, parent) {
    return this._callServer(this.ROUTES.dform + 'db/' + formid + (parent ? "?parent="+encodeURIComponent(JSON.stringify(parent)) : ''), 'POST', body);
  }

  delete(formid, ids, parent) {
    if (!Array.isArray(ids)) ids = [ids];
    return this._callServer(this.ROUTES.dform + 'db/' + formid + "?_id=" + ids.join(",") + (parent ? "&parent="+encodeURIComponent(JSON.stringify(parent)) : ''), 'DELETE');
  }

  // Prep to Write a new file to storage
  newFile(filename) {
    return this._callServer(this.ROUTES.dform + 'file/new', "PUT", {filename});
  }

}
