const   
    express = require('express'),
    router = express.Router(),
    LocalStrategy = require('passport-local').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    ForceDotComStrategy = require('passport-forcedotcom').Strategy,
//    , bcrypt = require('bcrypt')
    ObjectID = require('mongodb').ObjectID,
    meta = require('../libs/orm_mongo_meta')


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
        console.log ("passport.serializeUser");
        done(null, user._id);
    });

    // from the id, retrieve the user details
    passport.deserializeUser(function (id, done) {
        //console.log(`-------- passport.deserializeUser : ${id}`);

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

    var findAndUpdateUser = function(mappedUserObj, provider, provider_id, auth, done) {
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
            console.log("auth.js - findAndUpdateUser: Found existing user");
            const AuthForm = meta.FORMMETA.find(f => f._id === meta.Forms.AuthProviders)
            // update the Users AuthProvider (comment out until COSMOS suports '$')
            /*
            let updateuser = {_id: existinguser[0].provider[0]._id, type: provider, provider_id: provider_id, access_token: auth.access_token, refresh_token: auth.refresh_token, instance_url: auth.instance_url }
            console.log(`auth.js - findAndUpdateUser: No existing user, creating from social profile`);

            
            orm.save ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, updateuser).then(function success(newuser) {
                console.log (`auth.js - findAndUpdateUser: Saved new user`);
                done(null, newuser);
            }, function error(ee) {
                console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                return done(null, false, 'error creating user');
            });
                */
            // TEMP WORKAROUND
            // delete Chatter AuthForm
            orm.delete ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, {q: {"type": provider, "provider_id": provider_id}}).then(function success(newuser) {
                console.log (`auth.js - findAndUpdateUser: Saved new user`);
                const p_idx = existinguser[0].provider.findIndex(p => p.provider_id === provider_id)
                if (p_idx <0) {
                    existinguser[0].provider.push(pobject)
                } else {
                    existinguser[0].provider.splice(p_idx, 1, pobject)
                }
                // Insert new AuthForm
                orm.save ({form: AuthForm, parent: {form: UserForm, field: UserForm.fields.find((d) => d.name === "provider"), query: {_id: existinguser[0]._id}}}, pobject).then(function success(newuser) {
                    console.log (`auth.js - findAndUpdateUser: Saved new user`);
                    done(null, newuser);
                }, function error(ee) {
                    console.log ('auth.js - findAndUpdateUser: Create user error: ' + ee);
                    return done(null, false, 'error creating user');
                });
                
                return done(null, existinguser[0]);
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



    passport.use(new ForceDotComStrategy({
            authorizationURL: 'https://login.salesforce.com/services/oauth2/authorize',
            tokenURL: 'https://login.salesforce.com/services/oauth2/token',
            clientID: '3MVG9fTLmJ60pJ5IeetyXhW0bT.eDxBUUvclfkEr8_2Vqx5gxvimMOqpb4JhsSrasEul8Cdze21.CFTHogiil',
            clientSecret: '5477967329514184175',
            scope: "api profile email refresh_token",
            callbackURL: "/auth/salesforce/callback"
        },
        function (auth, refreshToken, profile, done) {
          console.log ('ForceDotComStrategy : got profile: ' + JSON.stringify(profile));
          return findAndUpdateUser({
              name: profile.name.givenName + ' ' + profile.name.familyName,
              role: "new",
              email: profile.emails[0].value
            }, "chatter", profile.id, Object.assign({refresh_token: refreshToken}, auth.params), done);
        }));
    router.get('/salesforce', (req, res, next) => 
        passport.authenticate('forcedotcom', {state: req.query.state  || '/'})(req, res, next)
    )
    router.get('/salesforce/callback', (req, res, next) => {
        console.log ('auth.js - /auth/salesforce/callback: custom callback to handle the state');
        // supplying a function to 'authenticate' makes this a Custom Callback,
        // When using a custom callback, it becomes the application's responsibility to establish a session
        passport.authenticate('forcedotcom', (err, user, info) => {

            if (err) { return next(err); }
            if (!user) { return res.redirect('/'); }

            // res.send(req.user);
            console.log('auth.js - /auth/facebook/callback: authenticate, err : ' + JSON.stringify(err) + ' user : ' + JSON.stringify(user) + ' info : ' + JSON.stringify(info));
            req.logIn(user, function(err){
                if (err) {
                    return next(err);
                }
                console.log ('auth.js - /auth/facebook/callback: req.logIn successm now : redirect user to relaystate: ' + req.query.state);
                res.redirect(req.query.state || '/');
            })
        })(req,res,next)
    })

    passport.use(new FacebookStrategy({
        clientID: '448297785208364', // myapp
        clientSecret: 'b9b07e0f0067868f597f1fa6deb279cd',
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
    }));
    
    router.get('/facebook', (req, res, next) => passport.authenticate('facebook', {state: req.query.state  || '/', scope: 'email' })(req, res, next))
    router.get('/facebook/callback',
/*
        passport.authenticate('facebook', { successRedirect: '/',
                failureRedirect: '/login' })
*/
        function (req, res, next) {

            console.log ('auth.js - /auth/facebook/callback: custom callback to handle the state');
            // supplying a function to 'authenticate' makes this a Custom Callback,
            // When using a custom callback, it becomes the application's responsibility to establish a session
            passport.authenticate('facebook', function(err, user, info) {

                if (err) { return next(err); }
                if (!user) { return res.redirect('/'); }

                // res.send(req.user);
                console.log('auth.js - /auth/facebook/callback: authenticate, err : ' + JSON.stringify(err) + ' user : ' + JSON.stringify(user) + ' info : ' + JSON.stringify(info));
                req.logIn(user, function(err){
                    if (err) {
                        return next(err);
                    }
                    console.log ('auth.js - /auth/facebook/callback: req.logIn successm now : redirect user to relaystate: ' + req.query.state);
                    res.redirect(req.query.state || '/');
                });
            })(req,res,next);
        }

    );





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

    return router;
}
