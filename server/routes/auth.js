const   
    express = require('express'),
    router = express.Router(),
    LocalStrategy = require('passport-local').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    ForceDotComStrategy = require('passport-forcedotcom').Strategy,
    OAuth2Strategy = require('passport-oauth2').Strategy,
//    , bcrypt = require('bcrypt')
    ObjectID = require('mongodb').ObjectID,
    meta = require('../libs/orm_mongo_meta'),
    jwt = require('jsonwebtoken'),
    url = require('url')


module.exports = function (passport, options) {

    console.log ('setting up auth routes ')
    var orm = require ("../libs/orm_mongo")(options)
    var db = options.db

    // Passport session setup.
    // To support persistent login sessions, Passport needs to be able to
    // serialize users into and deserialize users out of the session. Typically,
    // this will be as simple as storing the user ID when serializing, and
    // finding the user by ID when deserializing.
    passport.serializeUser(function (user, done) {
        console.log (`auth.js - passport.serializeUser(${user._id})`);
        done(null, user._id);
    });

    // from the id, retrieve the user details
    passport.deserializeUser(function (id, done) {
        console.log(`auth.js - passport.deserializeUser: call orm.find(${id})`);

        orm.find({form: meta.FORMMETA.find(f => f._id === meta.Forms.Users)}, {_id: id, display: 'all_no_system'}).then( user => {
            //console.log("-------- passport.deserializeUser : got user");
            done(null, user);
        }, err => res.status(400).send(err)).catch (err => res.status(400).send(err));
    });

    passport.use(new LocalStrategy(
        function (username, password, done) {
            // console.log('login attempt : ' + username);
            db.collection('user').findOne({
                partition_key: 0,
                email: username
            }, function (err, user) {
                if (err) {
                    console.log('login attempt : ' + err);
                    return done(null, false, err);
                }
                if (!user) {
                    console.log('login attempt : ' + 'Unknown user');
                    return done(null, false, 'Unknown user');
                }
                if (!user.provider.internal) {
                    return done(null, false, 'No password setup for this user');
                }
      //          if (!bcrypt.compareSync(password, user.provider.internal.password)) {
      //              console.log('login attempt : ' + 'Invalid password ');
      //              return done(null, false, 'Invalid password');
      //          }
                return done(null, user);
            });
        }
    ));

    function findAndUpdateUser(mappedUserObj, provider, provider_id, auth, done) {
        const 
            UserForm = meta.FORMMETA.find(f => f._id === meta.Forms.Users),
            user_q = {"provider.type": provider, "provider.provider_id": provider_id},
            user_q_cosmos = {"provider": { $elemMatch: { "type": provider, "provider_id": provider_id}}}
            
        console.log (`auth.js - findAndUpdateUser: looking for ${JSON.stringify(user_q)}`)
        // https://docs.mongodb.com/manual/tutorial/query-array-of-documents/
        orm.find({form: UserForm}, {q: user_q_cosmos, display: "all_no_system"}).then((existinguser) => {
          const pobject = {type: provider, provider_id: provider_id, access_token: auth.access_token, refresh_token: auth.refresh_token, instance_url: auth.instance_url }
          if (existinguser.length == 0) {
              mappedUserObj.provider = [pobject]
              console.log(`auth.js - findAndUpdateUser: No existing user, creating from social profile`);

              // exps.forms.AuthProviders
              orm.save ({form: UserForm}, mappedUserObj).then(function success(newuser) {
                      console.log (`auth.js - findAndUpdateUser: Saved new user`);
                      done(null, newuser);
                  }, function error(ee) {
                      console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                      return done(null, false, 'error creating user');
                  });
          } else if (existinguser.length > 1) {
            console.log ("auth.js - findAndUpdateUser: ERROR - Found more than one user");
            return done(null, false, "ERROR - Found more than one user");
          } else {
            console.log(`auth.js - findAndUpdateUser: Found existing user (${existinguser[0]._id})`);
            const AuthForm = meta.FORMMETA.find(f => f._id === meta.Forms.AuthProviders)
            // update the Users AuthProvider (comment out until COSMOS suports '$')
            /*
            let updateuser = {_id: existinguser[0].provider[0]._id, type: provider, provider_id: provider_id, access_token: auth.access_token, refresh_token: auth.refresh_token, instance_url: auth.instance_url }
            console.log(`auth.js - findAndUpdateUser: No existing user, creating from social profile`);

            
            orm.save ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, updateuser).then(function success(newuser_id) {
                console.log (`auth.js - findAndUpdateUser: Saved new user`);
                done(null, newuser_id);
            }, function error(ee) {
                console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                return done(null, false, 'error creating user');
            });
                */
            // TEMP WORKAROUND - Cosmos doesnt support positional '$'
            // https://feedback.azure.com/forums/263030-azure-cosmos-db/suggestions/20091454-positional-array-update-via-query-support
            // delete Chatter AuthForm
            orm.delete ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, {q: {"type": provider, "provider_id": provider_id}}).then(function success(newuser) {
                console.log (`auth.js - findAndUpdateUser: TEMPWORKAROUND - delete the AuthForm embedded doc`);
                const p_idx = existinguser[0].provider.findIndex(p => p.provider_id === provider_id)
                if (p_idx <0) {
                    existinguser[0].provider.push(pobject)
                } else {
                    existinguser[0].provider.splice(p_idx, 1, pobject)
                }
                // Insert new AuthForm
                orm.save ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, pobject).then(function success(provider_id) {
                    // 
                    console.log (`auth.js - findAndUpdateUser: TEMPWORKAROUND - re-create the AuthForm embedded doc ${JSON.stringify(provider_id)}`);
                    done(null, {_id: existinguser[0]._id});
                }, function error(ee) {
                    console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                    return done(null, false, 'error creating user');
                });
                
                //return done(null, existinguser[0]);
            }, function error(ee) {
                console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                return done(null, false, 'error deleting user');
            });
          }
      }, function error (e) {
        console.log(provider + ' strategy find user error:' + JSON.stringify(e));
        return done(provider + ' strategy find user error:' + JSON.stringify(e));
       });
    }
/*
    function callbackFn (err, user, next)  {

        if (err) { return next(err); }
        if (!user) { return res.redirect('/'); }

        // res.send(req.user);
        console.log('auth.js - /auth/facebook/callback: authenticate, err : ' + JSON.stringify(err) + ' user : ' + JSON.stringify(user));
        req.logIn(user, function(err){
            if (err) {
                return next(err);
            }
            console.log ('auth.js - /auth/facebook/callback: req.logIn successm now : redirect user to relaystate: ' + req.query.state);
            res.redirect(req.query.state || '/');
        })
    }
*/
    // AAD v2 All account types! - my-app-all-account-types
    passport.use(new OAuth2Strategy({
        authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        clientID: 'ac63f8a0-b746-4f10-96d7-80a1e3301bb7',
        clientSecret: process.env.SECRET_OAuth2Strategy,
        callbackURL: "/auth/oauth2/callback",
        scope: "openid profile email offline_access",
        passReqToCallback: true // <-- Required to get id_token (new function signature) (OpenID Connect)
      },
      function(req, accessToken, refreshToken, params, profile, done) {
        console.log ('OAuth2Strategy : got profile: ' + JSON.stringify(profile));
        const idToken = params['id_token']
        const idtoken_decoded = jwt.decode(idToken)
        if (idtoken_decoded.aud !== 'ac63f8a0-b746-4f10-96d7-80a1e3301bb7') {
            return done("token issuer not valid");
        } else {

            if (idtoken_decoded.iss === "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0") {
                console.log ("OAuth2Strategy : Issuer is the MSA tenant, account is MSA account!")
            } else {
                const tenantid = url.parse(idtoken_decoded.iss).pathname.split('/')[1]
                console.log (`OAuth2Strategy : AAD tenant, can ristrict allows Tenants here ${tenantid}`)
            }
        
            return findAndUpdateUser({
                name: idtoken_decoded.name,
                role: "new",
                email: idtoken_decoded.email
            }, "oauth2", idtoken_decoded.oid, {}, done);
        }
      }
    ));
    /*
    router.get('/oauth2', (req, res, next) => 
    passport.authenticate('oauth2', {state: req.query.state  || '/'})(req, res, next)
    )
    router.get('/oauth2/callback', (req, res, next) => {
        console.log ('auth.js - /auth/oauth2/callback: custom callback to handle the state');
        // supplying a function to 'authenticate' makes this a Custom Callback,
        // When using a custom callback, it becomes the application's responsibility to establish a session
        passport.authenticate('oauth2', callbackFn)(req,res,next)
    })
    */

    passport.use(new ForceDotComStrategy({
            authorizationURL: 'https://login.salesforce.com/services/oauth2/authorize',
            tokenURL: 'https://login.salesforce.com/services/oauth2/token',
            clientID: '3MVG9fTLmJ60pJ5IeetyXhW0bT.eDxBUUvclfkEr8_2Vqx5gxvimMOqpb4JhsSrasEul8Cdze21.CFTHogiil',
            clientSecret: process.env.SECRET_ForceDotComStrategy,
            scope: "api profile email refresh_token",
            callbackURL: "/auth/forcedotcom/callback"
        },
        function (auth, refreshToken, profile, done) {
          console.log ('ForceDotComStrategy : got profile: ' + JSON.stringify(profile));
          return findAndUpdateUser({
              name: profile.name.givenName + ' ' + profile.name.familyName,
              role: "new",
              email: profile.emails[0].value
            }, "chatter", profile.id, Object.assign({refresh_token: refreshToken}, auth.params), done);
        }
    ))


    passport.use(new FacebookStrategy({
            clientID: '448297785208364', // myapp
            clientSecret: process.env.SECRET_FacebookStrategy,
            callbackURL: "/auth/facebook/callback",
            profileFields: ['id', 'emails', 'name']
        },
        function (auth, refreshToken, profile, done) {
            console.log ('FacebookStrategy : got profile: ' + JSON.stringify(profile));
            return findAndUpdateUser({
                name: profile.name.givenName + ' ' + profile.name.familyName,
                role: "new",
                email: profile.emails[0].value
            }, "facebook", profile.id, {access_token: auth}, done);
        }
    ))
    


    /*
    router.get('/facebook', (req, res, next) => passport.authenticate('facebook', {state: req.query.state  || '/', scope: 'email' })(req, res, next))
    router.get('/facebook/callback',  (req, res, next) => {
            console.log ('auth.js - /auth/facebook/callback: custom callback to handle the state');
            // supplying a function to 'authenticate' makes this a Custom Callback,
            // When using a custom callback, it becomes the application's responsibility to establish a session
            passport.authenticate('facebook', callbackFn)(req,res,next);
        }
    )
    */



    router.post('/ajaxlogin', function (req, res, next) {
        passport.authenticate('local', function (err, user, info) {

            if (err) {
                return next(err);
            }
            if (!user) {
                console.log('local  ajaxlogin : NO user : ' + JSON.stringify(info));
                return res.json({result: false, message: info});
            } else {

                // res.send(req.user);
                console.log('local  ajaxlogin : user : ' + JSON.stringify(user) + ' info : ' + JSON.stringify(info) + ' state : ' + req.query.state);

                req.logIn(user, function (err) {
                    if (err) {
                        return next(err);
                    }
                    return res.json({result: true, user: user});
                });
            }
        })(req, res, next);
    });
/*

            { failureFlash: true}),
        function(req, res) {
            console.log('ajaxlogin: ' + JSON.stringify(req.user));
            res.send(req.user);
        });
*/

router.get('/me',   function(req, res) {
    console.log('/me: ' + JSON.stringify(req.user));
    res.send(req.user);
});

router.get('/logout', function (req,res) {
    console.error('logout called');
    req.session.destroy(function (err) {
        res.send({ok: 1})
    })

});

router.get('/:strategy', (req, res, next) => 
passport.authenticate(req.params["strategy"], {state: req.query.state  || '/'})(req, res, next)
)
router.get('/:strategy/callback', (req, res, next) => 
passport.authenticate(req.params["strategy"], { failureRedirect: '/login' })(req, res, next),
(req, res) => { res.redirect(req.query.state || '/') }
)

    return router;
}
