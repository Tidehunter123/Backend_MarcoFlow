import express from "express"

import  {createChatbyCharacterId, getChatbyId, updateChatbyId, createChatMessagebyChatId, updateChatMessagebyMessageId, deleteNoMainChatMessagebyChatId, generateMessagesByAdmin}  from "../controllers/chatController"


const router = express.Router();

router.post('/', createChatbyCharacterId)
router.get('/:Id', getChatbyId)
router.patch('/:chatId', updateChatbyId)
router.post('/:chatId/messages', createChatMessagebyChatId)
router.patch('/:chatId/messages/:messageId', updateChatMessagebyMessageId)
router.delete('/:chatId/messages',deleteNoMainChatMessagebyChatId)
router.post('/messages/generateByAdmin',generateMessagesByAdmin)

export default router