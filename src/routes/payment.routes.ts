import { Router } from "express";
import bodyParser from "body-parser";
import { createCheckoutSession, handleStripeWebhook } from "../controllers/payment.controller";

const router = Router();

router.post('/createCheckout', createCheckoutSession);

router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleStripeWebhook);



export default router;
