import { Request, Response } from "express";
import Stripe from 'stripe'
import db from "../db/db_connect";
import { orderItems, orders, users, videoAnalytics } from "../models";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia'
});

const SUCCESS_URL = `${process.env.NEXT_BASE_URL!}/profile`
const CANCEL_URL = `${process.env.NEXT_BASE_URL!}/buy-course`

const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { /* The above code appears to be a comment section in a TypeScript file. It includes the
        variable `courseName` and a multi-line comment delimiter ` */
            courseName, metadata, amount } = req.body;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'cashapp'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: courseName,
                            metadata: metadata,
                        },
                        unit_amount: amount, // price in cents
                    },
                    quantity: 1
                },
            ],
            mode: 'payment',
            invoice_creation: {
                enabled: true,
            },
            success_url: SUCCESS_URL,
            cancel_url: CANCEL_URL,
            metadata: metadata,
        })
        res.status(200).json({ url: session.url })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

const handleStripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"]!;
    const stripePayload = (req as any).rawBody || req.body;
    try {
        const event = stripe.webhooks.constructEvent(
            stripePayload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
        const eventTimestamp = new Date(event.created * 1000);
        console.log(`Event received at: ${eventTimestamp.toLocaleDateString()} ${eventTimestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })}`);

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as Stripe.Checkout.Session;

                // const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

                // const paymentDetails = {
                //     customerDetails: session.customer_details,
                //     totalAmount: session.amount_total,
                //     metadata: session.metadata,
                //     paymentIntent: session.payment_intent,
                //     products: lineItems.data.map((item) => ({
                //         name: item.description,
                //         quantity: item.quantity,
                //         price: item.amount_total,
                //     })),
                // }
                const totalAmount = session.amount_total! / 100;
                const metadata = session.metadata;
                let itemName;
                if(!metadata) {
                    throw new Error('Metadata is required')
                }
                if(metadata.plan === 'Full Course'){
                    itemName = metadata.course;
                }else{
                    itemName = metadata.plan;
                }
                //find userId from emailId that is present in metadata
                const emailId = metadata.email;
                if(!emailId) {
                    throw new Error('Email is required')
                }
                const user = await db
                .select()
                .from(users)
                .where(eq(users.email, emailId))
                .limit(1);

                const userId = user[0].userId;
                const paymentIntent = session.payment_intent as string;
                
                 // Insert order into the database
                const [order] = await db.insert(orders).values({
                    userId,
                    orderDate: new Date(),
                    totalAmount: totalAmount.toFixed(2),
                    paymentStatus: 'succeeded',
                    paymentIntent,
                }).returning();

                // Insert each product into the `orderItems` table
               
                const orderItem = await db.insert(orderItems).values({
                    orderId: order.orderId,
                    itemType: metadata.type, 
                    // itemId: parseInt(metadata.moduleId, 10), 
                    itemName: itemName,
                    });
                

                console.log('Order created successfully:', order);
                console.log('Order Item created successfully:', orderItem);
                break;

            case "charge.failed":
                const charge = event.data.object as Stripe.Charge;
                
                 // Insert failed payment into the database
                await db.insert(orders).values({
                    userId: parseInt(charge.metadata.userId, 10), // 
                    orderDate: new Date(),
                    totalAmount: charge.amount.toFixed(2), 
                    paymentStatus: 'failed',
                    paymentIntent: charge.payment_intent as string,
                });

                console.log("Charge Failed:", event.data.object);
                break;
            
            case "charge.succeeded":
                console.log("Charge Succeeded:", event.data.object);
                break;
        
            default:
                console.log("Unhandled event type:", event.type);
                break;
        }

        console.log("Webhook event received:", event);
        res.status(200).json({ received: true });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Internal server error' })
        
    }
}


export { createCheckoutSession, handleStripeWebhook }
