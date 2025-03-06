import express from "express"
import bodyParser from 'body-parser';

import  {createSubscriptionData, createStripePaymentIntent, saveSubsriptionByStripe, createCheckoutSession, fetchEvent, createNowpaymentsPayment, updateNowpaymentsResult, generatePaymentLink, checkStatus, fetchEventPaypal}  from "../controllers/subscriptionController"

const router = express.Router();

router.post('/create', createSubscriptionData)
router.post('/stripe/create-payment-intent', createStripePaymentIntent)
router.post('/stripe/save', saveSubsriptionByStripe)
router.post('/stripe/create-checkout-session',createCheckoutSession)
router.post('/stripe/webhook', fetchEvent)
router.post('/paypal/webhook', fetchEventPaypal)

router.post('/nowpayments/create-payment', createNowpaymentsPayment)
router.post('/nowpayments/updateStatus', updateNowpaymentsResult)
router.post('/nowpayments/payment-notification')
router.post('/nowpayments/generate-payment-link', generatePaymentLink)
router.post('/checkStatus', checkStatus)

export default router