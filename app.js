const express = require('express')
const cors = require('cors')
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
            const dataBanco = new Date(date)
            const dataFormatada = dataBanco.toLocaleString()
            return dataFormatada
            // return moment(date).format('DD/MM/YYYY hh:mm')
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
const hbs = require('nodemailer-express-handlebars')

const admin = require('./routes/admin')
const users = require('./routes/users')
const checkout = require('./routes/checkout')

const flash = require("connect-flash")

const path = require('path')

const dotenv = require('dotenv')
require('dotenv').config()

const bcrypt = require('bcryptjs')

const cookieParser = require('cookie-parser')

const mercadopago = require('./config/mercadoPago')


/*AUTHENTICATION*/
const passport = require("passport")
require("./config/auth")(passport)
const { isAdmin } = require('./helpers/isAdmin')


/*SETTINGS*/
app.use(cors({
    origin: 'http://etacanadense.com.br'
}))
app.use(express.static(path.join(__dirname, "public")))
app.use(session({
    secret: process.env.SECRET,
    resave: true,
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
app.use(cookieParser())

app.use((req, res, next) => {
    if (!req.session.aplicacaoStep) {
      req.session.aplicacaoStep = {} // Inicialize o objeto aplicacaoStep
    }
    next()
})

//Mongoose
    mongoose.set('strictQuery', true)
    mongoose.connect(process.env.DB_STRING_CONNECT, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log("MONGODB CONNECTED")
    }).catch((err) => {
        console.log(`Erro: ${err}`)
    })

//Mercaado Pago
    mercadopago.configure({
        access_token: process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN,
        sandbox: true,
    })

app.post('/accept-policy', (req, res, next) => {
    //Setar cookie de aceite de política por 1 ano
    res.cookie('policyAccepted', true, { maxAge: 31536000000 })
    res.redirect('/')
})


app.get('/', (req, res) => {
    req.session.destroy()
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    const metaDescription = "Garanta sua entrada no Canadá de forma descomplicada e segura com o eTA (Autorização Eletrônica de Viagem). Nosso processo de solicitação online simplifica sua jornada. Solicite seu eTA agora e aproveite uma viagem tranquila ao Canadá" 
    res.render('index', {showPolicyPopup, metaDescription})
})

app.get('/aplicacao', (req, res) => {
    if(!parseInt(req.query.etapa)) {
        const title = "Representante - "
        res.render('aplicacao-step1', {
            title,
            data: req.session.aplicacaoStep,
            metaDescription: 'Inicie o processo de solicitação de Autorização Eletrônica de Viagem para o Canadá. Siga nosso guia passo a passo para obter acesso rápido e fácil a este destino deslumbrante'
        })
    }

    if(parseInt(req.query.etapa) === 2) {
        const sessionaData = req.session.aplicacaoStep
        if('representative' in sessionaData ) {
            const title = "Validação - "
            res.render('aplicacao-step2', {title, data: req.session.aplicacaoStep})
        } else {
            req.flash('error_msg', 'Os campos na etapa 1 devem ser preenchidos.')
            res.redirect(`/aplicacao`)
        }

    }

    if(parseInt(req.query.etapa) === 3) {
        const sessionaData = req.session.aplicacaoStep
        if('document' in sessionaData) {
            const title = "Documentos - "
            const data = req.session.aplicacaoStep
            const canadaVisa = data.canadaVisa
            const nonImmigrateVisa = data.nonImmigrateVisa
            if ((canadaVisa == "0" && nonImmigrateVisa == "1") || (canadaVisa == "1" && nonImmigrateVisa == "1")) {
                let dynamicData = `
                    <h3 class="mt-4">Dados de não-imigrante</h3>

                    <label class="mb-2">Número do visto de não imigrante nos EUA <span class="text-red">* (obrigatório)</span></label>
                    <span class="d-block small mb-2">
                        Confira no botão ao lado
                        <a type="button" data-bs-toggle="modal" data-bs-target="#documentModalNumVisaNonImmigrate">
                            <i class="d-block bi bi-question-circle-fill btn btn-primary p-1"></i>
                        </a>
                    </span>
                    <input type="text" class="form-control mb-3 w-50" name="numVisaNonImmigrate" id="numVisaNonImmigrate" maxlength="35" required>

                    <label class="mb-2" for="dateVisaNonImmigrate">Data de expiração do visto americano de não-imigrante <span class="text-red">* (obrigatório)</span></label>
                    <input type="date" class="form-control mb-3 w-25" name="dateVisaNonImmigrate" id="dateVisaNonImmigrate" onblur="validNotPresentDay(this)" required>   
                `
                res.render('aplicacao-step3', {title, dynamicData, data})
            } else {
                res.render('aplicacao-step3', {title, dynamicData: '', data})
            }
        } else {
            req.flash('error_msg', 'Os campos na etapa 2 devem ser preenchidos.')
            res.redirect(`/aplicacao?etapa=2`)
        }
        
    }

    if(parseInt(req.query.etapa) === 4) {
        const sessionaData = req.session.aplicacaoStep
        if('numPassport' in sessionaData) {
            const title = "Conferência - "
            const data = req.session.aplicacaoStep
            res.render('aplicacao-step4', {title, data})
        } else {
            req.flash('error_msg', 'Os campos na etapa 3 devem ser preenchidos.')
            res.redirect(`/aplicacao?etapa=3`)
        }
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

app.post('/aplicacaoStep2', (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    req.session.aplicacaoStep.passportBrazil = parseInt(req.session.aplicacaoStep.passportBrazil)
    req.session.aplicacaoStep.residentUSCIS = parseInt(req.session.aplicacaoStep.residentUSCIS)
    req.session.aplicacaoStep.airplane = parseInt(req.session.aplicacaoStep.airplane)
    req.session.aplicacaoStep.canadaVisa = parseInt(req.session.aplicacaoStep.canadaVisa)
    req.session.aplicacaoStep.nonImmigrateVisa = parseInt(req.session.aplicacaoStep.nonImmigrateVisa)
    res.redirect('/aplicacao?etapa=3')
})

app.post('/aplicacaoStep3', (req, res) => {
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

app.post('/aplicacaoStep4', async (req, res) => {
    bcrypt.genSalt(10, (error, salt) => {
        let code = ''
        bcrypt.hash(code, salt, (error, hash) => {
            let codeETA = ''
            code = hash
            codeETA = code.substring(40, 45).replace(/[^A-Z a-z 0-9]/g, "X").toUpperCase()

            const agreeCheck = req.body.agreeCheck
            const consentAndDeclaration = req.body.consentAndDeclaration

            const newVisa = new Visa(Object.assign({}, req.session.aplicacaoStep, {agreeCheck, consentAndDeclaration, codeETA}))

            const visaID = newVisa._id

            req.session.aplicacaoStep = Object.assign({}, {visaID}, req.session.aplicacaoStep, {agreeCheck, consentAndDeclaration, codeETA})
        
            newVisa.save().then(() => {
                transporter.use('compile', hbs(handlebarOptions))

                const mailOptions = {
                    from: `eTA Canadense <${process.env.USER_MAIL}>`,
                    to: req.session.aplicacaoStep.contactEmail,
                    bcc: 'contato@etacanadense.com.br',
                    subject: `Confirmação de Recebimento Código ${req.session.aplicacaoStep.codeETA} - Autorização Eletrônica de Viagem Canadense`,
                    template: 'aviso-eta',
                }

                transporter.sendMail(mailOptions, (err, info) => {
                    if(err) {
                        console.error(err)
                        req.flash('error_msg', `Houve um erro ao enviar este e-mail: ${err}`)
                        req.session.destroy()
                        res.redirect('/aplicacao')
                    } else {
                        console.log(info)
                        req.flash('success_msg', `Seus dados foram salvos com sucesso. Código: ${codeETA}`)
                        res.redirect('/checkout')
                    }
                })
                
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
    res.render('acompanhar-solicitacao', {
        title: 'Acompanhar solicitação - ',
        metaDescription: 'Acompanhe o status de sua solicitação de eTA em tempo real. Fique atualizado sobre o progresso e a aprovação de sua Autorização Eletrônica de Viagem para o Canadá.'
    })
})

app.post('/consultando-solicitacao', (req, res) => {
    if(req.body.codeInsert === undefined || req.body.codeInsert === null || req.body.codeInsert === '') {
        req.flash('error_msg', 'Insira um e-mail ou código')
        res.redirect('/acompanhar-solicitacao')
    } else {
        if (req.body.EmailCod === 'email') {
            Visa.find({contactEmail: req.body.codeInsert}).then((search_result) => {
                res.render('status-solicitacao', { search_result })
            })
        } else {
            Visa.find({codeETA: req.body.codeInsert}).then((search_result) => {
                res.render('status-solicitacao', { search_result })
            })
        }
        
    }
})

app.get('/consulta-download-documento/:filename', (req, res) => {
    res.download(`public/uploads/attachments/${req.params.filename}`)
})

app.get('/contato', (req, res) => {
    res.render('contato', {
        title: 'Contato - ',
        metaDescription: 'Entre em contato conosco para todas as suas dúvidas e necessidades relacionadas à Autorização Eletrônica de Viagem para o Canadá. Estamos aqui para ajudar a tornar sua viagem o mais tranquila possível.'
    })
})

app.post('/contact-form', (req, res) => {
    transporter.use('compile', hbs(handlebarOptions))

    const mailOptions = {
        from: `eTA Canadense <${process.env.USER_MAIL}>`,
        to: 'contato@etacanadense.com.br',
        subject: 'Formulário de Contato',
        template: 'contato',
        context: {
            name: req.body.name,
            email: req.body.email,
            message: req.body.message
        }
    }

    transporter.sendMail(mailOptions, (err, info) => {
        if(err) {
            console.error(err)
            req.flash('error_msg', `Houve um erro ao enviar este formulário: ${err}`)
            res.redirect('/contato')
        } else {
            console.log(info)
            req.flash('success_msg', `Formulário enviado com sucesso. Em breve nossa equipe entrará em contato.`)
            res.redirect('/contato')
        }
    })
})

app.get('/artigos', (req, res) => {
    res.render('artigos', {
        title: 'Artigos - ',
        metaDescription: 'Explore nosso catálogo de artigos informativos sobre viagens ao Canadá, Autorização Eletrônica de Viagem e dicas úteis para uma visita perfeita.'
    })
})

app.get('/politica-privacidade', (req, res) => {
    res.render('politica-privacidade', {
        title: 'Politica de privacidade - ',
        metaDescription: 'Saiba como protegemos seus dados pessoais. Leia nossa Política de Privacidade para entender nosso compromisso com a segurança e a confidencialidade.'
    })
})

app.get('/termos-condicoes', (req, res) => {
    res.render('termos-condicoes', {
        title: 'Termos e Condições - ',
        metaDescription: 'Conheça nossos Termos e Condições para solicitação e uso da Autorização Eletrônica de Viagem para o Canadá. Garanta que sua viagem esteja em conformidade com as regras e regulamentos'
    })
})

app.use('/admin', isAdmin, admin)
app.use('/users', users)
app.use('/checkout', checkout)

app.use((req, res) => {
    res.status(404).render("erro404", {title: "Error 404 - "})
})

const PORT = process.env.PORT || 3030
app.listen(PORT, ()=> {
    console.log("SERVER ON! PORT: " + PORT)
})
