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

router.get('/card', (req, res) => {
  const title = 'Checkout - '
  const data = req.session.aplicacaoStep
  res.render('checkout/card', {title, mercadoPagoAccessToken, data})
})

router.get('/pix', (req, res) => {
  const title = 'Checkout - '
  res.render('checkout/pix', {title, mercadoPagoAccessToken})
})

router.post('/process_payment_card', (req, res) => {
  const { body } = req
  const { payer } = body
  console.log(body)
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

    res.json({
      detail,
      status,
      id
    })

    //Visa.findOne({ codeETA: body.codeETA }).then((visa) => {
      //visa.statusPayment = data.status
      //visa.detailPayment = data.status_detail
      //visa.idPayment = data.id

      //console.log(visa)

      //visa.save().then(() => {
        // if (data.status === 'approved') {
        //   res.render('checkout/result-payment', {detail, status, id, title: 'Aprovado - '})
  
        // } else if (data.status === 'in_process') {
        //   res.render('checkout/result-payment', {detail, status, id, title: 'Em análise - '})
  
        // } else {
        //   res.render('checkout/result-payment', {detail, status, id, title: 'Negado - '})
  
        // }
      //})
    /*}).catch((err) => {
      req.flash('error_msg', 'Houve um erro grave. Entre em contato com o Suporte. Erro: ' + err)
      req.session.destroy()
      res.redirect('/aplicacao')
    })*/
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

router.post("/process_payment_pix", (req, res) => {
  const requestBody = req.body
  const data = {
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
    transaction_amount: 99.00,
    payer: {
      email: requestBody.payer.email,
      first_name: requestBody.payer.firstName,
      last_name: requestBody.payer.lastName,
      identification: {
        type: requestBody.payer.identification.type,
        number: requestBody.payer.identification.number,
      }
    }
  }

  mercadopago.payment.create(data).then(function(data) {
    const { response } = data

    res.status(201).json({
      id: response.id,
      status: response.status,
      detail: response.status_detail,
      qrCode: response.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64,
    })
  }).catch(function(error) {
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
