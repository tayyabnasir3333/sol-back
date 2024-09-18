const express = require("express");
const {
  registerUser,
  loginUser,
  allUsers,
  registerAdmin,
  buildTree,
  walletUserAmount,
  paidCommission,
  payTheCommission,
  deleteUser,
  updateComissionServed,
} = require("../controllers/auth.controller");

const router = express.Router();

router.route("/users").get(allUsers);
router.route("/user/:id").delete(deleteUser);
router.route("/register").post(registerAdmin);
router.route("/login").post(loginUser);
router.route("/tree/:userId").get(buildTree);
router.route("/walletUsersAmount").get(walletUserAmount);
router.route("/paid-commission").get(paidCommission);
router.route("/payTheCommission").post(payTheCommission);
router.route("/updateComissionServed/:id").put(updateComissionServed);

module.exports = router;
