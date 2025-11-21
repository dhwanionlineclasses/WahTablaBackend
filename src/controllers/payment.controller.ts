import { Request, Response } from "express";
import Stripe from 'stripe'
import db from "../db/db_connect";
import { orderItems, orders, users, videoAnalytics } from "../models";
import { eq } from "drizzle-orm";
import { resend } from "../lib/resend";
import Razorpay from "razorpay";
import crypto from "crypto";
import { char } from "drizzle-orm/mysql-core";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const SUCCESS_URL = `${process.env.NEXT_BASE_URL!}/profile`
const CANCEL_URL = `${process.env.NEXT_BASE_URL!}/buy-course`

const getUSDtoINR = async () => {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  const data = await res.json();
  return data.rates.INR;
};

const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { /* The above code appears to be a comment section in a TypeScript file. It includes the
        variable `courseName` and a multi-line comment delimiter ` */
      courseName, metadata, amount } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
  const exchangeRate = await getUSDtoINR();
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const totalAmount = session.amount_total! / 100;
        const metadata = session.metadata;

        if (!metadata) throw new Error('Metadata is required');

        const emailId = metadata.email;
        if (!emailId) throw new Error('Email is required');

        const itemName = metadata.plan === 'Full Course' ? metadata.course : metadata.plan;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, emailId))
          .limit(1);

        if (!user.length) throw new Error('User not found');

        const userId = user[0].userId;
        const username = user[0].username;

        const paymentIntent = session.payment_intent as string;

        // Insert order into the database
        const [order] = await db.insert(orders).values({
          userId,
          orderDate: new Date(),
          totalAmount: totalAmount.toFixed(2),
          paymentStatus: 'succeeded',
          paymentIntent,
        }).returning();

        // Insert order item
        const orderItem = await db.insert(orderItems).values({
          orderId: order.orderId,
          itemType: metadata.type,
          itemName: itemName,
        });

        await db.update(users).set({ purchasePlan: metadata.type }).where(eq(users.userId, userId));

        console.log('✅ Order created successfully:', order);
        console.log('✅ Order Item created successfully:', orderItem);

        const { data, error } = await resend.emails.send({
          from: 'hello@wahtabla.com', // your verified sender domain
          to: emailId,
          subject: `🎶 Payment Successful — Your ${itemName} is Ready!`,
          html: `
      <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240,10%,3.9%); padding: 30px; color: hsl(0,0%,98%);">
        <div style="max-width: 600px; margin:auto; background: hsl(240,10%,3.9%); border-radius: 12px; border: 1px solid hsl(0,0%,20%); overflow: hidden;">

          <div style="background: linear-gradient(90deg, #ff8800, #ff4b2b); padding: 25px; text-align: center; color: white;">
            <h2 style="margin: 0;">Payment Successful ✅</h2>
          </div>

          <div style="padding: 25px; line-height: 1.6;">
            <p style="font-size: 16px;">Namaste ${username || 'Learner'} 🙏,</p>
            <p style="font-size: 16px;">
              Thank you for your purchase at <strong>Wah Tabla</strong>!  
              Your transaction has been successfully processed.
            </p>

            <table style="width: 100%; margin-top: 20px; border-collapse: collapse; font-size: 15px; color: hsl(0,0%,90%);">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Course / Plan:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${itemName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Amount Paid:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">₹${(totalAmount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Payment ID:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${paymentIntent}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Date:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${new Date().toLocaleString('en-IN')}</td>
              </tr>
            </table>

            <p style="margin-top: 25px; font-size: 16px;">
              You can now access your course or plan directly from your dashboard.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://wahtabla.com/dashboard" 
                style="background: #ff4b2b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Go to Dashboard →
              </a>
            </div>
          </div>

          <div style="border-top: 1px solid hsl(0,0%,15%); background: hsl(240,10%,5%); padding: 15px; text-align: center; font-size: 13px; color: hsl(0,0%,70%);">
            © ${new Date().getFullYear()} Wah Tabla — Thank you for learning with us.<br/>
            <a href="https://wahtabla.com" style="color: #ff8800; text-decoration: none;">Visit WahTabla.com</a>
          </div>

        </div>
      </div>
    `
        });

        if (error) {
          console.error('Error sending email:', error);
        } else {
          console.log('📧 Confirmation email sent successfully to:', emailId);
        }

        break;
      }

      case "charge.failed":
        const charge = event.data.object as Stripe.Charge;


        // Insert failed payment into the database
        await db.insert(orders).values({
          userId: parseInt(charge.metadata.userId, 10), // 
          orderDate: new Date(),
          totalAmount: (charge.amount / 100).toFixed(2),
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

const createOrderId = async (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.body;
    const order = await razorpay.orders.create({
      amount: amount,
      currency
    });
    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyPayment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderCreationId, razorpayPaymentId, razorpaySignature, metadata } =
      req.body;


    const sign = `${orderCreationId}|${razorpayPaymentId}`;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(sign)
      .digest("hex");

    if (razorpaySignature && orderCreationId && razorpayPaymentId && expectedSign === razorpaySignature) {
      if (!metadata) throw new Error('Metadata is required');

      const emailId = metadata.email;
      if (!emailId) throw new Error('Email is required');

      const itemName = metadata.plan === 'Full Course' ? metadata.course : metadata.plan;

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, emailId))
        .limit(1);

      if (!user.length) throw new Error('User not found');

      const userId = user[0].userId;
      const username = user[0].username;

      const paymentIntent = "Razorpay Payment ID: " + razorpayPaymentId;

      // Insert order into the database
      const [order] = await db.insert(orders).values({
        userId,
        orderDate: new Date(),
        totalAmount: (metadata.amount / 100).toFixed(2),
        paymentStatus: 'succeeded',
        paymentIntent,
        currency: 'INR',
      }).returning();

      // Insert order item
      const orderItem = await db.insert(orderItems).values({
        orderId: order.orderId,
        itemType: metadata.type,
        itemName: itemName,
      });

      await db.update(users).set({ purchasePlan: metadata.type }).where(eq(users.userId, userId));

      const { data, error } = await resend.emails.send({
        from: 'hello@wahtabla.com', // your verified sender domain
        to: emailId,
        subject: `🎶 Payment Successful — Your ${itemName} is Ready!`,
        html: `
      <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240,10%,3.9%); padding: 30px; color: hsl(0,0%,98%);">
        <div style="max-width: 600px; margin:auto; background: hsl(240,10%,3.9%); border-radius: 12px; border: 1px solid hsl(0,0%,20%); overflow: hidden;">

          <div style="background: linear-gradient(90deg, #ff8800, #ff4b2b); padding: 25px; text-align: center; color: white;">
            <h2 style="margin: 0;">Payment Successful ✅</h2>
          </div>

          <div style="padding: 25px; line-height: 1.6;">
            <p style="font-size: 16px;">Namaste ${username || 'Learner'} 🙏,</p>
            <p style="font-size: 16px;">
              Thank you for your purchase at <strong>Wah Tabla</strong>!  
              Your transaction has been successfully processed.
            </p>

            <table style="width: 100%; margin-top: 20px; border-collapse: collapse; font-size: 15px; color: hsl(0,0%,90%);">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Course / Plan:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${itemName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Amount Paid:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">₹${(metadata.amount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Payment ID:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${paymentIntent}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);"><strong>Date:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid hsl(0,0%,25%);">${new Date().toLocaleString('en-IN')}</td>
              </tr>
            </table>

            <p style="margin-top: 25px; font-size: 16px;">
              You can now access your course or plan directly from your dashboard.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://wahtabla.com/profile" 
                style="background: #ff4b2b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Go to Dashboard →
              </a>
            </div>
          </div>

          <div style="border-top: 1px solid hsl(0,0%,15%); background: hsl(240,10%,5%); padding: 15px; text-align: center; font-size: 13px; color: hsl(0,0%,70%);">
            © ${new Date().getFullYear()} Wah Tabla — Thank you for learning with us.<br/>
            <a href="https://wahtabla.com" style="color: #ff8800; text-decoration: none;">Visit WahTabla.com</a>
          </div>

        </div>
      </div>
    `
      });

      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('📧 Confirmation email sent successfully to:', emailId);
      }

      return res.json({ success: true, message: "Payment verified successfully" });
    } else {
      return res.json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export { createCheckoutSession, handleStripeWebhook, createOrderId, verifyPayment };  