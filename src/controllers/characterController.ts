import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync'; // Adjust the import path accordingly
import { getCharactersAllData, creatingCharacterData, getCharacterDataById, updateCharacterDataById, deleteCharacterDataById, gettingSimilarCharacters } from '../services/characterService';

interface QueryParams {
    page?: string;   // Optional, since it might not be present
    search?: string; // Optional
    mode?: string;   // Optional
    sort?: string;   // Optional
    tag_id?: string;  // Optional
    tag_name?: string; // Optional
    is_nsfw?: string;
    user_id?:string;
}

// Define the getUserData function
export const getCharactersData = catchAsync(async (req: Request, res: Response) => {
    try {
        const { page, search, mode, sort, tag_id, tag_name, is_nsfw, user_id }: QueryParams = req.query as QueryParams;
        const result = await getCharactersAllData({ page, search, mode, sort, tag_id, tag_name, is_nsfw, user_id });
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching character data' });
    }
});

export const createCharacterData = catchAsync(async (req: Request, res: Response) => {
    try {
        const params = req.body
        const result = await creatingCharacterData(params);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating character data' });
    }
})

export const getCharacterData = catchAsync(async (req: Request, res: Response) => {
    try {
        const characterId = req.params.characterId;
        const {userId} = req.query;
        console.log(userId,"userId")
        const result = await getCharacterDataById(characterId, userId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching character data' });
    }
});

export const updateCharacterData = catchAsync(async (req: Request, res: Response) => {
    try {
        const params = req.body
        const characterId = req.params.characterId;
        const result = await updateCharacterDataById({ params, characterId });
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching character data' });
    }
});

export const deleteCharacterData = catchAsync(async (req: Request, res: Response) => {
    try {
        const characterId = req.params.characterId;
        const result = await deleteCharacterDataById(characterId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching character data' });
    }
});

export const getSimilarCharacters = catchAsync(async (req: Request, res: Response) => {
    try {
        const characterId = req.params.characterId;
        const { user_id, isNsfw } = req.query;
        const result = await gettingSimilarCharacters(characterId, user_id, isNsfw);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching character data' });
    }
});


module.exports = {
    getCharactersData,
    createCharacterData,
    getCharacterData,
    updateCharacterData,
    deleteCharacterData,
    getSimilarCharacters
}