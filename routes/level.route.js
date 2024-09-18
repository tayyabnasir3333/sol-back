const express = require("express");
const { getLevels, getUserLevels } = require("../controllers/level.controller");

const router = express.Router();

// router.route("/:id/:level").get(getLevels);
router.route("/user-level/:id").get(getUserLevels);
// router.route("/").get(getLevelOne);

module.exports = router;
