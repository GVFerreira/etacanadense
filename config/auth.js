const localStrategy = require("passport-local").Strategy
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
require("../models/User")
const User = mongoose.model("users")

module.exports = (passport) => {
    passport.use(new localStrategy({usernameField: "email", passwordField: "password"}, (email, password, done) => {
        User.findOne({email: email}).then((user) => {
            if(!user){
                return done(null, false, {message: "Essa conta não existe!"})
            }

            bcrypt.compare(password, user.password, (error, batem) => {
                if(batem) {
                    return done(null, user)
                } else {
                    return done(null, false, {message: "Senha incorreta"})
                }
            })
        }).catch()
    }))

    passport.serializeUser((user, done) => done(null, user.id))

    passport.deserializeUser((id, done) => {
        User.findById(id, (erro, user) => {
            done(erro, user)
        })
    })
}