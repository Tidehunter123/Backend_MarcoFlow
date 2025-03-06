import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync"; // Adjust the import path accordingly
import {
  creatingSubscriptionData,
  creatingStripePaymentIntent,
  savingSubsriptionByStripe,
  savingSubsriptionDataByStripe,
  savingSubsriptionDataByNowpayments,
  createPaymentLink,
  cancellingSubscriptionDataByStripe,
  checkingStatus,
  cancellingSubscriptionDataByPaypal,
  expiringSubscriptionDataByPaypal,
  expiringSubsriptionDataByStripe,
} from "../services/subscriptionService";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_API_KEY as string, {
  apiVersion: "2024-11-20.acacia",
});

const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET as string;

async function getCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    // Type guard to check if the customer is not a DeletedCustomer
    if (customer.deleted) {
      console.log("Customer is deleted.");
      return null;
    }

    // Access the email property safely
    return customer.email ?? null;
  } catch (error) {
    console.error("Failed to fetch customer email:", error);
    return null;
  }
}

export const createSubscriptionData = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const params = req.body;
      res.status(200).json("Event processed");
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error get tags data" });
    }
  }
);

export const createStripePaymentIntent = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const { payment_method_id, price } = req.body;
      const result = await creatingStripePaymentIntent(
        payment_method_id,
        price
      );
      res.status(200).json(result);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Error create stripe payment intent data" });
    }
  }
);

export const saveSubsriptionByStripe = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const params = req.body;
      const result = await savingSubsriptionByStripe(params);
      res.status(200).json(result);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Error create stripe payment intent data" });
    }
  }
);

export const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const { email, priceId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: priceId, // Replace with your price ID
            quantity: 1,
          },
        ],
        customer_email: email, // Optionally pre-fill email field
        success_url: `${process.env.CLIENT_URL}/account?checkout=true`,
        cancel_url: `${process.env.CLIENT_URL}/account?checkout=false`,
      });

      res.status(200).json({ url: session.url });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Error create stripe payment intent data" });
    }
  }
);

export const fetchEvent = catchAsync(
  async (req: Request | any, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      console.log(req.rawBody, "req.rawbody");
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          sig,
          endpointSecret
        );
      } catch (err) {
        // Type assertion for err to an Error object
        if (err instanceof Error) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        } else {
          console.error(
            "Webhook signature verification failed with an unknown error:",
            err
          );
          return res.status(400).send("Webhook Error: Unknown error occurred.");
        }
      }

      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          // Save session data to your database
          console.log("Payment was successful:", session);
          //   await saveToDatabase(session); // Replace with your DB logic
          break;

        case "invoice.payment_succeeded":
          const invoice_succeeded = event.data.object as Stripe.Invoice;
          // Handle successful subscription payment
          console.log("Subscription payment succeeded:", invoice_succeeded);
          await savingSubsriptionDataByStripe(invoice_succeeded);
          break;

        case "invoice.payment_failed":
          const invoice_failed = event.data.object as Stripe.Invoice;
          // Handle successful subscription payment
          console.log("Subscription payment failed:", invoice_failed);
          await expiringSubsriptionDataByStripe(invoice_failed);
          break;

        case "customer.subscription.deleted":
          const subscription_1 = event.data.object;
          console.log(`Subscription canceled:${subscription_1}`);
          break;

        case "customer.subscription.updated":
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          let email;
          if (customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            email = await getCustomerEmail(customer.id);
            console.log("User email from subscription:", email);
          }
          console.log("Subscription updated:", event.data.object);
          const subscription_2 = event.data.object;
          if (subscription_2?.cancel_at_period_end) {
            await cancellingSubscriptionDataByStripe(subscription_2, email);
          }
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (Error) {
      console.log(Error);
    }
  }
);

export const createNowpaymentsPayment = catchAsync(
  async (req: Request | any, res: Response) => {
    const { price, currency, subscription_id, customer_email } = req.body;

    try {
      // Log the incoming request body to monitor the data sent from frontend
      console.log("Received payment request:", {
        price,
        currency,
        subscription_id,
        customer_email,
      });

      // Prepare payment data to send to NowPayments API
      const paymentData = {
        price_amount: price,
        price_currency: currency,
        pay_currency: currency,
        ipn_callback_url: `${process.env.CLIENT_URL_WEBHOOK}/subscription/nowpayments/updateStatus`, // Your IPN (Instant Payment Notification) URL
        order_id: "123", // Unique subscription ID for tracking
        customer_email: customer_email,
      };

      // Log the payment data you're sending to NowPayments API
      console.log("Sending payment data to NowPayments:", paymentData);

      // Send the payment data to NowPayments API
      const response = await axios.post(
        "https://api.nowpayments.io/v1/payment",
        paymentData,
        {
          headers: {
            "x-api-key": process.env.NOWPAYMENTS_API_KEY as string, // API key should be kept secret
          },
        }
      );

      // Log the response from NowPayments API
      console.log("NowPayments API response:", response.data);

      // If payment link creation is successful
      if (response.data.success) {
        const paymentLink = response.data.invoice_url; // The URL for the customer to complete the payment
        console.log("Payment link generated:", paymentLink);
        return res.json({ success: true, paymentLink });
      } else {
        console.log("Error from NowPayments:", response.data.error);
        return res
          .status(400)
          .json({ success: false, message: response.data.error });
      }
    } catch (error) {
      // Log any errors that occur during the process
      console.error("Error creating payment link:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

export const updateNowpaymentsResult = catchAsync(
  async (req: Request | any, res: Response) => {
    const { payment_status, order_id, amount_received, customer_email } =
      req.body;
    const params = req.body;
    try {
      // Log the incoming request body to monitor the data sent from frontend
      console.log("Received payment request:", {
        payment_status,
        order_id,
        amount_received,
        customer_email,
      });

      if (payment_status === "completed") {
        console.log(`Payment completed for order ID: ${order_id}`);
        await savingSubsriptionDataByNowpayments(params);
        return res.redirect(
          `${process.env.CLIENT_URL_WEBHOOK}/account?checkout=true`
        );
        // Update the subscription or order status to 'completed'
      } else {
        console.log(`Payment failed or pending for order ID: ${order_id}`);
        return res.redirect(
          `${process.env.CLIENT_URL_WEBHOOK}/account?checkout=false`
        );
        // Handle payment failure or pending status
      }

      // Respond with 200 to acknowledge receipt of the IPN
      res.status(200).send("OK");
    } catch (error) {
      // Log any errors that occur during the process
      console.error("Error creating payment link:", error);
      // return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

export const generatePaymentLink = catchAsync(
  async (req: Request | any, res: Response) => {
    try {
      const { userEmail, subscriptionAmount, currency, subscriptionId } =
        req.body;

      if (!userEmail || !subscriptionAmount || !currency || !subscriptionId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Call service to generate payment link
      const paymentLink = await createPaymentLink(
        userEmail,
        subscriptionAmount,
        currency,
        subscriptionId
      );

      if (paymentLink) {
        return res.status(200).json({ paymentUrl: paymentLink });
      } else {
        return res.status(500).json({ error: "Error generating payment link" });
      }
    } catch (error) {
      console.error("Error in payment controller:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export const checkStatus = catchAsync(
  async (req: Request | any, res: Response) => {
    try {
      const { email } = req.body;
      const result = await checkingStatus(email);
      return res.status(200).json({ result: result });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export const fetchEventPaypal = catchAsync(
  async (req: Request | any, res: Response) => {
    try {
      const event = req.body;

      // Acknowledge receipt of the webhook immediately
      res.status(200).send("Webhook received!");

      switch (event.event_type) {
        case "PAYMENT.SALE.COMPLETED": {
          const { resource } = event;
          const billingAgreementId = resource.billing_agreement_id;
          const amount = resource.amount.total;
          const currency = resource.amount.currency;
          const transactionId = resource.id;
          const paymentTime = resource.create_time;

          console.log(
            `Payment received for subscription ${billingAgreementId}: ${amount} ${currency}`
          );
          break;
        }

        case "BILLING.SUBSCRIPTION.ACTIVATED": {
          console.log("Subscription activated.");
          // TODO: Handle subscription activation
          const activatedResult = await creatingSubscriptionData(event);
          break;
        }

        case "BILLING.SUBSCRIPTION.CANCELLED": {
          console.log("Subscription cancelled.");
          // TODO: Handle subscription cancellation
          const cancelResult = await cancellingSubscriptionDataByPaypal(event);
          break;
        }

        case "BILLING.SUBSCRIPTION.EXPIRED": {
          console.log("Subscription expired.");
          // TODO: Handle subscription cancellation
          const expriedResult = await expiringSubscriptionDataByPaypal(event);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.event_type}`);
          break;
      }
    } catch (error) {
      console.error("Error processing PayPal webhook:", error);

      // Check if the error is an instance of Error
      if (error instanceof Error) {
        return res
          .status(400)
          .json({ error: `Webhook Error: ${error.message}` });
      } else {
        return res
          .status(400)
          .json({ error: "Webhook Error: Unknown error occurred." });
      }
    }
  }
);

module.exports = {
  createSubscriptionData,
  createStripePaymentIntent,
  saveSubsriptionByStripe,
  createCheckoutSession,
  fetchEvent,
  createNowpaymentsPayment,
  updateNowpaymentsResult,
  generatePaymentLink,
  checkStatus,
  fetchEventPaypal,
};
