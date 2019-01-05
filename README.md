### React

STATELESS COMPONENT declared as a function that has no state and returns the same markup given the same props. must not retain internal state!

PURE COMPONENT is one of the most significant ways to optimize React applications. The usage of Pure Component gives a considerable increase in performance because it reduces the number of render operation in the application.

PureComponent changes the life-cycle method shouldComponentUpdate and adds some logic to automatically check whether a re-render is required for the component.  This allows a PureComponent to call the method render only if it detects changes in state or props

### Hooks

All React components become functions! no more ES6 classes

So how does React know which state corresponds to which useState call? Ensure that Hooks (useState , useEffect) are called in the same order in the function each time a component renders. That’s what allows React to correctly preserve the state of Hooks between multiple useState and useEffect calls

Don’t call Hooks from regular JavaScript functions, only from  React "function components", or Call Hooks from custom Hooks (use[Name])


granularity of State - we recommend to split state into multiple state variables based on which values tend to change together

### simple field Types
type: "text"
type: "textarea"
type: "dropdown"
type: "boolean"
type: "jsonarea"
type: "image"
type: "email"
type: "icon"
type: "dropdown_options"
type: "formula"
type: "secret"

### reference fields 

lookups to other collections/forms

type: "reference",
createnew_form: { _id: Forms.App},
search_form: { _id: Forms.App},

### childform fields 

embedded arrays of objects defined by child_form)

type: "childform",
child_form: { _id: Forms.AppPerms},
 _id: new ObjectID('000000000a01')

### relatedlist??

type: "relatedlist"

### dynamic fields

The field definition is dependant on a related record, referenced via the expression language:

https://github.com/TechnologyAdvice/jexl

    context: 'rec' is the actual document (or embedded document) at the level of the 'dynamic' field 
    user function : get (defined at bottom of orm_mongo.js)

    id | get(view)
    view = "name" of the metaform defintion
    id = _id of the record to get



type: "dynamic",
fieldmeta_el: "rec.app._id|get('App').userfields"


### display

primary
list
readonly

### field attributes

'default_value'  - expression, realtime populate the field with a default value based on context data (ie field name based on field label)!
'show_when' - expression, when to display the field on the form

###  dynamic forms

--- load

RecordPage -> ListMain -> _formControlState
ListMain -> FormMain -> _formControlState

React: https://reactjs.org/docs/uncontrolled-components.html
In most cases, we recommend using controlled components to implement forms.  To write an uncontrolled component, instead of writing an event handler for every state update, you can use a ref to get form values from the DOM


-- update field

dform_fields.jsx > <Field> Functional Component, render the {value} from their props, and with onChange={onChange} prop called when a field is updated!


Field props.OnChange -> FormMain (_fieldChange)