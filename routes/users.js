const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const User = mongoose.model("users")
require("../models/User")
const bcrypt = require("bcryptjs")
const passport = require("passport")
    require("../config/auth")(passport)

router.get("/", (req, res, next) =>{
    res.render("users/index", { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->" })
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