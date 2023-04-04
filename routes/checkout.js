const express = require('express')
const router = express.Router()
const mercadopago = require('mercadopago')
const dotenv = require('dotenv')

dotenv.config()

mercadopago.configure({
  access_token: 'TEST-7703581273948303-040210-09008d0ef878c5f0c346329e85b0ac55-718885874'
})

router.get('/', (req, res) => {
    const dateForm = req.session.aplicacaoStep
    res.render('checkout/index', {dateForm})
})

router.post('/create_payment', async (req, res) => {
  const { title, price, quantity } = req.body
  const preference = {
    items: [
      {
        title,
        unit_price: parseFloat(price),
        quantity
      }
    ],
    back_urls: {
      success: 'http://localhost:3000/checkout/success',
      pending: 'http://localhost:3000/checkout/pending',
      failure: 'http://localhost:3000/checkout/failure'
    },
    auto_return: 'approved',
    payment_methods: {
      excluded_payment_types: [
        { id: 'ticket' },
        { id: 'atm' }
      ]
    },
    notification_url: 'http://localhost:3000/checkout/notification'
  }

  try {
    const response = await mercadopago.preferences.create(preference)
    const { init_point } = response.body
    res.redirect(init_point)
  } catch (error) {
    console.log(error)
    res.redirect('/checkout')
  }
})

router.get('/success', (req, res) => {
  res.render('checkout/success')
})

router.get('/pending', (req, res) => {
  res.render('checkout/pending')
})

router.get('/failure', (req, res) => {
  res.render('checkout/failure')
})

router.post('/notification', (req, res) => {
  console.log(req.body)
  res.status(200).send('OK')
})

module.exports = router
