import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync'; // Adjust the import path accordingly
import { getReviewsDataByCharacterId, postReviewsDataByCharacterId } from '../services/reviewService';

// Define the getTagData function
export const getReviewsData = catchAsync(async (req: Request, res: Response) => {
    try {
        const characterId = req.params.characterId;
        console.log(characterId, "characterId")
        const result = await getReviewsDataByCharacterId(characterId);
        res.status(200).json(result);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error fetching review data' });
    }
});

export const postReviewsData = catchAsync(async (req: Request, res: Response) => {
    try {
        const params = req.body;
        console.log(params, "params")
        const result = await postReviewsDataByCharacterId(params);
        console.log(result, "result")
        res.status(200).json(result);
    }

    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error posting reviews data' });
    }
})



module.exports = { getReviewsData, postReviewsData };