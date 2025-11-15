import { Router } from "express";
import bodyParser from "body-parser";
import { createCheckoutSession, createOrderId, handleStripeWebhook, verifyPayment } from "../controllers/payment.controller";

const router = Router();

router.post('/createCheckout', createCheckoutSession);

router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleStripeWebhook);

router.post('/createOrderId', createOrderId);

router.post('/verifyPayment', bodyParser.raw({ type: 'application/json' }), verifyPayment);

export default router;
