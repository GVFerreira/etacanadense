const mercadopago = require('mercadopago')

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN
})

module.exports = mercadopago