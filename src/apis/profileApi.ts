import express from "express";

import {
  getMyProfileData,
  getProfileDataById,
  getMyBlockList,
  reactivateMyProfileData,
  createProfile,
  updateProfile,
} from "../controllers/profileController";

const router = express.Router();

router.post("/mine", getMyProfileData);
router.get("/mine/blocked/", getMyBlockList);
router.post("/mine/reactivate", reactivateMyProfileData);

router.post("/createProfile", createProfile);
router.get("/:profileId", getProfileDataById);
router.post("/updateProfile", updateProfile);

export default router;
