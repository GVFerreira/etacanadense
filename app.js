const express = require('express')
const app = express()
const session = require("express-session")

const moment = require('moment')
const handlebars = require('express-handlebars')
const handle = handlebars.create({
    defaultLayout: 'main',
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
    },
    helpers: {
        formatDate: (date) => {
            return moment(date).format('DD/MM/YYYY hh:mm')
        },
        pagination: (page, totalPages, limit, sort) => {
            let output = '';
  
            for (let i = 1; i <= totalPages; i++) {
                // Marca a página atual como "ativa"
                const pageNUM = parseInt(page)
                const activeClass = i === pageNUM ? 'btn-success' : 'btn-secondary ';

                // Gera o HTML para o link da página
                output += `
                    <a class="btn ${activeClass}" href="/admin?sort=${sort}&limit=${limit}&page=${i}">${i}</a>
                `;
            }

            return output;
        }
    }
})

const bodyParser = require('body-parser')

const mongoose = require('mongoose')
require('./models/Visa')
const Visa = mongoose.model("visa")
require('./models/User')
const User = mongoose.model("users")

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('./helpers/senderMail')

const admin = require('./routes/admin')
const users = require('./routes/users')
const checkout = require('./routes/checkout')

const flash = require("connect-flash")

const path = require('path')

const dotenv = require('dotenv')
require('dotenv').config()

const bcrypt = require('bcryptjs')

const mercadopago = require('./config/mercadoPago')
const { stringify } = require('querystring')

mercadopago.configure({
    access_token: 'TEST-7703581273948303-040210-09008d0ef878c5f0c346329e85b0ac55-718885874'
})

const keyFilename = './eta-canadense-384823-eea18766c9e1.json'

const { Datastore } = require('@google-cloud/datastore')

const { DatastoreStore } = require('@google-cloud/connect-datastore')

const datastore = new Datastore({
    projectId: 'eta-canadense-384823',
    keyFilename
})


/*AUTHENTICATION*/
const passport = require("passport")
require("./config/auth")(passport)
const { isAdmin } = require('./helpers/isAdmin')


/*SETTINGS*/
app.use(express.static(path.join(__dirname, "public")))
app.use(session({
    store: new DatastoreStore({
        dataset: datastore,
        kind: 'express-sessions',
    }),
    secret: '123123123123123',
    resave: false,
    saveUninitialized: true
}))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())

//Handlerbars
app.engine('handlebars', handle.engine)
app.set('view engine', 'handlebars')

//Body Parser
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

//Middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.flash("success_msg")
    res.locals.error_msg = req.flash("error_msg")
    res.locals.error = req.flash("error")
    res.locals.user = req.user || null
    next()
})

//Mongoose
    const dbDEV = `mongodb://127.0.0.1:27017/etacanadense`
    const dbPROD = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbkeaad.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
    mongoose.set('strictQuery', true)
    mongoose.connect(dbDEV, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log("MONGODB CONNECTED")
    }).catch((err) => {
        console.log(`Erro: ${err}`)
    })

//Mercaado Pago
    mercadopago.configure({
        access_token: 'TEST-7703581273948303-040210-09008d0ef878c5f0c346329e85b0ac55-718885874',
        sandbox: true,
    })

const validarFormulario = (req, res, next) => {
    const etapaAnterior = req.query.etapa ? teste = parseInt(req.query.etapa) - 1 : 0
    if (etapaAnterior > 0) {
        const dadosEtapaAnterior = req.session[`aplicacaoStep`]
        if (!dadosEtapaAnterior) {
        req.flash('error_msg', 'Você não pode acessar a próxima etapa')
        res.redirect(`/aplicacao?etapa=${etapaAnterior}`)
        return
        }
    }
    next()
}

app.get('/', (req, res) => {
    req.session.destroy()
    res.render('index')
})

app.get('/aplicacao', validarFormulario, (req, res) => {
    if(!parseInt(req.query.etapa)) {
        const etapa = parseInt(req.query.etapa) || 1
        const title = "Representante - "
        res.render('aplicacao-step1', {title, data: req.session.aplicacaoStep})
    }

    if(parseInt(req.query.etapa) === 1) {
        const etapa = parseInt(req.query.etapa) || 1
        const title = "Representante - "
        res.render('aplicacao-step1', {title, data: req.session.aplicacaoStep})
    }

    if(parseInt(req.query.etapa) === 2) {
        const etapa = parseInt(req.query.etapa) || 2
        const title = "Validação - "
        res.render('aplicacao-step2', {title, data: req.session.aplicacaoStep})
    }

    if(parseInt(req.query.etapa) === 3) {
        const etapa = parseInt(req.query.etapa) || 3
        const title = "Documentos - "
        const data = req.session.aplicacaoStep
        const canadaVisa = data.canadaVisa
        const nonImmigrateVisa = data.nonImmigrateVisa
        if ((canadaVisa == "0" && nonImmigrateVisa == "1") || (canadaVisa == "1" && nonImmigrateVisa == "1")) {
            let dynamicData = `
                <h3 class="mt-4">Dados de não-imigrante</h3>

                <label class="mb-2">Número do visto de não imigrante nos EUA <span class="text-red">* (obrigatório)</span></label>
                <input type="text" class="form-control mb-3 w-50" name="numVisaNonImmigrate" id="numVisaNonImmigrate" maxlength="35" required>

                <label class="mb-2" for="dateVisaNonImmigrate">Data de expiração do visto americano de não-imigrante <span class="text-red">* (obrigatório)</span></label>
                <input type="date" class="form-control mb-3 w-25" name="dateVisaNonImmigrate" id="dateVisaNonImmigrate" onchange="validNotPresentDay(this)" required>   
            `
            res.render('aplicacao-step3', {title, dynamicData, data})
         } else {
            res.render('aplicacao-step3', {title, data})
         }
    }

    if(parseInt(req.query.etapa) === 4) {
        const etapa = parseInt(req.query.etapa) || 4
        const title = "Conferência - "
        const data = req.session.aplicacaoStep
        res.render('aplicacao-step4', {title, data})
    }

})

app.post('/aplicacaoStep1', (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.body)
    req.session.aplicacaoStep.representative = parseInt(req.session.aplicacaoStep.representative)
    if(req.session.aplicacaoStep.representativePayed) {
        req.session.aplicacaoStep.representativePayed = parseInt(req.session.aplicacaoStep.representativePayed)
    }
    res.redirect('/aplicacao?etapa=2')
})

app.post('/aplicacaoStep2', validarFormulario, (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    req.session.aplicacaoStep.passportBrazil = parseInt(req.session.aplicacaoStep.passportBrazil)
    req.session.aplicacaoStep.residentUSCIS = parseInt(req.session.aplicacaoStep.residentUSCIS)
    req.session.aplicacaoStep.airplane = parseInt(req.session.aplicacaoStep.airplane)
    req.session.aplicacaoStep.canadaVisa = parseInt(req.session.aplicacaoStep.canadaVisa)
    req.session.aplicacaoStep.nonImmigrateVisa = parseInt(req.session.aplicacaoStep.nonImmigrateVisa)
    res.redirect('/aplicacao?etapa=3')
})

app.post('/aplicacaoStep3',  validarFormulario, (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    req.session.aplicacaoStep.appliedToCanada = parseInt(req.session.aplicacaoStep.appliedToCanada)
    req.session.aplicacaoStep.travelWhen = parseInt(req.session.aplicacaoStep.travelWhen)
    req.session.aplicacaoStep.refusedVisaToCanda = parseInt(req.session.aplicacaoStep.refusedVisaToCanda)
    req.session.aplicacaoStep.criminalOffenceAnywhere = parseInt(req.session.aplicacaoStep.criminalOffenceAnywhere)
    req.session.aplicacaoStep.tuberculosis = parseInt(req.session.aplicacaoStep.tuberculosis)
    
    const userTime = req.body.hora 

    const userDate = moment(userTime, "HH:mm").toDate()

    const formattedTime = moment(userDate).format("HH:mm")
    res.redirect('/aplicacao?etapa=4')
})

app.post('/aplicacaoStep4',  validarFormulario, (req, res) => {
    bcrypt.genSalt(10, (error, salt) => {
        let code = ''
        bcrypt.hash(code, salt, (error, hash) => {
            let codeETA = ''
            code = hash
            codeETA = code.substring(40, 45).replace(/[^A-Z a-z 0-9]/g, "X").toUpperCase()

            //transporter.use('compile', hbs(handlebarOptions))

            // const mailOptions = {
            //     from: `eTA Canadense <${process.env.USER_MAIL}>`,
            //     to: receiver,
            //     replyTo: process.env.MAIL_REPLY,
            //     subject,
            //     template: 'template-email',
            //     context: {}
            // }

            // transporter.sendMail(mailOptions, (err, info) => {
            //     if(err) {
            //         console.log(`Error: ${err}`)
            //     } else {
            //         console.log(`Message sent: ${info}`)
            //     }
            // })

            const agreeCheck = req.body.agreeCheck
            const consentAndDeclaration = req.body.consentAndDeclaration

            const newVisa = new Visa(Object.assign({}, req.session.aplicacaoStep, {agreeCheck, consentAndDeclaration, codeETA}))

            req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {agreeCheck, consentAndDeclaration, codeETA})
        
            newVisa.save().then(() => {
                req.flash('success_msg', `Seus dados foram salvos com sucesso. Código: ${codeETA}`)
                res.redirect('/checkout/card')
            }).catch((err) => {
                console.log(err)
                req.flash('error_msg', 'Ocorreu um erro no processamento dos seus dados. Preencha o formulário novamente. Erro: ' + err)
                res.redirect('/aplicacao')
                req.session.destroy()
            })
        })      
    })
})

app.get('/acompanhar-solicitacao', (req, res) => {
    res.render('acompanhar-solicitacao', {title: 'Acompanhar solicitação - '})
})

app.post('/consultando-solicitacao', (req, res) => {
    if(req.body.codeInsert === undefined || req.body.codeInsert === null || req.body.codeInsert === '') {
        req.flash('error_msg', 'Insira um e-mail ou código')
        res.redirect('/acompanhar-solicitacao')
    } else {
        if (req.body.EmailCod === 'email') {
            Visa.findOne({contactEmail: req.body.codeInsert}).then((search_result) => {
                res.render('status-solicitacao', { search_result })
            })
        } else {
            Visa.findOne({codeETA: req.body.codeInsert}).then((search_result) => {
                res.render('status-solicitacao', { search_result })
            })
        }
        
    }
})

app.get('/contato', (req, res) => {
    res.render('contato', {title: 'Contato - '})
})

app.get('/politica-privacidade', (req, res) => {
    res.render('politica-privacidade', {title: 'Politica de privacidade - '})
})

app.use('/admin', /*isAdmin,*/ admin)
app.use('/users', users)
app.use('/checkout', checkout)

app.listen(process.env.PORT || 8000, ()=> {
    console.log("SERVER ON!")
})
