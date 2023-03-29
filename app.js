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

const nodemailer = require('nodemailer')

const flash = require("connect-flash")

const path = require('path')

const multer  = require('multer')
const { resolveSoa } = require('dns')

require('dotenv').config()

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
// mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbkeaad.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`).then(() => {
//     console.log("MongoDB connected...")
// }).catch((err) => {
//     console.log(`Erro: ${err}`)
// })


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
        const title = "Representante ou titular? - "
        res.render('aplicacao-step1', {title})
    }

    if(parseInt(req.query.etapa) === 1) {
        const etapa = parseInt(req.query.etapa) || 1
        const title = "Representante ou titular? - "
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
        const nonImmigrantVisa = data.nonImmigrantVisa
        if ((canadaVisa === "0" && nonImmigrantVisa === "1") || (canadaVisa === "1" && nonImmigrantVisa === "1")) {
            let dynamicData = `
                <label class="mb-2">Número do visto de não imigrante nos EUA <span class="text-red">* (obrigatório)</span></label>
                <input type="text" class="form-control mb-3 w-50" name="numVisaNonImmigrant" id="numVisaNonImmigrant" maxlength="35" required>

                <label class="mb-2" for="numVisaNonImmigrant">Data de expiração do visto americano de não-imigrante <span class="text-red">* (obrigatório)</span></label>
                <div class="row">
                    <div class="col">
                        <select class="form-select mb-3" name="dayVisaNonImmigrant" id="dayVisaNonImmigrant">
                            <option selected disabled="disabled">Selecione o dia</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                            <option value="11">11</option>
                            <option value="12">12</option>
                            <option value="13">13</option>
                            <option value="14">14</option>
                            <option value="15">15</option>
                            <option value="16">16</option>
                            <option value="17">17</option>
                            <option value="18">18</option>
                            <option value="19">19</option>
                            <option value="20">20</option>
                            <option value="21">21</option>
                            <option value="22">22</option>
                            <option value="23">23</option>
                            <option value="24">24</option>
                            <option value="25">25</option>
                            <option value="26">26</option>
                            <option value="27">27</option>
                            <option value="28">28</option>
                            <option value="29">29</option>
                            <option value="30">30</option>
                            <option value="31">31</option>
                        </select>
                    </div>
                    <div class="col">
                        <select class="form-select mb-3" name="monthVisaNonImmigrant" id="monthVisaNonImmigrant">
                            <option selected disabled="disabled">Selecione o mês</option>
                            <option value="1">Janeiro</option>
                            <option value="2">Fevereiro</option>
                            <option value="3">Março</option>
                            <option value="4">Abril</option>
                            <option value="5">Maio</option>
                            <option value="6">Junho</option>
                            <option value="7">Julho</option>
                            <option value="8">Agosto</option>
                            <option value="9">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                        </select>
                    </div>
                    <div class="col">
                        <select class="form-select mb-3" name="yearVisaNonImmigrant" id="yearVisaNonImmigrant">
                            <option selected disabled="disabled">Selecione o ano</option>
                            <option value="2023">2023</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2028">2028</option>
                            <option value="2029">2029</option>
                            <option value="2030">2030</option>
                            <option value="2031">2031</option>
                            <option value="2032">2032</option>
                            <option value="2033">2033</option>
                            <option value="2034">2034</option>
                            <option value="2035">2035</option>
                            <option value="2036">2036</option>
                            <option value="2037">2037</option>
                            <option value="2038">2038</option>
                            <option value="2039">2039</option>
                            <option value="2040">2040</option>
                            <option value="2041">2041</option>
                            <option value="2042">2042</option>
                            <option value="2043">2043</option>
                            <option value="2044">2044</option>
                            <option value="2045">2045</option>
                            <option value="2046">2046</option>
                            <option value="2047">2047</option>
                            <option value="2048">2048</option>
                            <option value="2049">2049</option>
                            <option value="2050">2050</option>
                            <option value="2051">2051</option>
                            <option value="2052">2052</option>
                            <option value="2053">2053</option>
                            <option value="2054">2054</option>
                            <option value="2055">2055</option>
                            <option value="2056">2056</option>
                            <option value="2057">2057</option>
                            <option value="2058">2058</option>
                            <option value="2059">2059</option>
                            <option value="2060">2060</option>
                            <option value="2061">2061</option>
                            <option value="2062">2062</option>
                            <option value="2063">2063</option>
                            <option value="2064">2064</option>
                            <option value="2065">2065</option>
                            <option value="2066">2066</option>
                        </select>
                    </div>
                </div>
            `
            res.render('aplicacao-step3', {title, dynamicData})
        }
    }

    if(parseInt(req.query.etapa) === 4) {
        const etapa = parseInt(req.query.etapa) || 4
        const title = "Pagamento - "
        res.render('aplicacao-step4', {title})
    }

})

app.post('/aplicacaoStep1', (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
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

app.post('/aplicacaoStep4', /*validarFormulario,*/ (req, res) => {
    req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
    res.send(req.session.aplicacaoStep)
    req.session.destroy()
})

app.listen(3000, ()=> {
    console.log("SERVER ON!")
})

