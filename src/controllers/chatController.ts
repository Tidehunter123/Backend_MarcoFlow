import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { creatingChatData, gettingChatData, updatingChatData, creatingChatMessagebyChatId, updatingChatMessagebyMessageId, deletingNoMainChatMessagebyChatId, generatingMessagesByAdmin } from '../services/chatService';

export const createChatbyCharacterId = catchAsync(async (req: Request, res: Response) => {
    try {
        const characterId = req.body.character_id;
        const profileId = req.body.profile_id;
        const result = await creatingChatData(characterId, profileId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating chat data' });
    }
})

export const getChatbyId = catchAsync(async (req: Request, res: Response) => {
    try {
        const chatId = req.params.Id
        const { userId } = req.query;
        const result = await gettingChatData(chatId, userId);

        res.status(200).json(result);

    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching chat data' });
    }
})

export const updateChatbyId = catchAsync(async (req: Request, res: Response) => {
    try {
        const chatId = req.params.chatId
        const { summary, summary_chat_id } = req.body;
        console.log(chatId, "chatId")
        console.log(req.body)
        const result = await updatingChatData(chatId, summary, summary_chat_id);

        res.status(200).json(result);

    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error updating chat data' });
    }
})


export const createChatMessagebyChatId = catchAsync(async (req: Request, res: Response) => {
    try {
        const params = req.body;
        const chatId = req.params.chatId;
        const result = await creatingChatMessagebyChatId(params, chatId);
        res.status(200).json(result);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating chat message data' });
    }
})

export const updateChatMessagebyMessageId = catchAsync(async (req: Request, res: Response) => {
    try {
        const chatId = req.params.chatId;
        const messageId = req.params.messageId;
        const is_main = req.body.is_main;
        const result = await updatingChatMessagebyMessageId(is_main, chatId, messageId);
        console.log(result)
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating chat message data' });
    }
})

export const deleteNoMainChatMessagebyChatId = catchAsync(async (req: Request, res: Response) => {
    try {
        const chatId = req.params.chatId;
        const messageIds = req.body.message_ids;
        const result = await deletingNoMainChatMessagebyChatId(chatId, messageIds);
        res.status(200).json(result);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error deleting no main chat message data' });
    }
})

export const generateMessagesByAdmin = catchAsync(async (req: Request, res: Response) => {
    try {
        const { messages, config, user_id } = req.body;
        console.log(messages, "messages", config, "config", user_id, "user_id");
        const result = await generatingMessagesByAdmin(messages, config, user_id);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error generating chat message by admin data' });
    }
}

)

module.exports = { createChatbyCharacterId, getChatbyId, updateChatbyId, createChatMessagebyChatId, updateChatMessagebyMessageId, deleteNoMainChatMessagebyChatId, generateMessagesByAdmin }
