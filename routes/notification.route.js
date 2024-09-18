const express = require("express");
const auth = require("../middleware/auth.middleware");
const {
  sendNotification,
  getUsersbySearch,
} = require("../controllers/notification.controller");

const router = express.Router();

router.route("/sendNotification").post(sendNotification);
router.route("/getUsersbySearch").get(getUsersbySearch);

module.exports = router;
