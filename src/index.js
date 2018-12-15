import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import './styles/main.scss';
import App from './App';
import DynamicForm from './services/dynamicForm.js'
import * as serviceWorker from './serviceWorker';

/* represnet the whole state of the appication 
    1. holds the current state
    2. allows us to dispatch actions
    3. how state is updated with actions
*/
new DynamicForm()

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
