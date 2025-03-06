import axios from "axios";
import { supabase } from "../config/superbaseConfig";
import moment from "moment";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_API_KEY as string, {
  apiVersion: "2024-11-20.acacia",
});

interface SubscriptionPlan {
  Type: string;
  Months: number;
  Price: number;
  TotalPrice: number;
  OrderId: string;
  PaypalPlanId: string;
}

const subscriptionPlan: SubscriptionPlan[] = [
  {
    Type: "Premium",
    Months: 1,
    Price: 9.99,
    TotalPrice: 999,
    OrderId: "Premium_1",
    PaypalPlanId: "P-31U24557YL656873KM5PMR5Y",
  },
  {
    Type: "Premium",
    Months: 3,
    Price: 7.99,
    TotalPrice: 2397,
    OrderId: "Premium_2",
    PaypalPlanId: "P-3NU73511FF987244KM5PMYUA",
  },
  {
    Type: "Premium",
    Months: 12,
    Price: 5.99,
    TotalPrice: 7188,
    OrderId: "Premium_3",
    PaypalPlanId: "P-9R858333W0070884AM5PMZGY",
  },
  {
    Type: "Deluxe",
    Months: 1,
    Price: 29.99,
    TotalPrice: 2999,
    OrderId: "Deluxe_1",
    PaypalPlanId: "P-2DW03121K6237493RM5PMZYA",
  },
  {
    Type: "Deluxe",
    Months: 3,
    Price: 23.99,
    TotalPrice: 7197,
    OrderId: "Deluxe_2",
    PaypalPlanId: "P-7MJ26483KB159394TM5PM2PI",
  },
  {
    Type: "Deluxe",
    Months: 12,
    Price: 17.99,
    TotalPrice: 21588,
    OrderId: "Deluxe_3",
    PaypalPlanId: "P-83P64670461239417M5PM26Y",
  },
];

export const creatingSubscriptionData = async (event: any) => {
  console.log("Starting creatingSubscriptionData function with params:", event);

  let is_deplicated_customer_query = supabase
    .from("customers")
    .select("*")
    .eq("user_email", event.resource.subscriber.email_address)
    .single();

  const { data, error } = await is_deplicated_customer_query;
  console.log("Checking if customer exists:", data, error);

  if (data === null) {
    console.log("Customer not found. Creating a new customer.");
    let customers_query = supabase
      .from("customers")
      .insert({
        user_email: event.resource.subscriber.email_address,
        paypal_customer_id: event.resource.subscriber.payer_id,
      })
      .select()
      .single();

    const { data: customerData, error: customerError } = await customers_query;
    console.log("Customer creation result:", customerData, customerError);

    if (customerError) {
      throw new Error(`Error fetching customer data: ${customerError.message}`);
    }
  }

  console.log("Checking if user profile exists.");
  let user_query = supabase
    .from("user_profiles")
    .select("*")
    .eq("user_email", event.resource.subscriber.email_address)
    .single();

  const { data: userData, error: userError } = await user_query;
  console.log("User profile fetch result:", userData, userError);

  if (userError) {
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  console.log("Checking if subscription exists.");
  let is_deplicated_subscription_query = supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userData.id)
    .single();

  const { data: SubscriptonData, error: SubscriptonError } =
    await is_deplicated_subscription_query;
  console.log("Subscription fetch result:", SubscriptonData, SubscriptonError);

  let fullScbscriptionData;
  let userType = 1;
  console.log("Determining user type based on plan_id.");

  if (
    event.resource.plan_id === "P-31U24557YL656873KM5PMR5Y" ||
    event.resource.plan_id === "P-3NU73511FF987244KM5PMYUA" ||
    event.resource.plan_id === "P-9R858333W0070884AM5PMZGY"
  ) {
    userType = 2;
  }

  if (
    event.resource.plan_id === "P-2DW03121K6237493RM5PMZYA" ||
    event.resource.plan_id === "P-7MJ26483KB159394TM5PM2PI" ||
    event.resource.plan_id === "P-83P64670461239417M5PM26Y"
  ) {
    userType = 3;
  }

  const selectedSubscription = subscriptionPlan.find(
    (plan) => plan.PaypalPlanId === event.resource.plan_id
  );
  console.log("Selected subscription:", selectedSubscription);

  if (SubscriptonData === null) {
    console.log("No existing subscription. Creating a new subscription.");
    let create_subscription_query = supabase.from("subscriptions").insert({
      user_id: userData.id,
      status: event.resource.status,
      price_id: event.resource.id,
      quantity: event.resource.quantity,
      cancel_at_period_end: false,
      created: event.resource.create_time,
      current_period_start: event.resource.start_time,
      current_period_end: event.resource.billing_info.next_billing_time,
      current_plan: selectedSubscription?.OrderId,
      current_method: "paypal",
    });

    const { data: subscriptionData, error: subscriptionError } =
      await create_subscription_query;
    console.log(
      "Subscription creation result:",
      subscriptionData,
      subscriptionError
    );

    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;

      console.log("Updating user profile for subscription.");
      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: event.resource.start_time,
          paid_api_usage_count: 0,
          user_type: userType,
        })
        .eq("user_email", event.resource.subscriber.email_address)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      console.log(
        "User profile update result:",
        updateUserData,
        updateUserError
      );

      if (updateUserError) {
        throw new Error(`Error updating user data: ${updateUserError.message}`);
      }

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userData.id);
      console.log(chatData, "chatData");
      if (chatError) {
        console.log(chatError, "chat_error");
        throw new Error(`Failed to reset free API usage: ${chatError.message}`);
      }

      deleteBotMessages(chatData);
    }
  } else {
    console.log(
      "Step 5: Subscription already exists, updating subscription..."
    );
    let updateCurrentPeriodStart;
    let updateCurrentPeriodEnd;
    const period = selectedSubscription?.Months;

    if (SubscriptonData.current_period_end) {
      if (moment().isAfter(moment(SubscriptonData.current_period_end))) {
        updateCurrentPeriodStart = moment();
        updateCurrentPeriodEnd = moment().add(
          selectedSubscription?.Months,
          "months"
        );
        let update_subscription_query = supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            price_id: event.resource.id,
            quantity: 1,
            ended_at: null,
            cancel_at_period_end: false,
            created: moment(),
            current_period_start: moment(),
            current_period_end: moment().add(
              selectedSubscription?.Months,
              "months"
            ),
            current_plan: selectedSubscription?.OrderId,
            current_method: "paypal",
          })
          .eq("user_id", userData.id)
          .single();

        const { data: subscriptionData, error: subscriptionError } =
          await update_subscription_query;
        console.log("Updated Subscription Data:", subscriptionData);
        if (subscriptionError) {
          throw new Error(
            `Error fetching subscription data: ${subscriptionError.message}`
          );
        } else {
          fullScbscriptionData = subscriptionData;
          console.log("Step 6: Updating user data...");
          let update_useData_query = supabase
            .from("user_profiles")
            .update({
              paid_api_usage_updatedAt: moment(),
              paid_api_usage_count: 0,
              user_type: userType,
            })
            .eq("user_email", event.resource.subscriber.email_address)
            .select();

          const { data: updateUserData, error: updateUserError } =
            await update_useData_query;
          console.log("Updated User Data:", updateUserData);
          if (updateUserError) {
            throw new Error(
              `Error update user data: ${updateUserError.message}`
            );
          }

          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("user_id", userData.id);
          console.log(chatData, "chatData");
          if (chatError) {
            console.log(chatError, "chat_error");
            throw new Error(
              `Failed to reset free API usage: ${chatError.message}`
            );
          }

          deleteBotMessages(chatData);
        }
      } else {
        updateCurrentPeriodStart = SubscriptonData.current_period_start;
        updateCurrentPeriodEnd = moment(SubscriptonData.current_period_end)
          .add(period, "months")
          .toDate();
        if (SubscriptonData.cancel_at_period_end == true) {
          let update_subscription_query = supabase
            .from("subscriptions")
            .update({
              is_reserved: true,
              reserved_period_end: updateCurrentPeriodEnd,
              reserved_plan: selectedSubscription?.OrderId,
              reserved_method: "paypal",
              reserved_customer_id: event.resource.subscriber.payer_id,
            })
            .eq("user_id", userData.id)
            .single();

          const { data: subscriptionData, error: subscriptionError } =
            await update_subscription_query;
          console.log("Updated Subscription Data:", subscriptionData);
          if (subscriptionError) {
            throw new Error(
              `Error fetching subscription data: ${subscriptionError.message}`
            );
          } else {
            fullScbscriptionData = subscriptionData;
            console.log("Step 6: Updating user data...");
            let update_useData_query = supabase
              .from("user_profiles")
              .update({
                reserved_user_type: userType,
              })
              .eq("user_email", event.resource.subscriber.email_address)
              .select();

            const { data: updateUserData, error: updateUserError } =
              await update_useData_query;
            console.log("Updated User Data:", updateUserData);
            if (updateUserError) {
              throw new Error(
                `Error update user data: ${updateUserError.message}`
              );
            }
          }
        }

        if (SubscriptonData.cancel_at_period_end == false) {
          let update_subscription_query = supabase
            .from("subscriptions")
            .update({
              current_period_start: moment(),
              current_period_end: moment().add(period, "months").toDate(),
            })
            .eq("user_id", userData.id)
            .single();

          const { data: subscriptionData, error: subscriptionError } =
            await update_subscription_query;
          console.log("Updated Subscription Data:", subscriptionData);
          if (subscriptionError) {
            throw new Error(
              `Error fetching subscription data: ${subscriptionError.message}`
            );
          } else {
            fullScbscriptionData = subscriptionData;
            console.log("Step 6: Updating user data...");
            let update_useData_query = supabase
              .from("user_profiles")
              .update({
                reserved_user_type: userType,
              })
              .eq("user_email", event.resource.subscriber.email_address)
              .select();

            const { data: updateUserData, error: updateUserError } =
              await update_useData_query;
            console.log("Updated User Data:", updateUserData);
            if (updateUserError) {
              throw new Error(
                `Error update user data: ${updateUserError.message}`
              );
            }
          }
        }
      }
    } else {
      if (userData.user_type == 1 && SubscriptonData.status == "INACTIVE") {
        updateCurrentPeriodStart = moment();
        updateCurrentPeriodEnd = moment().add(
          selectedSubscription?.Months,
          "months"
        );
        let update_subscription_query = supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            price_id: event.resource.id,
            quantity: 1,
            ended_at: null,
            cancel_at_period_end: false,
            created: moment(),
            current_period_start: moment(),
            current_period_end: moment().add(
              selectedSubscription?.Months,
              "months"
            ),
            current_plan: selectedSubscription?.OrderId,
            current_method: "paypal",
          })
          .eq("user_id", userData.id)
          .single();

        const { data: subscriptionData, error: subscriptionError } =
          await update_subscription_query;
        console.log("Updated Subscription Data:", subscriptionData);
        if (subscriptionError) {
          throw new Error(
            `Error fetching subscription data: ${subscriptionError.message}`
          );
        } else {
          fullScbscriptionData = subscriptionData;
          console.log("Step 6: Updating user data...");
          let update_useData_query = supabase
            .from("user_profiles")
            .update({
              paid_api_usage_updatedAt: moment(),
              paid_api_usage_count: 0,
              user_type: userType,
            })
            .eq("user_email", event.resource.subscriber.email_address)
            .select();

          const { data: updateUserData, error: updateUserError } =
            await update_useData_query;
          console.log("Updated User Data:", updateUserData);
          if (updateUserError) {
            throw new Error(
              `Error update user data: ${updateUserError.message}`
            );
          }

          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("user_id", userData.id);
          console.log(chatData, "chatData");
          if (chatError) {
            console.log(chatError, "chat_error");
            throw new Error(
              `Failed to reset free API usage: ${chatError.message}`
            );
          }

          deleteBotMessages(chatData);
        }
      }
    }
  }

  console.log("Returning full subscription data.");
  return fullScbscriptionData;
};

export const creatingStripePaymentIntent = async (
  payment_method_id: any,
  price: number
) => {
  try {
    const selectedSubscription = subscriptionPlan.find(
      (plan) => plan.Price === price
    );
    if (selectedSubscription) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * selectedSubscription?.Months * 100, // Amount in cents (e.g., 1000 cents = $10)
        currency: "usd",
        payment_method: payment_method_id,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never", // Disable redirect-based payment methods
        },
      });

      return { client_secret: paymentIntent.client_secret };
    } else return;
  } catch (err: any) {
    throw new Error(err.message);
  }
};

export const savingSubsriptionByStripe = async (params: any) => {
  let is_deplicated_customer_query = supabase
    .from("customers")
    .select("*")
    .eq("user_email", params.user_email)
    .single();

  const { data, error } = await is_deplicated_customer_query;

  if (data === null) {
    let customers_query = supabase
      .from("customers")
      .insert({
        user_email: params.user_email,
        stripe_customer_id: params.paymentIntent.client_secret,
      })
      .select()
      .single();

    const { data: customerData, error: customerError } = await customers_query;

    if (customerError) {
      throw new Error(`Error fetching customer data: ${customerError.message}`);
    }
  }

  let user_query = supabase
    .from("user_profiles")
    .select("*")
    .eq("user_email", params.user_email)
    .single();

  const { data: userData, error: userError } = await user_query;

  if (userError) {
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  let is_deplicated_subscription_query = supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userData.id)
    .single();

  const { data: SubscriptonData, error: SubscriptonError } =
    await is_deplicated_subscription_query;

  let fullScbscriptionData;
  const selectedSubscription = subscriptionPlan.find(
    (plan) => plan.TotalPrice === params.paymentIntent.amount
  );
  if (SubscriptonData === null) {
    let create_subscription_query = supabase.from("subscriptions").insert({
      user_id: userData.id,
      status: params.paymentIntent.status,
      price_id: params.paymentIntent.id,
      quantity: 1,
      cancel_at_period_end: false,
      created: moment(),
      current_period_start: moment(),
      current_period_end: moment().add(selectedSubscription?.Months, "months"),
    });
    const { data: subscriptionData, error: subscriptionError } =
      await create_subscription_query;

    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;

      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: moment(),
          paid_api_usage_count: 0,
        })
        .eq("user_email", params.user_email)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      if (updateUserError) {
        throw new Error(`Error update user data: ${updateUserError.message}`);
      }
    }
  } else {
    let updateCurrentPeriodStart;
    let updateCurrentPeriodEnd;
    const period = selectedSubscription?.Months;
    if (moment().isAfter(moment(SubscriptonData.current_period_end))) {
      updateCurrentPeriodStart = moment();
      updateCurrentPeriodEnd = moment().add(
        selectedSubscription?.Months,
        "months"
      );
    } else {
      updateCurrentPeriodStart = SubscriptonData.current_period_start;
      updateCurrentPeriodEnd = moment(SubscriptonData.current_period_end)
        .add(period, "months")
        .toDate();
    }
    let update_subscription_query = supabase
      .from("subscriptions")
      .update({
        status: params.paymentIntent.status,
        price_id: params.paymentIntent.id,
        quantity: 1,
        cancel_at_period_end: false,
        created: moment(),
        current_period_start: updateCurrentPeriodStart,
        current_period_end: updateCurrentPeriodEnd,
      })
      .eq("user_id", userData.id)
      .single();
    const { data: subscriptionData, error: subscriptionError } =
      await update_subscription_query;

    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;
      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: moment(),
          paid_api_usage_count: 0,
        })
        .eq("user_email", params.user_email)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      if (updateUserError) {
        throw new Error(`Error update user data: ${updateUserError.message}`);
      }
    }
  }

  let userType = 1;
  if (selectedSubscription?.Type === "Premium") {
    userType = 2;
  }

  if (selectedSubscription?.Type === "Deluxe") {
    userType = 3;
  }
  let update_useType_query = supabase
    .from("user_profiles")
    .update({
      user_type: userType,
    })
    .eq("user_email", params.user_email)
    .select();

  const { data: updateUserData, error: updateUserError } =
    await update_useType_query;
  if (updateUserError) {
    throw new Error(`Error update user data: ${updateUserError.message}`);
  }

  return fullScbscriptionData;
};

export const expiringSubsriptionDataByStripe = async (params: any) => {
  try {
    console.log(params.customer_email, "params.customer_email");
    let fetch_customerInfo = supabase
      .from("user_profiles")
      .select("*")
      .eq("user_email", params.customer_email)
      .single();

    const { data: customerData, error: customerError } =
      await fetch_customerInfo;
    console.log(customerData, "customerData");
    if (customerError) {
      throw new Error(`Error update user data: ${customerError.message}`);
    }
    if (customerData) {
      let fetch_subscriptionInfo = supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", customerData.id)
        .single();

      const { data: subscriptionData, error: subscriptionError } =
        await fetch_subscriptionInfo;
      console.log(subscriptionData, "subscriptionData");
      if (subscriptionError) {
        throw new Error(`Error update user data: ${subscriptionError.message}`);
      }

      let update_subscription_cancelStatus = supabase
        .from("subscriptions")
        .update({
          status: "INACTIVE",
          price_id: null,
          quantity: null,
          cancel_at_period_end: false,
          created: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at: null,
          canceled_at: null,
          current_plan: null,
          current_method: null,
          ended_at: subscriptionData.current_period_end,
        })
        .eq("user_id", customerData.id)
        .select();

      const { data: updateSubscriptionData, error: updateSubscriptionError } =
        await update_subscription_cancelStatus;
      if (updateSubscriptionError) {
        throw new Error(
          `Error update subscription data expired status: ${updateSubscriptionError.message}`
        );
      }

      let update_user_profile = supabase
        .from("user_profiles")
        .update({
          user_type: 1,
          paid_api_usage_count: 0,
        })
        .eq("user_email", params.customer_email)
        .select();

      const { data: updatedUserData, error: updatedUserError } =
        await update_user_profile;
      if (updatedUserError) {
        console.error("Error updating user profile:", updatedUserError.message);
      } else {
        console.log("User profile updated successfully:", updatedUserData);
      }
    }
  } catch (error) {
    console.error("Eorror in expiring the current subscription");
  }
};

export const savingSubsriptionDataByStripe = async (params: any) => {
  // Step 1: Check for existing customer
  console.log("Step 1: Checking for existing customer...");
  let is_deplicated_customer_query = supabase
    .from("customers")
    .select("*")
    .eq("user_email", params.customer_email)
    .single();

  const { data, error } = await is_deplicated_customer_query;
  console.log("Customer Data:", data);
  console.log("Customer Error:", error);

  // Step 2: Update existing customer or insert new customer
  if (data !== null) {
    console.log("Step 2: Customer found, updating customer...");
    let customers_query = supabase
      .from("customers")
      .update({
        stripe_customer_id: params.customer,
      })
      .eq("user_email", params.customer_email)
      .select()
      .single();

    const { data: customerData, error: customerError } = await customers_query;
    console.log("Updated Customer Data:", customerData);
    if (customerError) {
      throw new Error(`Error fetching customer data: ${customerError.message}`);
    }
  } else {
    console.log("Step 2: Customer not found, creating new customer...");
    let customers_query = supabase
      .from("customers")
      .insert({
        user_email: params.customer_email,
        stripe_customer_id: params.customer,
      })
      .select()
      .single();

    const { data: customerData, error: customerError } = await customers_query;
    console.log("New Customer Data:", customerData);
    if (customerError) {
      throw new Error(`Error fetching customer data: ${customerError.message}`);
    }
  }

  // Step 3: Fetch user data
  console.log("Step 3: Fetching user data...");
  let user_query = supabase
    .from("user_profiles")
    .select("*")
    .eq("user_email", params.customer_email)
    .single();

  const { data: userData, error: userError } = await user_query;
  console.log("User Data:", userData);
  console.log("User Error:", userError);
  if (userError) {
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  // Step 4: Check for existing subscription
  console.log("Step 4: Checking for existing subscription...");
  let is_deplicated_subscription_query = supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userData.id)
    .single();

  const { data: SubscriptonData, error: SubscriptonError } =
    await is_deplicated_subscription_query;
  console.log("Subscription Data:", SubscriptonData);
  console.log("Subscription Error:", SubscriptonError);

  let fullScbscriptionData;
  const selectedSubscription = subscriptionPlan.find(
    (plan) => plan.TotalPrice === params.subtotal
  );
  console.log("Selected Subscription:", selectedSubscription);

  console.log("Step 7: Determining user type...");
  let userType = 1;
  if (selectedSubscription?.Type === "Premium") {
    userType = 2;
  }
  if (selectedSubscription?.Type === "Deluxe") {
    userType = 3;
  }

  if (SubscriptonData === null) {
    console.log(
      "Step 5: No existing subscription, creating new subscription..."
    );
    let create_subscription_query = supabase.from("subscriptions").insert({
      user_id: userData.id,
      status: "ACTIVE",
      price_id: params.id,
      ended_at: null,
      quantity: 1,
      cancel_at_period_end: false,
      created: moment(),
      current_period_start: moment(),
      current_period_end: moment().add(selectedSubscription?.Months, "months"),
      current_plan: selectedSubscription?.OrderId,
      current_method: "stripe",
    });

    const { data: subscriptionData, error: subscriptionError } =
      await create_subscription_query;
    console.log("New Subscription Data:", subscriptionData);
    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;
      console.log("Step 6: Updating user data...");
      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: moment(),
          paid_api_usage_count: 0,
          user_type: userType,
        })
        .eq("user_email", params.customer_email)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      console.log("Updated User Data:", updateUserData);
      if (updateUserError) {
        throw new Error(`Error update user data: ${updateUserError.message}`);
      }

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userData.id);
      console.log(chatData, "chatData");
      if (chatError) {
        console.log(chatError, "chat_error");
        throw new Error(`Failed to reset free API usage: ${chatError.message}`);
      }

      deleteBotMessages(chatData);
    }
  } else {
    console.log(
      "Step 5: Subscription already exists, updating subscription..."
    );
    let updateCurrentPeriodStart;
    let updateCurrentPeriodEnd;
    const period = selectedSubscription?.Months;

    if (SubscriptonData.current_period_end) {
      if (moment().isAfter(moment(SubscriptonData.current_period_end))) {
        updateCurrentPeriodStart = moment();
        updateCurrentPeriodEnd = moment().add(
          selectedSubscription?.Months,
          "months"
        );
        let update_subscription_query = supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            price_id: params.id,
            quantity: 1,
            ended_at: null,
            cancel_at_period_end: false,
            created: moment(),
            current_period_start: moment(),
            current_period_end: moment().add(
              selectedSubscription?.Months,
              "months"
            ),
            current_plan: selectedSubscription?.OrderId,
            current_method: "stripe",
          })
          .eq("user_id", userData.id)
          .single();

        const { data: subscriptionData, error: subscriptionError } =
          await update_subscription_query;
        console.log("Updated Subscription Data:", subscriptionData);
        if (subscriptionError) {
          throw new Error(
            `Error fetching subscription data: ${subscriptionError.message}`
          );
        } else {
          fullScbscriptionData = subscriptionData;
          console.log("Step 6: Updating user data...");
          let update_useData_query = supabase
            .from("user_profiles")
            .update({
              paid_api_usage_updatedAt: moment(),
              paid_api_usage_count: 0,
              user_type: userType,
            })
            .eq("user_email", params.customer_email)
            .select();

          const { data: updateUserData, error: updateUserError } =
            await update_useData_query;
          console.log("Updated User Data:", updateUserData);
          if (updateUserError) {
            throw new Error(
              `Error update user data: ${updateUserError.message}`
            );
          }

          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("user_id", userData.id);
          console.log(chatData, "chatData");
          if (chatError) {
            console.log(chatError, "chat_error");
            throw new Error(
              `Failed to reset free API usage: ${chatError.message}`
            );
          }

          deleteBotMessages(chatData);
        }
      } else {
        updateCurrentPeriodStart = SubscriptonData.current_period_start;
        updateCurrentPeriodEnd = moment(SubscriptonData.current_period_end)
          .add(period, "months")
          .toDate();
        if (SubscriptonData.cancel_at_period_end == true) {
          let update_subscription_query = supabase
            .from("subscriptions")
            .update({
              is_reserved: true,
              reserved_period_end: updateCurrentPeriodEnd,
              reserved_plan: selectedSubscription?.OrderId,
              reserved_method: "stripe",
              reserved_customer_id: params.customer,
            })
            .eq("user_id", userData.id)
            .single();

          const { data: subscriptionData, error: subscriptionError } =
            await update_subscription_query;
          console.log("Updated Subscription Data:", subscriptionData);
          if (subscriptionError) {
            throw new Error(
              `Error fetching subscription data: ${subscriptionError.message}`
            );
          } else {
            fullScbscriptionData = subscriptionData;
            console.log("Step 6: Updating user data...");
            let update_useData_query = supabase
              .from("user_profiles")
              .update({
                reserved_user_type: userType,
              })
              .eq("user_email", params.customer_email)
              .select();

            const { data: updateUserData, error: updateUserError } =
              await update_useData_query;
            console.log("Updated User Data:", updateUserData);
            if (updateUserError) {
              throw new Error(
                `Error update user data: ${updateUserError.message}`
              );
            }
          }
        }

        if (SubscriptonData.cancel_at_period_end == false) {
          let update_subscription_query = supabase
            .from("subscriptions")
            .update({
              current_period_start: moment(),
              current_period_end: moment().add(period, "months").toDate(),
            })
            .eq("user_id", userData.id)
            .single();

          const { data: subscriptionData, error: subscriptionError } =
            await update_subscription_query;
          console.log("Updated Subscription Data:", subscriptionData);
          if (subscriptionError) {
            throw new Error(
              `Error fetching subscription data: ${subscriptionError.message}`
            );
          } else {
            fullScbscriptionData = subscriptionData;
            console.log("Step 6: Updating user data...");
            let update_useData_query = supabase
              .from("user_profiles")
              .update({
                reserved_user_type: userType,
              })
              .eq("user_email", params.customer_email)
              .select();

            const { data: updateUserData, error: updateUserError } =
              await update_useData_query;
            console.log("Updated User Data:", updateUserData);
            if (updateUserError) {
              throw new Error(
                `Error update user data: ${updateUserError.message}`
              );
            }
          }
        }
      }
    } else {
      if (userData.user_type == 1 && SubscriptonData.status == "INACTIVE") {
        updateCurrentPeriodStart = moment();
        updateCurrentPeriodEnd = moment().add(
          selectedSubscription?.Months,
          "months"
        );
        let update_subscription_query = supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            price_id: params.id,
            quantity: 1,
            ended_at: null,
            cancel_at_period_end: false,
            created: moment(),
            current_period_start: moment(),
            current_period_end: moment().add(
              selectedSubscription?.Months,
              "months"
            ),
            current_plan: selectedSubscription?.OrderId,
            current_method: "stripe",
          })
          .eq("user_id", userData.id)
          .single();

        const { data: subscriptionData, error: subscriptionError } =
          await update_subscription_query;
        console.log("Updated Subscription Data:", subscriptionData);
        if (subscriptionError) {
          throw new Error(
            `Error fetching subscription data: ${subscriptionError.message}`
          );
        } else {
          fullScbscriptionData = subscriptionData;
          console.log("Step 6: Updating user data...");
          let update_useData_query = supabase
            .from("user_profiles")
            .update({
              paid_api_usage_updatedAt: moment(),
              paid_api_usage_count: 0,
              user_type: userType,
            })
            .eq("user_email", params.customer_email)
            .select();

          const { data: updateUserData, error: updateUserError } =
            await update_useData_query;
          console.log("Updated User Data:", updateUserData);
          if (updateUserError) {
            throw new Error(
              `Error update user data: ${updateUserError.message}`
            );
          }

          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("user_id", userData.id);
          console.log(chatData, "chatData");
          if (chatError) {
            console.log(chatError, "chat_error");
            throw new Error(
              `Failed to reset free API usage: ${chatError.message}`
            );
          }

          deleteBotMessages(chatData);
        }
      }
    }
  }

  console.log("Process Complete. Returning subscription data.");
  return fullScbscriptionData;
};

export const savingSubsriptionDataByNowpayments = async (params: any) => {
  // Step 1: Check for existing customer
  console.log("Step 1: Checking for existing customer...");
  let is_deplicated_customer_query = supabase
    .from("customers")
    .select("*")
    .eq("user_email", params.customer_email)
    .single();

  const { data, error } = await is_deplicated_customer_query;
  console.log("Customer Data:", data);
  console.log("Customer Error:", error);

  // Step 2: Update existing customer or insert new customer
  if (data !== null) {
    console.log("Step 2: Customer found, updating customer...");
  } else {
    console.log("Step 2: Customer not found, creating new customer...");
  }

  // Step 3: Fetch user data
  console.log("Step 3: Fetching user data...");
  let user_query = supabase
    .from("user_profiles")
    .select("*")
    .eq("user_email", params.customer_email)
    .single();

  const { data: userData, error: userError } = await user_query;
  console.log("User Data:", userData);
  console.log("User Error:", userError);
  if (userError) {
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  // Step 4: Check for existing subscription
  console.log("Step 4: Checking for existing subscription...");
  let is_deplicated_subscription_query = supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userData.id)
    .single();

  const { data: SubscriptonData, error: SubscriptonError } =
    await is_deplicated_subscription_query;
  console.log("Subscription Data:", SubscriptonData);
  console.log("Subscription Error:", SubscriptonError);

  let fullScbscriptionData;
  const selectedSubscription = subscriptionPlan.find(
    (plan) => plan.OrderId === params.order_id
  );
  console.log("Selected Subscription:", selectedSubscription);

  if (SubscriptonData === null) {
    console.log(
      "Step 5: No existing subscription, creating new subscription..."
    );
    let create_subscription_query = supabase.from("subscriptions").insert({
      user_id: userData.id,
      status: "ACTIVE",
      quantity: 1,
      ended_at: null,
      cancel_at_period_end: false,
      created: moment(),
      current_period_start: moment(),
      current_period_end: moment().add(selectedSubscription?.Months, "months"),
    });

    const { data: subscriptionData, error: subscriptionError } =
      await create_subscription_query;
    console.log("New Subscription Data:", subscriptionData);
    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;
      console.log("Step 6: Updating user data...");
      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: moment(),
          paid_api_usage_count: 0,
        })
        .eq("user_email", params.customer_email)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      console.log("Updated User Data:", updateUserData);
      if (updateUserError) {
        throw new Error(`Error update user data: ${updateUserError.message}`);
      }
    }
  } else {
    console.log(
      "Step 5: Subscription already exists, updating subscription..."
    );
    let updateCurrentPeriodStart;
    let updateCurrentPeriodEnd;
    const period = selectedSubscription?.Months;
    if (moment().isAfter(moment(SubscriptonData.current_period_end))) {
      updateCurrentPeriodStart = moment();
      updateCurrentPeriodEnd = moment().add(
        selectedSubscription?.Months,
        "months"
      );
    } else {
      updateCurrentPeriodStart = SubscriptonData.current_period_start;
      updateCurrentPeriodEnd = moment(SubscriptonData.current_period_end)
        .add(period, "months")
        .toDate();
    }

    let update_subscription_query = supabase
      .from("subscriptions")
      .update({
        status: "ACTIVE",
        quantity: 1,
        ended_at: null,
        cancel_at_period_end: false,
        created: moment(),
        current_period_start: moment(),
        current_period_end: moment().add(
          selectedSubscription?.Months,
          "months"
        ),
      })
      .eq("user_id", userData.id)
      .single();

    const { data: subscriptionData, error: subscriptionError } =
      await update_subscription_query;
    console.log("Updated Subscription Data:", subscriptionData);
    if (subscriptionError) {
      throw new Error(
        `Error fetching subscription data: ${subscriptionError.message}`
      );
    } else {
      fullScbscriptionData = subscriptionData;
      console.log("Step 6: Updating user data...");
      let update_useData_query = supabase
        .from("user_profiles")
        .update({
          paid_api_usage_updatedAt: moment(),
          paid_api_usage_count: 0,
        })
        .eq("user_email", params.customer_email)
        .select();

      const { data: updateUserData, error: updateUserError } =
        await update_useData_query;
      console.log("Updated User Data:", updateUserData);
      if (updateUserError) {
        throw new Error(`Error update user data: ${updateUserError.message}`);
      }
    }
  }

  // Step 7: Determine user type based on subscription
  console.log("Step 7: Determining user type...");
  let userType = 1;
  if (selectedSubscription?.Type === "Premium") {
    userType = 2;
  }
  if (selectedSubscription?.Type === "Deluxe") {
    userType = 3;
  }

  let update_useType_query = supabase
    .from("user_profiles")
    .update({
      user_type: userType,
    })
    .eq("user_email", params.customer_email)
    .select();

  const { data: updateUserData, error: updateUserError } =
    await update_useType_query;
  console.log("Updated User Type:", updateUserData);
  if (updateUserError) {
    throw new Error(`Error update user data: ${updateUserError.message}`);
  }

  console.log("Process Complete. Returning subscription data.");
  return fullScbscriptionData;
};

export const createPaymentLink = async (
  userEmail: any,
  subscriptionAmount: any,
  currency: any,
  subscriptionId: any
) => {
  const apiKey = "N5Q3SK1-F6645KR-K18KQQH-DA23Z57";

  try {
    const response = await axios.post(
      "https://api.nowpayments.io/v1/invoice",
      {
        price_amount: subscriptionAmount, // Amount for subscription
        price_currency: currency, // Currency (USD, EUR, etc.)
        order_id: subscriptionId, // Unique order ID
        order_description: "Subscription Plan", // A description for the order
      },
      {
        headers: {
          "x-api-key": `${apiKey}`, // Use the API key for authentication
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.invoice_url; // Return the payment URL from NOWPayments
  } catch (error) {
    console.error("Error in payment service:", error);
    return null;
  }
};

export const cancellingSubscriptionDataByStripe = async (
  subscription: any,
  email: any
) => {
  try {
    let fetch_customerInfo = supabase
      .from("user_profiles")
      .select("*")
      .eq("user_email", email)
      .single();

    const { data: customerData, error: customerError } =
      await fetch_customerInfo;
    console.log("Fetch the UserInfo Error", customerError);
    if (customerError) {
      throw new Error(`Error update user data: ${customerError.message}`);
    }
    if (customerData) {
      const cancelAtDate = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null;
      const canceledAtDate = subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null;

      let update_subscription_cancelStatus = supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: cancelAtDate
            ? cancelAtDate.replace("T", " ").replace("Z", "")
            : null,
          canceled_at: canceledAtDate
            ? canceledAtDate.replace("T", " ").replace("Z", "")
            : null,
        })
        .eq("user_id", customerData.id)
        .select();

      const { data: updateSubscriptionData, error: updateSubscriptionError } =
        await update_subscription_cancelStatus;
      if (updateSubscriptionError) {
        throw new Error(
          `Error update subscription data cancel status: ${updateSubscriptionError.message}`
        );
      }
    }
  } catch (error) {
    console.error("Eorror in cancelling the current subscription");
  }
};

export const checkingStatus = async (email: string) => {
  try {
    console.log("Starting status check for email:", email);

    const { data: userData, error: userError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_email", email)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError.message);
      throw new Error(`Error fetching user data: ${userError.message}`);
    }

    console.log("Fetched user data:", userData);

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userData.id)
      .single();

    if (subscriptionError) {
      console.error(
        "Error fetching subscription data:",
        subscriptionError.message
      );
      return true;
    }

    console.log("Fetched subscription data:", subscriptionData);

    if (subscriptionData) {
      const currentTime = moment();
      console.log("Current time:", currentTime.format());

      if (subscriptionData.cancel_at_period_end) {
        console.log("Subscription is set to cancel at period end.");

        if (
          subscriptionData.status === "ACTIVE" &&
          currentTime.isAfter(subscriptionData.cancel_at)
        ) {
          console.log("Subscription is active but past cancel date.");

          if (subscriptionData.is_reserved) {
            console.log(
              "Reserved subscription detected, updating subscription."
            );

            let check_update_subscription = supabase
              .from("subscriptions")
              .update({
                quantity: 1,
                created: subscriptionData.current_period_end,
                current_period_start: subscriptionData.current_period_end,
                current_period_end: subscriptionData.reserved_period_end,
                current_plan: subscriptionData.reserved_plan,
                current_method: subscriptionData.reserved_method,
                cancel_at: null,
                canceled_at: null,
                is_reserved: false,
                reserved_period_end: null,
                reserved_plan: null,
                reserved_method: null,
                reserved_customer_id: null,
              })
              .eq("user_id", userData.id)
              .select();

            const { data, error } = await check_update_subscription;

            if (error) {
              console.error("Error updating subscription data:", error.message);
              throw new Error(
                `Error updating subscription data: ${error.message}`
              );
            }

            console.log("Subscription updated successfully:", data);

            switch (subscriptionData.reserved_method) {
              case "stripe":
                console.log("Updating Stripe customer ID.");
                let updated_customer_stripe = supabase
                  .from("customers")
                  .update({
                    stripe_customer_id: subscriptionData.reserved_customer_id,
                  })
                  .eq("user_email", email)
                  .select();
                const {
                  data: updatedCustomerStripe,
                  error: updatedCustomerStripeError,
                } = await updated_customer_stripe;
                if (updatedCustomerStripeError) {
                  console.error(
                    "Error updating Stripe customer ID:",
                    updatedCustomerStripeError.message
                  );
                } else {
                  console.log(
                    "Stripe customer ID updated successfully:",
                    updatedCustomerStripe
                  );
                }
                break;
              case "paypal":
                console.log("Updating PayPal customer ID.");
                let updated_customer_paypal = supabase
                  .from("customers")
                  .update({
                    paypal_customer_id: subscriptionData.reserved_customer_id,
                  })
                  .eq("user_email", email)
                  .select();
                const {
                  data: updatedCustomerPaypal,
                  error: updatedCustomerPaypalError,
                } = await updated_customer_paypal;
                if (updatedCustomerPaypalError) {
                  console.error(
                    "Error updating PayPal customer ID:",
                    updatedCustomerPaypalError.message
                  );
                } else {
                  console.log(
                    "PayPal customer ID updated successfully:",
                    updatedCustomerPaypal
                  );
                }
                break;

              default:
                console.warn("No matching reserved method found.");
                break;
            }

            let update_user_profile = supabase
              .from("user_profiles")
              .update({
                user_type: userData.reserved_user_type,
                paid_api_usage_count: 0,
                reserved_user_type: null,
              })
              .eq("user_email", email)
              .select();

            const { data: updatedUserData, error: updatedUserError } =
              await update_user_profile;
            if (updatedUserError) {
              console.error(
                "Error updating user profile:",
                updatedUserError.message
              );
            } else {
              console.log(
                "User profile updated successfully:",
                updatedUserData
              );
            }
          } else {
            console.log("No reserved subscription, marking as inactive.");

            let check_update_subscription = supabase
              .from("subscriptions")
              .update({
                status: "INACTIVE",
                price_id: null,
                quantity: null,
                cancel_at_period_end: false,
                created: null,
                current_period_start: null,
                current_period_end: null,
                cancel_at: null,
                canceled_at: null,
                current_plan: null,
                current_method: null,
                ended_at: subscriptionData.current_period_end,
              })
              .eq("user_id", userData.id)
              .select();

            const { data, error } = await check_update_subscription;

            if (error) {
              console.error(
                "Error marking subscription as inactive:",
                error.message
              );
              throw new Error(
                `Error marking subscription as inactive: ${error.message}`
              );
            }

            console.log("Subscription marked as inactive:", data);

            let update_user_profile = supabase
              .from("user_profiles")
              .update({
                user_type: 1,
                paid_api_usage_count: 0,
              })
              .eq("user_email", email)
              .select();

            const { data: updatedUserData, error: updatedUserError } =
              await update_user_profile;
            if (updatedUserError) {
              console.error(
                "Error updating user profile:",
                updatedUserError.message
              );
            } else {
              console.log(
                "User profile updated successfully:",
                updatedUserData
              );
            }
          }
        }
      }

      console.log("Process completed successfully for email:", email);
      return true;
    }

    console.warn("No subscription data found for email:", email);
    return true;
  } catch (error) {
    console.error("Error in checkingStatus function:");
    return false;
  }
};

export const cancellingSubscriptionDataByPaypal = async (event: any) => {
  try {
    console.log(
      event.resource.subscriber.email_address,
      "event.resource.subscriber.email_address"
    );
    let fetch_customerInfo = supabase
      .from("user_profiles")
      .select("*")
      .eq("user_email", event.resource.subscriber.email_address)
      .single();

    const { data: customerData, error: customerError } =
      await fetch_customerInfo;
    // console.log('Fetch the UserInfo Error', customerError);
    if (customerError) {
      throw new Error(`Error update user data: ${customerError.message}`);
    }
    if (customerData) {
      let fetch_subscriptionInfo = supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", customerData.id)
        .single();

      const { data: subscriptionData, error: subscriptionError } =
        await fetch_subscriptionInfo;
      if (subscriptionError) {
        throw new Error(`Error update user data: ${subscriptionError.message}`);
      }

      let update_subscription_cancelStatus = supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          cancel_at: subscriptionData.current_period_end,
          canceled_at: event.resource.status_update_time,
        })
        .eq("user_id", customerData.id)
        .select();

      const { data: updateSubscriptionData, error: updateSubscriptionError } =
        await update_subscription_cancelStatus;
      if (updateSubscriptionError) {
        throw new Error(
          `Error update subscription data cancel status: ${updateSubscriptionError.message}`
        );
      }
    }
  } catch (error) {
    console.error("Eorror in cancelling the current subscription");
  }
};

export const expiringSubscriptionDataByPaypal = async (event: any) => {
  try {
    console.log(
      event.resource.subscriber.email_address,
      "event.resource.subscriber.email_address"
    );
    let fetch_customerInfo = supabase
      .from("user_profiles")
      .select("*")
      .eq("user_email", event.resource.subscriber.email_address)
      .single();

    const { data: customerData, error: customerError } =
      await fetch_customerInfo;

    if (customerError) {
      throw new Error(`Error update user data: ${customerError.message}`);
    }
    if (customerData) {
      let fetch_subscriptionInfo = supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", customerData.id)
        .single();

      const { data: subscriptionData, error: subscriptionError } =
        await fetch_subscriptionInfo;
      if (subscriptionError) {
        throw new Error(`Error update user data: ${subscriptionError.message}`);
      }

      let update_subscription_cancelStatus = supabase
        .from("subscriptions")
        .update({
          status: "INACTIVE",
          price_id: null,
          quantity: null,
          cancel_at_period_end: false,
          created: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at: null,
          canceled_at: null,
          current_plan: null,
          current_method: null,
          ended_at: subscriptionData.current_period_end,
        })
        .eq("user_id", customerData.id)
        .select();

      const { data: updateSubscriptionData, error: updateSubscriptionError } =
        await update_subscription_cancelStatus;
      if (updateSubscriptionError) {
        throw new Error(
          `Error update subscription data expired status: ${updateSubscriptionError.message}`
        );
      }

      let update_user_profile = supabase
        .from("user_profiles")
        .update({
          user_type: 1,
          paid_api_usage_count: 0,
        })
        .eq("user_email", event.resource.subscriber.email_address)
        .select();

      const { data: updatedUserData, error: updatedUserError } =
        await update_user_profile;
      if (updatedUserError) {
        console.error("Error updating user profile:", updatedUserError.message);
      } else {
        console.log("User profile updated successfully:", updatedUserData);
      }
    }
  } catch (error) {
    console.error("Eorror in expiring the current subscription");
  }
};

const deleteBotMessages = async (chatData: any) => {
  try {
    // Map over each chat and prepare a delete promise
    const deletePromises = chatData.map((chat: any) => {
      return supabase
        .from("chat_messages")
        .delete()
        .eq("chat_id", chat.id)
        .eq("is_bot", true)
        .eq("is_main", false)
        .like(
          "message",
          "Your messages are ended. Please upgrade your current plan."
        );
    });

    // Wait for all delete operations to complete
    const results = await Promise.all(deletePromises);

    // Optional: Log success or check for errors
    results.forEach((result, index) => {
      if (result.error) {
        console.error(
          `Error deleting messages for chat_id ${chatData[index].id}:`,
          result.error
        );
      } else {
        console.log(
          `Successfully deleted messages for chat_id ${chatData[index].id}`
        );
      }
    });
  } catch (error) {
    console.error("Unexpected error during delete operation:", error);
  }
};

module.exports = {
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
};
