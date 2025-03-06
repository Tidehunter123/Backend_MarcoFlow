import express from "express"

import  {getCharactersData, createCharacterData, getCharacterData, updateCharacterData, deleteCharacterData, getSimilarCharacters}  from "../controllers/characterController"


const router = express.Router();

router.get('/', getCharactersData)
router.post('/', createCharacterData)
router.get('/:characterId',getCharacterData)
router.patch('/:characterId', updateCharacterData)
router.delete('/:characterId', deleteCharacterData)
router.get('/similarCharacters/:characterId', getSimilarCharacters)

export default router