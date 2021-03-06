
import React, {Component, useState, useEffect} from 'react'
import jexl from 'jexl'
import {navTo, Link} from './router.jsx'
import {Field} from './dform_fields.jsx'
import {Button, SectionHeader, FormHeader} from './headers.jsx'
import {Modal, SvgIcon, Alert, UpdatedBy } from './utils.jsx'
import DynamicForm from '../services/dynamicForm.js'
import {typecheckFn} from '../shared/dform.js'

  // form control - visibility and validity
  // TODO : Needs to be MUCH better, not calling eval many times!
 async function _formControlState(edit, form, val, parentrec, currentState)  {

    //console.log ("FormMain _formControlState currentState : " + JSON.stringify(currentState));
    let df = DynamicForm.instance,
        returnControl = {flds:{}, new_deflts: {}, invalid: false, change: currentState ? false : true};

    for (let fld of form.fields.filter(f => f.type !== 'childform' && f.type !== 'relatedlist')) {

      let fctrl = { invalid: false, visible: true, dynamic_fields: null};

      // --------------------  CALCULATE THE field "show_when" (expression)
      if (fld.show_when) {
        let context = {rec: Object.assign({}, val, {"_parent": parentrec}), appMeta: DynamicForm.instance.appMeta}
        //console.log ("FormMain _formControlState show_when start") 
        fctrl.visible = await jexl.eval(fld.show_when, context)
        //console.log ("FormMain _formControlState show_when end") 
      }

      //  --------------------  CALCULATE THE field "default_value" (expression)
      // If the field is visible, and there is a default_value expression, AND if there is no current value in the field, or current value has been set by previous default
      //console.log (`_formControlState new_default_value ${fld.name} ${fld.default_value} ${val[fld.name]} `);
      if (edit && fctrl.visible && fld.default_value && ((!val[fld.name]) || (currentState && currentState.new_deflts[fld.name] === val[fld.name]))) {
        let newdefault = await jexl.eval(fld.default_value, {rec: Object.assign({}, val, {"_parent": parentrec})});
        //console.log (`_formControlState new_default_value ${fld.name} val: ${val[fld.name]}   newdefault: ${newdefault}`);
        if (val[fld.name] !== newdefault && returnControl.new_deflts[fld.name] !== newdefault) {
          returnControl.new_deflts[fld.name] = newdefault;
          returnControl.change = true;
        }
      }

      // --------------------  CALCULATE If the field has a VALID TYPE
      if (edit) {
        //console.log (`field ${fld.name}, typecheckFn ${val[fld.name]} || ${returnControl.new_deflts[fld.name]}`);
        fctrl.invalid = typecheckFn (form, fld.name, val[fld.name] || returnControl.new_deflts[fld.name], (fid) => df.getForm(fid)).error
      }
      
      // --------------------  IF THE FIELD IS TYPE DYNAMIC, EVALUATE "fieldmeta_el"
      if (fld.type === 'dynamic' && val && Object.keys(val).length>0) {
        //console.log (`eval dynamic_fields ${fld.fieldmeta_el}`);
        try {
          fctrl.dynamic_fields = await jexl.eval(fld.fieldmeta_el, {rec: Object.assign({}, val, {"_parent": parentrec}), appMeta: DynamicForm.instance.appMeta}) || [];
          //console.log (`eval dynamic_fields ${fld.fieldmeta_el}, res: ${fctrl.dynamic_fields}`);
        } catch (err) {
          console.error (`ERROR dynamic_fields evaluation: "${fld.fieldmeta_el}", err: ${err}`);
        }
      }

      //console.log (`fctrl ${fld.name}, show_when ${JSON.stringify(fctrl)}`);
      // check to see if form control state has changed from last time, if so, it will re-render the whole form!
      if (currentState && currentState.flds[fld.name]) {
        if (!Object.is(currentState.flds[fld.name].invalid, fctrl.invalid) ||
            !Object.is(currentState.flds[fld.name].visible, fctrl.visible) ||
            !Object.is(currentState.flds[fld.name].dynamic_fields, fctrl.dynamic_fields))
              returnControl.change = true;
      } else if (fctrl.invalid || !fctrl.visible) {
        // no current state, so much be change
        returnControl.change = true;
      }

      if (fctrl.invalid) returnControl.invalid = true;
      returnControl.flds[fld.name] = fctrl;
    }
    //console.log ("FormMain _formControlState result");
    return returnControl;
  }


/*****************************************************************************
  * Called from Form Route (top), or within List (embedded)
  * Pass in the 'form' and the 'value' record (the value needs to be pre-fetched)
  * Functions: Render form fields, validate, save record, delete record
  *  
  * props:
  *    value: {
  *     record : <record to edit>, 
  *     status: "wait" | "ready"
  *    }
  *  crud: 
  *    c - create new (pass in any defaults via props.value.record)
  *    u - update
  *  parent: (this is a childform)
  *    form_id: 
  *    record_id: 
  *    field_id
  *  parentrec: (the full partent record, used for expression evaluation)
  *  onComplete: used by lookup and childform (if no onComplete, assume top)
  *  onFinished: 
  *  inModal: 
  ***************************************************************************/
export class FormMain extends Component {
  constructor(props) {
    super(props);
    this.state =  {
      edit: props.crud === "c" || props.crud === "u",
      manageData: false,
      changedata:  (props.crud === "c" && props.value) ? props.value.record : {}, // keep all data changes in the state
      errors: null};
    //console.log (`FormMain constructor [props.value.state : ${props.value && props.value.state || 'no props.value'}]`);
  }

  shouldComponentUpdate(nextProps, nextState) {
    //console.log (`FormMain shouldComponentUpdate [nextProps.value.state : ${nextState.formcontrol && nextState.formcontrol.change}]`);
    let shouldUpdate = false;
    if (nextProps.value !== this.props.value ||
        (nextState.formcontrol && nextState.formcontrol.change) ||
        nextState) {
        shouldUpdate =  true;
    }
    //console.log (`FormMain [nextProps.value.state : ${nextProps && nextProps.value && nextProps.value.status || 'no props.value'}]`);
    return shouldUpdate;
  }

  componentWillMount() {
    //console.log ("dform - componentWillMount");
    // If its creating a new record, or the value record is ready
    if (this.props.crud === "c" || (this.props.value && this.props.value.status === "ready")) {
      _formControlState (this.state.edit, this.props.form, this.props.value? this.props.value.record : {}, this.props.parentrec).then(succval => {
        this.setState ({
          changedata: succval.new_deflts,
          formcontrol: succval
        });
      });
    }
  }
  // form data is ready from parent
  componentWillReceiveProps (nextProps) {
    //console.log (`FormMain componentWillReceiveProps [nextProps.value.status : ${(nextProps && nextProps.value)? nextProps.value.status : 'no props.value'}]`);
    if (nextProps.value && nextProps.value.status === "ready") {
      _formControlState (this.state.edit, this.props.form, nextProps.value.record, this.props.parentrec).then(succval => {
        this.setState ({
          changedata: succval.new_deflts, // wipe out any changes???
          formcontrol: succval,
          manageData: false, // ensure the inline modal closes when parent updates from save
        });
      });
    }
  }

  // Called form the Field
  _fieldChange(dynamicFieldName, d) {
    let self = this
    if (dynamicFieldName) {
      //d = {[dynamicFieldName]: Object.assign({}, this.props.value.record[dynamicFieldName], d)};
      d = {[dynamicFieldName]: Object.assign(this.state.changedata[dynamicFieldName] || {}, d)};
    }
    //console.log (`dform.jsx -FormMain: _fieldChange merging existing change: [${JSON.stringify(this.state.changedata)}], with new change [${JSON.stringify(d)}]`);
    let changedata = Object.assign({}, this.state.changedata, d);
    //console.log (`--------- FormMain _fieldChange full changedata ${JSON.stringify(changedata)}`);
    _formControlState (this.state.edit, this.props.form, Object.assign({}, this.props.value ? this.props.value.record : {}, changedata), this.props.parentrec, this.state.formcontrol).then(succval => {
      //console.log (`dform.jsx -FormMain: _fieldChange setting new changedata ${JSON.stringify(this.state.changedata)} - to - ${JSON.stringify(Object.assign(changedata, succval.new_deflts))}`)
      self.setState({
        changedata: Object.assign(changedata, succval.new_deflts), // add any changes in a fields default_values (expressions) into the changedata
        formcontrol: Object.assign(succval, {"change": true})   // force a re-render
      });
    }, err => {
      console.error (err)
    })
  }

  _save() {
    return new Promise((resolve, reject) => {
      let self = this,
          df = DynamicForm.instance,
          body =  (this.props.value && this.props.value.record._id)? Object.assign({_id: this.props.value.record._id}, this.state.changedata) : this.state.changedata;

      df.save (this.props.form._id, body, this.props.parent).then(saveval => {
        //console.log (`FormMain _save, response from server: ${JSON.stringify(saveval)}`);
        /*
        if (this.props.form.name === 'AMS Asset Files' && body.file) {
          
          //console.log(`FormMain _save [${this.props.form.name}] _fileuploadhtml5: ${body.file.name}`);
          uploadFile(body.file, progressEvt => {
            //console.log ('progress ' + progressEvt.loaded);
            
          }, `${saveval._saslocator.container_url}/${saveval.Name}?${saveval._saslocator.sas}`).then (filesaveval => {
            //console.log (`FormMain _save [${this.props.form.name}] _fileuploadhtml5: success: ${JSON.stringify(filesaveval)}`)
            // update body with size
            df.save (this.props.form._id, {_id: saveval._id, ContentFileSize: '' + body.file.size}, this.props.parent).then(updateval => {
              //console.log ('FormMain _save, response from server : ' + JSON.stringify(updateval));
               resolve(updateval)
            })
          })
        } else {
        */
          resolve(saveval);
        /*}*/
        //return succfn (succval);
      }, errval => {
          self.setState({formcontrol: Object.assign (this.state.formcontrol, {serverError: JSON.stringify(errval), change: true })});
          reject (errval);
      });
    });
  }

  _delete() {
    return new Promise((resolve, reject) => {
      if (window.confirm("Sure?")) {
        var df = DynamicForm.instance;
        df.delete (this.props.form._id, this.props.value.record._id, this.props.parent).then(succval => {
          resolve(succval);
        }, err => {
          this.setState({formcontrol: Object.assign (this.state.formcontrol, {serverError: JSON.stringify(err), change: true })})
        });
      }
    });
  }

  /************************/
  /*  manage inline data  */
  /************************/
  _manageData() {
    this.setState({manageData: true,  inlineData:  this.props.value.record._data || []});
  }

  _inlineDataChange(val) {
    //console.log ("FormMain: _inlineDataChange : got update from List : " + JSON.stringify(val));
    if ('data' in val) {
      this._saveInlineData = val.data;
    }
    if ('disableSave' in val) {
      this.setState({inlineDataDisbleSave: val.disableSave});
    }
  }
  _inlineDataFinished(save) {
    let updateState = {changedata: {}, manageData: false,  inlineData: null, serverError: null};
    if (save) {
      const df = DynamicForm.instance;
      df.save (this.props.form._id, Object.assign({_id: this.props.value.record._id}, {"_data": this._saveInlineData})).then(succval => {
        //console.log ('FormMain _save, response from server : ' + JSON.stringify(succval));
        if (this.props.onDataChange) {
          // this will re-load the data at the parent, and in turn send new props
          this.props.onDataChange();
        }
      }, errval => {
        this.setState({serverError: JSON.stringify(errval)});
      });
    } else {
      this.setState(updateState);
    }
  }

  render() {
    console.log (`FormMain - render ${this.props.value && this.props.value.ready}`)
    let self = this,
        edit = this.state.edit,
        {record} = this.props.value || {status: "ready", record: {}},
        formcontrol = this.state.formcontrol,
        buttons =[
          {
            show: edit && this.props.form.store !== 'input' && "F", title: "Save",
            action: {cb: this._save.bind(this)},
            then: this.props.onComplete ? (succval) => this.props.onComplete({_id: succval._id}) : (succval) => navTo("RecordPage", this.props.form._id, succval._id, null, true)
          }, {
            show: edit && this.props.form.store === 'input' && "F", title: "Continue",
            action: {cb: () => Promise.resolve(this.state.changedata)},
            then: this.props.onComplete
          }, {
            show: edit ? "F" : this.props.onComplete && "H", title: "Cancel",
            action: this.props.onComplete ?  {cb: this.props.onComplete} : {nav: { component: record._id ? "RecordPage" : "ListPage", formid: this.props.form._id, recordid: record._id ? record._id : null, goback: true}}
          }, {
            show: !edit && "H", title: "Delete",
            action: {cb: this._delete.bind(this)},
            then: self.props.onFinished ? (succval) => self.props.onFinished('delete', succval) : (succval) => navTo("ListPage", this.props.form._id)
          }, {
            show: !edit && "H" , title: "Edit",
            action: this.props.onComplete ? {cb: () => this.setState ({edit: true})} : {nav: {component: "RecordPage", formid: this.props.form._id, recordid: record._id, props: {e: true}}}
          }, {
            show: (!edit && this.props.form._id === "303030303030303030313030" && record.store === "metadata") && "H" , title: `Manage Data (${record._data ? record._data.length : '0'})`,
            action: {cb: self._manageData.bind(self)}
          }]
          
      if (this.props.form.fields && !edit) {

        const cust_buttons  = this.props.form.fields.filter(m => m.type === 'button').map(m => Object.assign({}, m, {show: "H", action: {cb: ((v) => {
            if (m.child_form) {
              console.log ('Customer button - if child form, get data')
              const cform = DynamicForm.instance.getForm(m.child_form._id);
              if (cform) {
                this.setState({"openmodelform": {value: {status: "ready", record: {}},form: cform,field_id: m._id, onComplete: (c) => {
                  console.log (`got info from child form ${JSON.stringify(c)}`)
                  if (c === null || typeof c === 'undefined') {
                    // just cancel
                    this.setState({"openmodelform": false})
                  } else {
                    jexl.eval('buttonform|cloneSObject(rec)', {buttonform: c, rec: record}).then(() => this.setState({"openmodelform": false}))
                  }
                }}})
              } else {
                this.setState({"openmodelform": { error: "Cannot find button child form in current app"}})
              }
            }
            console.log (v)
          })}}))
          buttons = buttons.concat (cust_buttons)
      }


    Object.assign(record, this.state.changedata);
    //console.log (`FormMain render ${this.props.form.name}, ${state}`)
    return (
      <div className={this.props.inModal && "slds-modal__container w95"} >

        <div style={{padding: "0.5em", background: "white"}}>
          <SectionHeader title={this.props.form.name} buttons={buttons.filter(b => b.show === "H")} />
        </div>

        <div className={(this.props.inModal? "slds-modal__content" : "") + " slds-form--stacked"} style={{padding: "0.5em", minHeight: this.props.inModal? "400px" : "auto"}}>
          <div className="slds-grid slds-wrap">

            { formcontrol && this.props.form.fields.filter(({type}) => type !== 'childform' && type !== 'relatedlist'  && type !== 'button').map(function(field, i) {
              if (field.type !== 'dynamic') {
                let fc = formcontrol.flds[field.name]? formcontrol.flds[field.name] : {visible: true, invalid: false};
                if (fc.visible && fc.visible.error)
                  return (<Alert message={`dynamic field expression error ${fc.visible.error}`}/>)
                else if (fc.visible) 
                  return (<FieldWithLabel key={i} field={field} value={record[field.name]} edit={edit} fc={fc} onChange={self._fieldChange.bind(self, null)}/>)
              } else  {
                let dflds = formcontrol.flds[field.name].dynamic_fields;
                //console.log (`dynamic field ${field.name}, dflds : ${JSON.stringify(dflds)}`);
                if (dflds) {
                  if (dflds.error)
                    return (
                      <Alert message={`dynamic field expression error ${dflds.error}`}/>
                      );
                  else if (dflds)
                    return dflds.map(function(dfield, i) {
                      let fc = {visible: true, invalid: false};
                      return  (<FieldWithLabel key={i} field={dfield} value={record[field.name] && record[field.name][dfield.name]} edit={edit} fc={fc} onChange={self._fieldChange.bind(self, field.name)}/>);
                    })
                }
              }
              return (null)
            })}

            {(record._updatedBy && !edit) &&
              <div  className="slds-col slds-col--padded slds-size--2-of-2 slds-medium-size--2-of-2 slds-x-small-size--1-of-1">
                <div className="slds-form-element field-seperator ">
                  <label className="slds-form-element__label form-element__label--small">Last Updated</label>
                  <div className="slds-form-element__control"  style={{marginLeft: "15px"}}>
                    <UpdatedBy user={record._updatedBy} date={record._updateDate}/>
                  </div>
                </div>
              </div>
            }

            { this.state.formcontrol && this.state.formcontrol.serverError &&
              <div className="slds-col slds-col--padded slds-size--1-of-1"  style={{marginTop: "15px"}}>
                <Alert type="error" message={this.state.formcontrol.serverError}/>
              </div>
            }

            { this.state.manageData &&
              <Modal>
                <div className="slds-modal__container w95">
                  <div style={{padding: "0.5em", background: "white"}}>
                    <SectionHeader title={this.props.value.record.name} buttons={[{title: "Cancel", action: {cb: this._inlineDataFinished.bind(this, null) }}, {title: "Save", disable: this.state.inlineDataDisbleSave, action: {cb: this._inlineDataFinished.bind(this, true)}}]} />
                  </div>
                  <div className="slds-modal__content" style={{padding: "0.5em", minHeight: "400px"}}>
                    <ListMain inline={true} form={this.props.value.record} value={{status: "ready", records: this.state.inlineData}}  onDataChange={this._inlineDataChange.bind(this)}/>
                    { this.state.serverError  &&
                      <div className="slds-col slds-col--padded slds-size--1-of-1"  style={{marginTop: "15px"}}>
                        <Alert type="error" message={this.state.serverError}/>
                      </div>
                    }
                  </div>
                  <div className="slds-modal__footer"></div>
                </div>
              </Modal>
            }

          </div>
        </div>

        <div className={this.props.inModal ? "slds-modal__footer" : "slds-col slds-col--padded slds-size--1-of-1"} style={{padding: "0.5em", textAlign: "right"}}>
          { buttons.filter(b => b.show === "F").map(function(button, i) { return (  
            <Button key={i} definition={button}/> 
             )
            })
          }
        </div>

        { this.state.openmodelform && (
           this.state.openmodelform.error ? 
            <Alert type="error" message={this.state.openmodelform.error}/>
           :
             <Modal>
                <FormMain  value={this.state.openmodelform.value} form={this.state.openmodelform.form} parent={{form_id: this.props.form._id, record_id: record._id, field_id: this.state.openmodelform.field_id }} parentrec={record} onComplete={this.state.openmodelform.onComplete.bind(this)} inModal={true} crud="c"/>
            </Modal>   
        )}
      </div>
    );
  }
}
/*
FormMain.propTypes = {
  // Core
  crud: React.PropTypes.string.isRequired,
  form: React.PropTypes.shape({
    store: React.PropTypes.string.isRequired,
    fields: React.PropTypes.array.isRequired
  }),
  value: React.PropTypes.shape({
    status: React.PropTypes.string.isRequired,
    record: React.PropTypes.object
  }),
  // used by childform
  parent: React.PropTypes.shape({
    form_id: React.PropTypes.string.isRequired,
    field_id: React.PropTypes.string.isRequired,
    record_id: React.PropTypes.string
  }),
  // used by lookup and childform (if no onComplete, assume top)
  onComplete: React.PropTypes.func,
  onFinished: React.PropTypes.func,
  inModal: React.PropTypes.bool
};
FormMain.defaultProps = { inModal: false};
*/
// stateless function components
// always use this for components that doesnt need any state or lifecycle methods!
export function FieldWithLabel ({field, value, edit, fc, onChange}) {
  return (
    <div className="slds-col slds-col--padded slds-size--1-of-2 slds-medium-size--1-of-2 slds-x-small-size--1-of-1">
      <div className={`slds-form-element ${edit ? '' : 'field-seperator'} ${field.required ? 'slds-is-required' : ''} ${fc.invalid ? 'slds-has-error' : ''}`}>
          <label className="slds-form-element__label form-element__label--small">{field.title}</label>
          <div className="slds-form-element__control"  style={{marginLeft: edit ? '0' : "15px"}}>
            <span className={(edit || field.type ==="dropdown_options")? " " : " slds-form-element__static"}>
                <Field fielddef={field} value={value} edit={field.display === "readonly"? false : edit} onChange={onChange}/>
            </span>
            { fc.invalid && <span className="slds-form-element__help">{fc.invalid}</span> }
          </div>
      </div>
    </div>
  );
}

export function FieldWithoutLabel ({field, value, edit, fc, onChange}) {
  return (
    <div className={`slds-form-element__control ${field.required ? 'slds-is-required' : ''} ${fc.invalid ? 'slds-has-error' : ''}`}  >
      <span className={(edit || field.type === "dropdown_options")? " " : " slds-form-element__static"}>
          <Field fielddef={field} value={value} edit={field.display === "readonly"? false : edit} onChange={onChange} inlist={true}/>
      </span>
      { fc.invalid && <span className="slds-form-element__help">{fc.invalid}</span> }
    </div>
  );
}

// *** NEW ListPage
export function ListPage ({form, query}) {
  const [ value, setValue ] = useState({status: "wait", records: []})
  const f = DynamicForm.instance.getForm (form._id)

  useEffect(() => {
    _dataChanged()
  }, [form, query])

  function _dataChanged() {
    const f = DynamicForm.instance.getForm (form._id)
    DynamicForm.instance.query (f._id, query && query).then(
      succRes => setValue({status: "ready", records: succRes}),
      errRes  => setValue({status: "error", message: JSON.stringify(errRes.error) })
    )
  }

  return (
    <div className="slds-grid slds-wrap">
      <div className="slds-col slds-size--1-of-1">
      { <FormHeader form={f} count={value.records ? value.records.length : 0} buttons={[{title: "New", action: {nav: {component: "RecordPage", formid: f._id, props: {"e": true}}}}]}/>
      }
      </div>
      { value.status === "error"?
        <div className="slds-col slds-size--1-of-1">
          <Alert type="error" message={value.message}/>
        </div>
      :
      <div className="slds-col slds-size--1-of-1">
        <ListMain noheader={true} value={value} form={f} onDataChange={_dataChanged}/>
      </div>
      }
    </div>
  )
}

export class ListMain extends Component {
  constructor(props) {
    super(props);

    let listfields = props.form.fields ? props.form.fields.filter(m => m.display === 'list' || m.display === 'primary') : [];
    /* KH- add "_id" field to form.store = 'metadata', so data can be used in Reference fields */
    if (props.inline && props.form.store === 'metadata') {
      listfields = [{name: '_id', display: 'list', title: 'Key', type: 'text', required: true}].concat(listfields)
    }

    //this.custom_buttons = props.form.fields ? props.form.fields.filter(m => m.type === 'button') : [];

    //console.log (`ListMain constructor [form ${props.form.name}] : ' + JSON.stringify(props.value)`);
    this.state = {
      listfields: listfields,
      inlineCtrl: {enabled: props.inline, editidx: null, editval: {}},
      inlineData: props.inline && props.value,  // inline data is locally mutable, so save in state
      editrow: false,
    };
  }

  _ActionDelete (rowidx) {
    let row = this.props.value.records[rowidx];
    if (window.confirm("Sure?")) {
      let df = DynamicForm.instance;
      df.delete (this.props.form._id, row._id, this.props.parent).then(succVal => {
        if (this.props.onDataChange) {
          // this will re-load the data at the parent, and in turn send new props
          this.props.onDataChange();
        }
      });
    }
  }

  _ActionEdit (rowidx, view = false) {
    let records = this.props.value.records;
    console.log ("ListMain _ActionEdit rowidx :" + rowidx + ", view : " + view);
    if (this.props.parent)
      if (rowidx >= 0) // edit existing row
        this.setState({editrow: {value: {status: "ready", record: records[rowidx]}, crud: view ? "r" : "u"}});
      else // add new row
        this.setState({editrow: {value: {status: "ready", record: {}}, crud: "c"}});
    else
      navTo("RecordPage", this.props.form._id, rowidx >= 0 && records[rowidx]._id,  !view ? {"e": true} : {});
  }

  /***************/
  /** inline  ****/
  _inLinefieldChange(val) {
    let editval = Object.assign(this.state.inlineCtrl.editval, val)
    _formControlState (true, {fields: this.state.listfields}, editval, this.props.parentrec).then(fc => {
      this.setState({inlineCtrl: Object.assign(this.state.inlineCtrl, {fc: fc, editval: editval})});
    })
  }

  _inLineEdit(rowidx) {
    //console.log ("ListMain _inLineEdit rowidx :" + rowidx);
    let records = this.state.inlineData.records,
        editval = (rowidx >= 0) ? Object.assign({}, records[rowidx]) : {}
    
    _formControlState (true, {fields: this.state.listfields}, editval, this.props.parentrec).then(fc => {
      this.setState({inlineCtrl: Object.assign(this.state.inlineCtrl, {editidx: rowidx, fc: fc, editval: editval})}, () => {
        if (this.props.onDataChange) this.props.onDataChange({disableSave : true});
      })
    })
  }

  _inLineDelete(rowidx) {
    let clonearray = this.state.inlineData.records.slice(0);
    clonearray.splice(rowidx, 1);
    //console.log ("ListMain _delete rowidx:" + rowidx + ", result : " + JSON.stringify(clonearray));
    this.setState({inlineData: {status: "ready", records: clonearray}, inlineCtrl: {enabled: true, editidx: null, editval: {}}}, () => {
      if (this.props.onDataChange) this.props.onDataChange({data: clonearray, disableSave: false})
    });
  }
  // Save or Cancel inline data row
  _inLineSave(saveit) {
    //console.log ("ListMain _inLineSave : saveit:"+saveit+" ["+ this.state.inlineCtrl.editidx + "] : " + JSON.stringify(this.state.inlineCtrl.editval));
    if (saveit) { // save
      let clonearray = this.state.inlineData.records.slice(0);
      if (this.state.inlineCtrl.editidx >= 0) { // save existing row
        clonearray[this.state.inlineCtrl.editidx] = this.state.inlineCtrl.editval
      } else {// save a new row
        clonearray.push (this.state.inlineCtrl.editval)
      }
      //console.log ("ListMain _inLineSave : inform parent of new data, clonearray:" +JSON.stringify(clonearray));
      this.setState({inlineData: {status: "ready", records: clonearray}, inlineCtrl: {enabled: true, editidx: null, editval: {}}}, () => {
        if (this.props.onDataChange) this.props.onDataChange({data: clonearray, disableSave: false});
      });
    } else { // cancel
      this.setState({inlineCtrl: {enabled: true, editidx: null, editval: {}}}, () => {
        if (this.props.onDataChange) this.props.onDataChange({disableSave: false})
      });
    }
  }


  _onFinished (val) {
    //console.log ('ListMain _onFinished() ' + JSON.stringify(val));
    if (val) {
      if (this.props.onDataChange) {
        // this will re-load the data at the parent, and in turn send new props
        this.props.onDataChange();
      }
    } else {
      //console.log ("ListMain _formDone() no data, must be cancel");
      this.setState ({editrow: false});
    }
  }

  componentWillReceiveProps (nextProps) {
    //console.log ("ListMain componentWillReceiveProps");
    if (nextProps.value) {
      this.setState ({editrow: false});
    }
  }

  // When used to select from a list
  _handleSelect(id) {
    this.props.selected(id);
  }

  render() {
 
    let self = this,
        {status, records} = this.state.inlineCtrl.enabled? this.state.inlineData : this.props.value,
        buttons = this.props.selected ? [{title: "Cancel", action: {cb: this.props.selected.bind(this, false)}}] : [{title: "New", action: {cb: this._ActionEdit.bind(this, -1, false)}}]
    //console.log (`ListMain - render:  ${status}`) //:  + ${JSON.stringify(this.props.value)}`);
    return (
      <div className="">
          {  (!self.state.inlineCtrl.enabled) && (!this.props.noheader) &&
            <SectionHeader title={this.props.title || this.props.form.name} buttons={buttons} />
          }
          <div className="box-bo dy table-resp onsive no-pad ding">
            <div className="slds-scrollable--x">
              <table className="slds-table slds-table--bordered">
                <thead>
                  <tr className="slds-text-heading--label">
                    { (!self.state.inlineCtrl.enabled) &&
                    <th className="slds-row-select" scope="col">
                      <label className="slds-checkbox" >
                        <input className="checkbox" type="checkbox"  />
                        <span className="slds-checkbox--faux"></span>
                        <span className="slds-form-element__label slds-assistive-text">select all</span>
                      </label>
                    </th>
                    }
                    {self.state.listfields.map(function(field, i) { return (
                      <th key={i} scope="col">
                        <div  className="slds-truncate" style={{padding: ".5rem .0rem"}}>{field.title}</div>
                      </th>
                    );})}

                    { !self.props.viewonly &&
                    <th className="slds-row-select" scope="col">
                      { self.state.inlineCtrl.enabled ?
                      <span className="slds-truncate">
                        <button className="link-button" onClick={this._inLineEdit.bind(this, -1)} style={{marginRight: "5px"}}>
                          <SvgIcon spriteType="utility" spriteName="new" small={true}/>
                        </button>add
                      </span>
                      :
                      !this.props.selected && (
                        <span className="slds-truncate">del edit</span>
                      )
                      }
                    </th>
                    }

                  </tr>
                </thead>
                <tbody>
                  {[...Array((records? records.length : 0) + (self.state.inlineCtrl.editidx === -1? 1 : 0))].map ((z,i) => {
                    
                    let edit = (i === self.state.inlineCtrl.editidx || (self.state.inlineCtrl.editidx === -1 && i === records.length)),
                        row = edit === true? self.state.inlineCtrl.editval : records[i]  

                    return (
                      <tr key={i} className="slds-hint-parent">
                        { !self.state.inlineCtrl.enabled &&
                        <td className="slds-row-select">
                          <label className="slds-checkbox" >
                            <input className="select-row1" type="checkbox" />
                            <span className="slds-checkbox--faux"></span>
                            <span className="slds-form-element__label slds-assistive-text">select row1</span>
                          </label>
                        </td>
                        }

                        {self.state.listfields.map(function(field, fidx) {
                          let listfield =  <FieldWithoutLabel field={field} value={row[field.name]} edit={edit} onChange={self._inLinefieldChange.bind(self)} fc={(edit && self.state.inlineCtrl.fc)? self.state.inlineCtrl.fc.flds[field.name] : {visible: true, invalid: false}}/>;
                          if (field.display === "primary" && field.type !== "reference" &&  !self.state.inlineCtrl.enabled) {
                            if (self.props.parent )
                              return (
                              <td key={fidx}><button className="link-button" style={{color: "#0070d2", cursor: "pointer"}} onClick={self._ActionEdit.bind(self, i, true)}>{listfield}</button></td>);
                            else
                              return (
                              <td key={fidx}><Link component="RecordPage" formid={self.props.form._id} recordid={row._id}>{listfield}</Link></td>);
                          } else {
                            return (<td key={fidx}>{listfield}</td>);
                          }
                        })}

                        { !self.props.viewonly &&
                          <td className="slds-row-select">

                            { self.props.selected ?
                              <button className="slds-button slds-button--brand" onClick={self._handleSelect.bind(self,row)}>select </button>
                            :  edit ?
                              <div className="slds-button-group">
                                <button className="slds-button slds-button--brand" onClick={self._inLineSave.bind(self, true)} disabled={self.state.inlineCtrl.fc.invalid}>Save </button>
                                <button className="slds-button slds-button--brand" onClick={self._inLineSave.bind(self, false)}>Cancel </button>
                              </div>
                            : self.state.inlineCtrl.enabled ?
                              <div className="slds-button-group">
                                <button className="link-button" onClick={self._inLineDelete.bind(self, i)} style={{marginRight: "15px"}}><SvgIcon spriteType="utility" spriteName="clear" small={true}/>  </button>
                                <button className="link-button" onClick={self._inLineEdit.bind(self, i, false)} disabled={self.state.inlineCtrl.editidx} ><SvgIcon spriteType="utility" spriteName="edit" small={true}/>  </button>
                            </div>
                            :
                              <div className="slds-button-group">
                                <button className="link-button" onClick={self._ActionDelete.bind(self, i)} style={{marginRight: "15px"}}><SvgIcon spriteType="utility" spriteName="clear" small={true}/>  </button>
                                <button className="link-button" onClick={self._ActionEdit.bind(self, i, false)} ><SvgIcon spriteType="utility" spriteName="edit" small={true}/>  </button>
                              </div>
                            }

                          </td>
                        }
                      </tr>
                    )
                })}
                </tbody>
              </table>
            </div>
          </div>
          { this.state.editrow &&
            <Modal>
                <FormMain  value={this.state.editrow.value} form={this.props.form} crud={this.state.editrow.crud} parent={this.props.parent} parentrec={this.props.parentrec} onComplete={this._onFinished.bind(this)} inModal={true}/>
            </Modal>
          }
      </div>
    )
  }
}

export function RecordPage ({form, e, xid}) {
  const [ value, setValue ] = useState(xid? {status: "wait", record: {}} : {status: "ready", record: {}})
  
  useEffect(() => {
    _dataChanged()
  }, [form, xid])

  function _dataChanged() {
    if (xid) {
      DynamicForm.instance.getbyId(form._id, xid).then(
        succRes => setValue({status: "ready", record: succRes}),
        errRes  => setValue({status: "error", message: errRes.error })
      )
    }
  }

   //console.log ("Form: rendering state: "); // + JSON.stringify(this.state.value));
  /* Removed prop from FormMain - parent={this.props.urlparam.parent}  - will never happen?? */
  const f = DynamicForm.instance.getForm (form._id)
  const crud =  !xid? "c" : (e)?  "u" : "r"
  return (
    <div className="slds-grid slds-wrap">
      <div className="slds-col slds-size--1-of-1">
        { <FormHeader form={f}/>
        }
      </div>

      { value.status === "error" &&
        <div className="slds-col slds-size--1-of-1">
          <Alert message={value.message}/>
        </div>
      }
      { value.status !== "error" && [

        <div key="FormMain" className="slds-col slds-size--1-of-1 slds-medium-size--1-of-2">
            <FormMain key={form._id} value={value} form={f}  crud={crud} onDataChange={_dataChanged}/>
        </div>,

        <div key="childforms" className="slds-col slds-size--1-of-1 slds-medium-size--1-of-2">
          {crud === "r"  && value.status === "ready" && f.fields.filter(m => m.type === 'childform').map((field, i) => {
            let cform = field.child_form && DynamicForm.instance.getForm(field.child_form._id)
            if (cform) return (
              <div key={`${cform._id}${i}`} style={{padding: "0.5em"}}>
                <ListMain title={field.title} parent={{form_id: form._id, record_id: value.status === 'ready'? value.record._id : "new", field_id: field._id }} parentrec={value.record} form={cform} value={{status: value.status, records: value.status === "ready"? value.record[field.name] : []}} onDataChange={_dataChanged}/>
              </div>
              );
            else return (
              <Alert key={`err${field.name}`} message={`RecordPage: no childform found in application : ${field.name}`}/>
            );})}
        </div>,
      
        <div key="relatedlists" className="slds-col slds-size--1-of-1 slds-medium-size--1-of-2">
          {crud === "r"  && value.status === "ready" && f.fields.filter(m => m.type === 'relatedlist').map((field, i) => {
            return (
            <div key={`${field.child_form._id}${i}`} style={{padding: "0.5em"}}>
              <ListPage  form={field.child_form} query={{[field.name]: {_id: value.record._id}}} />
            </div>
          );})}
        </div>
      ]}

    </div>
  )
}
