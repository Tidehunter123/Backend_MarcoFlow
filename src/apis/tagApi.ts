import express from "express"

import  getTagData  from "../controllers/tagController"

const router = express.Router();

router.get('/', getTagData)

export default router