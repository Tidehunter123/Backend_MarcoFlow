import express from "express"

import  {getReviewsData,postReviewsData}  from "../controllers/reviewController"

const router = express.Router();

router.get('/:characterId', getReviewsData)
router.post('/',postReviewsData)

export default router