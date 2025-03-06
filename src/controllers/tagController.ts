import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync'; // Adjust the import path accordingly
import { getTagsData } from '../services/tagService';

// Define the getTagData function
const getTagData = catchAsync(async (req: Request, res: Response) => {
    try {
        const result = await getTagsData();
        res.status(200).json(result);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error get tags data' });
    }
});

export default getTagData;