const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")
const mercadopago = require('mercadopago')
const dotenv = require('dotenv')
dotenv.config()


const mercadoPagoPublicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY;
if (!mercadoPagoPublicKey) {
  console.log("Error: public key not defined");
  process.exit(1);
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN;
if (!mercadoPagoAccessToken) {
  console.log("Error: access token not defined")
  process.exit(1)
}

mercadopago.configurations.setAccessToken(mercadoPagoAccessToken)

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN,
  sandbox: true
})

router.get('/', (req, res) => {
  const title = 'Checkout - '
  res.status(200).render('checkout/index', {title, mercadoPagoAccessToken})
})

router.post('/process_payment', (req, res) => {
  const { body } = req
  const { payer } = body
  const paymentData = {
    transaction_amount: 99.00,
    token: body.token,
    description: 'Solicitação de Autorização de Viagem - Canadá',
    installments: Number(body.installments),
    payment_method_id: body.paymentMethodId,
    issuer_id: body.issuerId,
    payer: {
      email: payer.email,
      identification: {
        type: payer.identification.docType,
        number: payer.identification.docNumber
      }
    }
  }

  mercadopago.payment.save(paymentData).then((response) => {
    const { response: data } = response
    const detail = data.status_detail
    const status = data.status
    const id = data.id

    Visa.findOne({ numPassport: req.session.aplicacaoStep.numPassport }).then((visa) => {
      visa.detailPayment = detail
      visa.statusPayment = status
      visa.idPayment = id

      res.status(201).json({
        detail,
        status,
        id
      })
    }).catch((err) => {
      req.flash('error_msg', 'Houve um erro grave. Entre em contato com o Suporte. Erro: ' + err)
      req.session.destroy()
      res.redirect('/aplicacao?etapa=1')
    })
  }).catch((error) => {
    console.log(error)
    const { errorMessage, errorStatus }  = validateError(error)
    res.status(errorStatus).json({ error_message: errorMessage })

  })

  function validateError(error) {
    let errorMessage = 'Unknown error cause'
    let errorStatus = 400
  
    if(error.cause) {
      const sdkErrorMessage = error.cause[0].description
      errorMessage = sdkErrorMessage || errorMessage
  
      const sdkErrorStatus = error.status
      errorStatus = sdkErrorStatus || errorStatus
    }
  
    return { errorMessage, errorStatus }
  }
})

router.get('/result-payment', (req, res) => {
  res.render('checkout/result-payment')
})

module.exports = router
