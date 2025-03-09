import express from "express";

import {
  getMyProfileData,
  getProfileDataById,
  getMyBlockList,
  reactivateMyProfileData,
  createProfile,
  updateProfile,
  getSummaryDataById,
} from "../controllers/profileController";

const router = express.Router();

router.post("/mine", getMyProfileData);
router.get("/mine/blocked", getMyBlockList);
router.post("/mine/reactivate", reactivateMyProfileData);

router.post("/createProfile", createProfile);
router.post("/weeklyData", getProfileDataById);
router.get("/:profileId", getSummaryDataById);
router.post("/updateProfile", updateProfile);

export default router;
