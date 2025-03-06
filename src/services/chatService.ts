import { User } from "@supabase/supabase-js";
import { supabase } from "../config/superbaseConfig";
import dotenv from 'dotenv';
import moment from 'moment';

dotenv.config()

interface config {
    jailbreak_prompt: string;
    use_pygmalion_format: boolean;
    generation_settings: GenerationSetting;
    immersive_mode: boolean;
    text_streaming: boolean;
    openrouter_model?: "gryphe/mythomax-l2-13b" | "mistralai/mistral-nemo" | "microsoft/wizardlm-2-7b";
}

interface GenerationSetting {
    temperature: number;
    max_new_token: number; // undefined or 0 mean unlimited
    context_length?: number;

    // Only use for other models
    repetition_penalty?: number;
}

interface messages {
    role: "system" | "assistant" | "user";
    content: string;
}

interface OpenrouterAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
        index: number;
    }>;
}

interface OpenrouterAIError {
    code: string;
    message: string;
    param: object | null;
    type: string;
    error?: string;
}

interface OpenrouterAIProxyError {
    message: string;
    proxy_note: string;
    stack: string;
    type: string;
}

type UserType = 1 | 2 | 3;



export const creatingChatData = async (characterId: string, profileId: string) => {
    const { data: characterData, error: characterError } = await supabase
        .from("characters")
        .select('*')
        .eq('id', characterId)
        .single();

    if (characterError) {
        throw new Error(`Error fetching character's creator_id data: ${characterError.message}`);
    }

    const { data: userData, error: userError } = await supabase
        .from("user_profiles")
        .select('*')
        .eq('id', profileId)
        .single();

    if (userError) {
        throw new Error(`Error fetching user data: ${userError.message}`);
    }

    const { data, error } = await supabase
        .from("chats")
        .insert({
            character_id: characterId,
            user_id: profileId,
            is_public: false,
            updated_at: new Date()
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Error creating chat data: ${error.message}`);
    }

    const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
            chat_id: data.id,
            is_bot: true,
            is_main: true,
            message: characterData.first_message,
            is_mock: false
        })

    if (messageError) {
        throw new Error(`Error creating chat message data: ${messageError.message}`);
    }

    return data
}

export const gettingChatData = async (chatId: string, userId: any) => {

    const { data: userProfile, error: userProfileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq('id', userId.toString())
        .single();

    if (userProfileError) {
        console.error(userProfileError, "user_profile_error")
        throw new Error(`Failed to fetch user profile: ${userProfileError.message}`);
    }

    const currentTime = moment();
    const freeUsageResetTime = moment(userProfile.admin_api_usage_updatedAt);
    const paidUsageResetTime = moment(userProfile.paid_api_usage_updatedAt);

    //Check if free API usage needs a reset
    if (currentTime.diff(freeUsageResetTime, "months") >= 1) {
        const { error: updateError } = await supabase
            .from("user_profiles")
            .update({
                admin_api_usage_count: 0,
                admin_api_usage_updatedAt: freeUsageResetTime.add(currentTime.diff(freeUsageResetTime, "months"), "months").toDate(),
            })
            .eq('id', userId.toString())
            .single();

        if (updateError) {
            throw new Error(`Failed to reset free API usage: ${updateError.message}`);
        }

        const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', userId.toString())
        if (chatError) {
            console.log(chatError, "chat_error")
            throw new Error(`Failed to reset free API usage: ${chatError.message}`);
        }

        deleteBotMessages(chatData);
    }

    console.log("Fetching subscription details...");

    const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq('user_id', userId.toString())
        // .eq('cancel_at_period_end', false)
        .in('status', ["ACTIVE", "succeeded"])
        .single();


    if (subscription) {

        const subscriptionStart = moment(subscription.current_period_start);
        const subscriptionEnd = moment(subscription.current_period_end);
        if (currentTime.diff(paidUsageResetTime, "months") >= 1 && currentTime.isBetween(subscriptionStart, subscriptionEnd)) {

            console.log("Resetting paid API usage...");
            const { error: paidUpdateError } = await supabase
                .from("user_profiles")
                .update({
                    paid_api_usage_count: 0,
                    paid_api_usage_updatedAt: paidUsageResetTime.add(currentTime.diff(paidUsageResetTime, "months"), "months").toDate(),
                })
                .eq('id', userId.toString())
                .single();

            if (paidUpdateError) {
                console.error(paidUpdateError, "paid_usage_reset_error");
                throw new Error(`Failed to reset paid API usage: ${paidUpdateError.message}`);
            }

            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', userId.toString())
            console.log(chatData, "chatData after paid usage reset");
            if (chatError) {
                console.log(chatError, "chat_error")
                throw new Error(`Failed to reset free API usage: ${chatError.message}`);
            }

            deleteBotMessages(chatData);
        }
    }

    const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*, characters(id, name, avatar, description, is_nsfw)")
        .eq('id', chatId)
        .eq('user_id', userId.toString())
        .single()

    if (chatError) {
        throw new Error(`Error getting chat data: ${chatError.message}`);
    }

    const { data: chatMessagesData, error: chatMessagesError } = await supabase
        .from("chat_messages")
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

    if (chatMessagesError) {
        throw new Error(`Error creating chat data: ${chatMessagesError.message}`);
    }

    const data = {
        chat: chatData,
        chatMessages: chatMessagesData,
    };

    return data
}

export const updatingChatData = async (chatId: string, summary: any, summary_chat_id: any) => {

    const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .update({
            summary: summary,
            summary_chat_id: summary_chat_id
        })
        .eq('id', chatId)
        .select()
        .single()

    if (chatError) {
        throw new Error(`Error updating chat data: ${chatError.message}`);
    }
}

export const creatingChatMessagebyChatId = async (params: {
    message?: string;
    is_bot?: boolean;
    is_main?: boolean;
    is_mock?: boolean
}, chatId: string) => {
    const { data, error } = await supabase
        .from("chat_messages")
        .insert({
            chat_id: chatId,
            is_bot: params.is_bot,
            is_main: params.is_main,
            message: params.message,
            is_mock: params.is_mock,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Error creating chat data: ${error.message}`);
    }

    const { data: chatData, error: chatDataError } = await supabase
        .from("chats")
        .update({
            updated_at: new Date()
        })
        .eq('id', chatId)
        .select()
        .single();
    if (chatDataError) {
        throw new Error(`Error updating chat data: ${chatDataError.message}`);
    }
    return data
}

export const updatingChatMessagebyMessageId = async (is_main: boolean, chatId: string, messageId: string) => {
    const { data, error } = await supabase
        .from("chat_messages")
        .update({
            is_main: is_main,
        })
        .eq('chat_id', chatId)
        .eq('id', messageId)
        .select()
        .single();

    if (error) {
        throw new Error(`Error updating chat message data: ${error.message}`);
    }

    const { data: chatData, error: chatDataError } = await supabase
        .from("chats")
        .update({
            updated_at: new Date()
        })
        .eq('id', chatId)
        .select()
        .single();
    if (chatDataError) {
        throw new Error(`Error updating chat data: ${chatDataError.message}`);
    }

    return data
}

export const deletingNoMainChatMessagebyChatId = async (chatId: string, messageIds: object[]) => {
    const results = [];

    for (const messageId of messageIds) {
        const { data, error } = await supabase
            .from("chat_messages")
            .delete()
            .eq('chat_id', chatId)
            .eq('id', messageId)
            .select();
        if (error) {
            throw new Error(`Error deleting chat message data: ${error.message}`);
        }

        const { data: chatData, error: chatDataError } = await supabase
            .from("chats")
            .update({
                updated_at: new Date()
            })
            .eq('id', chatId)
            .select()
            .single();
        if (chatDataError) {
            throw new Error(`Error updating chat data: ${chatDataError.message}`);
        }

        results.push(data);
    }



    return results;
};

export const generatingMessagesByAdmin = async (messages: messages[], config: config, user_id: string) => {


    const { data: userProfile, error: userProfileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq('id', user_id.toString())
        .single();

    if (userProfileError) {
        console.error(userProfileError, "user_profile_error")
        throw new Error(`Failed to fetch user profile: ${userProfileError.message}`);
    }

    const currentTime = moment();
    const freeUsageResetTime = moment(userProfile.admin_api_usage_updatedAt);
    const paidUsageResetTime = moment(userProfile.paid_api_usage_updatedAt);

    //Check if free API usage needs a reset
    if (currentTime.diff(freeUsageResetTime, "months") >= 1) {
        const { error: updateError } = await supabase
            .from("user_profiles")
            .update({
                admin_api_usage_count: 0,
                admin_api_usage_updatedAt: freeUsageResetTime.add(currentTime.diff(freeUsageResetTime, "months"), "months").toDate(),
            })
            .eq('id', user_id.toString())
            .single();

        if (updateError) {
            console.log(updateError, "free_usage_reset_error")
            throw new Error(`Failed to reset free API usage: ${updateError.message}`);
        }

        const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', user_id.toString())
        if (chatError) {
            console.log(chatError, "chat_error")
            throw new Error(`Failed to reset free API usage: ${chatError.message}`);
        }

        deleteBotMessages(chatData);
    }

    console.log("Fetching subscription details...");

    const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq('user_id', user_id.toString())
        .in('status', ["ACTIVE", "succeeded"])
        .single();


    if (subscription) {

        const subscriptionStart = moment(subscription.current_period_start);
        const subscriptionEnd = moment(subscription.current_period_end);
        if (currentTime.diff(paidUsageResetTime, "months") >= 1 && currentTime.isBetween(subscriptionStart, subscriptionEnd)) {
            console.log("updated")
            console.log("Resetting paid API usage...");
            const { error: paidUpdateError } = await supabase
                .from("user_profiles")
                .update({
                    paid_api_usage_count: 0,
                    paid_api_usage_updatedAt: paidUsageResetTime.add(currentTime.diff(paidUsageResetTime, "months"), "months").toDate(),
                })
                .eq('id', user_id.toString())
                .single();

            if (paidUpdateError) {
                console.error(paidUpdateError, "paid_usage_reset_error");
                throw new Error(`Failed to reset paid API usage: ${paidUpdateError.message}`);
            }

            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', user_id.toString())
            console.log(chatData, "chatData after paid usage reset");
            if (chatError) {
                console.log(chatError, "chat_error")
                throw new Error(`Failed to reset free API usage: ${chatError.message}`);
            }

            deleteBotMessages(chatData);
        }

        //Handle expired subscription

        if (currentTime.isAfter(subscription.current_period_end) && userProfile.user_type > 1 && userProfile.reserved_user_type == null && subscription.is_reserved == false && subscription.cancel_at_period_end == true) {
            const { error: subscriptionEndError } = await supabase
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
                    ended_at: subscription.current_period_end
                })
                .eq('user_id', user_id.toString())
                .single();
            if (subscriptionEndError) {
                console.log(subscriptionEndError, "subscription_end_error")
                throw new Error(`Error update subscription status: ${subscriptionEndError.message}`);
            }

            const { error: userTypeUpdateError } = await supabase
                .from("user_profiles")
                .update({
                    user_type: 1,
                    paid_api_usage_count: 0
                })
                .eq('id', user_id.toString())
                .single();

            if (userTypeUpdateError) {
                console.log(userTypeUpdateError, "user_type_update_error")
                throw new Error(`Failed to downgrade user type: ${userTypeUpdateError.message}`);
            }
        }

        if (currentTime.diff(paidUsageResetTime, "months") >= 1 && currentTime.isBetween(subscriptionStart, subscriptionEnd)) {
            const { error: paidUpdateError } = await supabase
                .from("user_profiles")
                .update({
                    paid_api_usage_count: 0,
                    paid_api_usage_updatedAt: paidUsageResetTime.add(currentTime.diff(paidUsageResetTime, "months"), "months").toDate(),
                })
                .eq('id', user_id.toString())
                .single();

            if (paidUpdateError) {
                console.error(paidUpdateError, "paid_usage_reset_error");
                throw new Error(`Failed to reset paid API usage: ${paidUpdateError.message}`);
            }

            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', user_id.toString())
            if (chatError) {
                throw new Error(`Failed to reset free API usage: ${chatError.message}`);
            }

            deleteBotMessages(chatData);
        }

        //Handle expired subscription

        if (currentTime.isAfter(subscription.current_period_end) && userProfile.user_type > 1 && userProfile.reserved_user_type && subscription.is_reserved == true) {
            const { error: subscriptionEndError } = await supabase
                .from("subscriptions")
                .update({
                    current_period_end: subscription.reserved_period_end,
                    is_reserved: false,
                    reserved_period_end: null
                })
                .eq('user_id', user_id.toString())
                .single();
            if (subscriptionEndError) {
                console.log(subscriptionEndError, "subscription_end_error")
                throw new Error(`Error update subscription status: ${subscriptionEndError.message}`);
            }

            const { error: userTypeUpdateError } = await supabase
                .from("user_profiles")
                .update({
                    user_type: userProfile.reserved_user_type,
                    paid_api_usage_count: 0,
                    reserved_user_type: null
                })
                .eq('id', user_id.toString())
                .single();

            if (userTypeUpdateError) {
                console.log(userTypeUpdateError, "user_type_update_error")
                throw new Error(`Failed to downgrade user type: ${userTypeUpdateError.message}`);
            }

            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', user_id.toString())
            console.log(chatData, "chatData")
            if (chatError) {
                console.log(chatError, "chat_error")
                throw new Error(`Failed to reset free API usage: ${chatError.message}`);
            }

            deleteBotMessages(chatData);
        }
    }

    // Check if the user has exceeded usage limits
    const { data: updatedUser, error: userFetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user_id)
        .single();

    if (userFetchError) {
        console.error(userFetchError, "user_fetch_error");
        throw new Error(`Failed to fetch updated user profile: ${userFetchError.message}`);
    }

    const usageLimits = {
        1: process.env.FREE_CREDIT_COUNT || 5,        // Free users, default 5 credits
        2: process.env.PREMIUM_CREDIT_COUNT || 10,    // Premium users, default 10 credits
        3: process.env.DELUXE_CREDIT_COUNT || 15,     // Deluxe users, default 15 credits
    };

    // Step 1: Check usage limits and decide whether to return due to exceeding the limit
    if (
        (updatedUser.user_type === 1 && updatedUser.admin_api_usage_count >= usageLimits[1]) ||
        (updatedUser.user_type === 2 && updatedUser.paid_api_usage_count >= usageLimits[2] && updatedUser.admin_api_usage_count >= usageLimits[1]) ||
        (updatedUser.user_type === 3 && updatedUser.paid_api_usage_count >= usageLimits[3] && updatedUser.admin_api_usage_count >= usageLimits[1])
    ) {
        return ""; // Limit exceeded
    }

    // Generate the message using OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
            model: config.openrouter_model,
            temperature: config.generation_settings.temperature,
            max_tokens: config.generation_settings.max_new_token,
            messages,
        }),
    });

    if (response.status !== 200) {
        const errorResponse = await response.json();
        console.error(errorResponse, "api_error");
        throw new Error(errorResponse.error?.message || "Failed to generate message");
    }

    const apiResult = await response.json();
    const generatedMessage = apiResult.choices?.[0]?.message?.content;

    // Step 2: Determine which usage field to increment based on user type and current usage
    let usageField = '';
    if (updatedUser.user_type === 1) {
        // For free users, increment the admin_api_usage_count
        usageField = updatedUser.admin_api_usage_count < usageLimits[1] ? "admin_api_usage_count" : '';
    } else if (updatedUser && updatedUser.user_type === 2 || updatedUser.user_type === 3) {
        // For premium and deluxe users, prioritize increasing paid_api_usage_count first
        if (updatedUser.paid_api_usage_count < usageLimits[updatedUser.user_type as UserType]) {
            usageField = "paid_api_usage_count"; // Increase paid usage first
        } else if (updatedUser.admin_api_usage_count < usageLimits[1]) {
            usageField = "admin_api_usage_count"; // After paid count reaches limit, increase admin usage
        }
    }

    // Step 3: If there is a valid usage field, update it
    if (usageField) {
        const { error: incrementError } = await supabase
            .from("user_profiles")
            .update({ [usageField]: updatedUser[usageField] + 1 })
            .eq("id", user_id)
            .single();

        if (incrementError) {
            console.error(incrementError, "usage_increment_error");
            throw new Error(`Failed to increment usage count: ${incrementError.message}`);
        }
    }

    return generatedMessage;
}

const deleteBotMessages = async (chatData: any) => {
    try {
        // Map over each chat and prepare a delete promise
        const deletePromises = chatData.map((chat: any) => {
            return supabase
                .from('chat_messages')
                .delete()
                .eq('chat_id', chat.id)
                .eq('is_bot', true)
                .eq('is_main', false)
                .like('message', 'Your messages are ended. Please upgrade your current plan.');
        });

        // Wait for all delete operations to complete
        const results = await Promise.all(deletePromises);

        // Optional: Log success or check for errors
        results.forEach((result, index) => {
            if (result.error) {
                console.error(`Error deleting messages for chat_id ${chatData[index].id}:`, result.error);
            } else {
                console.log(`Successfully deleted messages for chat_id ${chatData[index].id}`);
            }
        });
    } catch (error) {
        console.error('Unexpected error during delete operation:', error);
    }
};

module.exports = { creatingChatData, gettingChatData, updatingChatData, creatingChatMessagebyChatId, updatingChatMessagebyMessageId, deletingNoMainChatMessagebyChatId, generatingMessagesByAdmin }


