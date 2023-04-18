const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const User = mongoose.model("users")
require("../models/User")
const bcrypt = require("bcryptjs")
const passport = require("passport")
    require("../config/auth")(passport)

router.get("/", (req, res, next) =>{
    res.render("users/index")
})

router.post("/login", (req, res, next) => {
    passport.authenticate("local", {
        successRedirect: "/admin",
        failureRedirect: "/users",
        failureFlash: true
    })(req, res, next)
})

router.get("/logout", (req, res) => {
    req.logout(() => {
        req.flash("success_msg", "Sessão finalizada com sucesso")
        res.redirect("/") 
    })
})

module.exports = router