const express = require('express')
const app = express()
const session = require("express-session")

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
                    <a class="btn ${activeClass}" href="/admin/consult-processes?sort=${sort}&limit=${limit}&page=${i}">${i}</a>
                `;
            }

            return output;
        }
    }
})

const bodyParser = require('body-parser')

const mongoose = require('mongoose')

const Visa = require('./models/Visa')

const nodemailer = require('nodemailer')

const checkout = require('./routes/checkout')

const flash = require("connect-flash")

const path = require('path')

const dotenv = require('dotenv')
require('dotenv').config()

const mercadopago = require('./config/mercadoPago')
const { stringify } = require('querystring')
mercadopago.configure({
    access_token: 'TEST-7703581273948303-040210-09008d0ef878c5f0c346329e85b0ac55-718885874'
})


/*SETTINGS*/
app.use(express.static(path.join(__dirname, "public")))
app.use(session({
    secret: '123123123123123',
    resave: false,
    saveUninitialized: true
}))
app.use(flash())

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
//mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbkeaad.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority
//  mongoose.connect(`mongodb://127.0.0.1:27017/etacanadense`, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//  }).then(() => {
//      console.log("MONGODB CONNECTED")
//  }).catch((err) => {
//      console.log(`Erro: ${err}`)
//  })

//Mercaado Pago
    mercadopago.configure({
        access_token: 'TEST-7703581273948303-040210-09008d0ef878c5f0c346329e85b0ac55-718885874',
        sandbox: true,
    })


app.get('/', (req, res) => {
    const title = "Início - "
    res.render('index', {title})
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

app.get('/aplicacao', /*validarFormulario,*/ (req, res) => {
    if(!parseInt(req.query.etapa)) {
        const etapa = parseInt(req.query.etapa) || 1
        const title = "Representante - "
        res.render('aplicacao-step1', {title})
    }

    if(parseInt(req.query.etapa) === 1) {
        const etapa = parseInt(req.query.etapa) || 1
        const title = "Representante - "
        res.render('aplicacao-step1', {title})
    }

    if(parseInt(req.query.etapa) === 2) {
        const etapa = parseInt(req.query.etapa) || 2
        const title = "Validação - "
        res.render('aplicacao-step2', {title})
    }

    if(parseInt(req.query.etapa) === 3) {
        const etapa = parseInt(req.query.etapa) || 3
        const title = "Documentos - "
        const data = req.session.aplicacaoStep
        const canadaVisa = data.canadaVisa
        const nonImmigrateVisa = data.nonImmigrateVisa
        if ((canadaVisa === "0" && nonImmigrateVisa === "1") || (canadaVisa === "1" && nonImmigrateVisa === "1")) {
            let dynamicData = `
                <label class="mb-2">Número do visto de não imigrante nos EUA <span class="text-red">* (obrigatório)</span></label>
                <input type="text" class="form-control mb-3 w-50" name="numVisaNonImmigrate" id="numVisaNonImmigrate" maxlength="35" required>

                <label class="mb-2" for="dateVisaNonImmigrate">Data de expiração do visto americano de não-imigrante <span class="text-red">* (obrigatório)</span></label>
                <input type="date" class="form-control mb-3 w-25" name="dateVisaNonImmigrate" id="dateVisaNonImmigrate" onchange="validNotPresentDay(this)" required>   
            `
            res.render('aplicacao-step3', {title, dynamicData})
         } else {
            res.render('aplicacao-step3', {title})
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
    res.redirect('/aplicacao?etapa=2')
})

app.post('/aplicacaoStep2', /*validarFormulario,*/ (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    res.redirect('/aplicacao?etapa=3')
})

app.post('/aplicacaoStep3',  /*validarFormulario,*/ (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    res.redirect('/aplicacao?etapa=4')
})

app.post('/aplicacaoStep4',  /*validarFormulario,*/ (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    res.redirect('/checkout')
})

app.use('/checkout', checkout)

app.listen(3000, ()=> {
    console.log("SERVER ON!")
})
