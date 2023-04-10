const express = require('express')
const router = express.Router()
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
    res.status(201).json({
      detail: data.status_detail,
      status: data.status,
      id: data.id
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

module.exports = router
