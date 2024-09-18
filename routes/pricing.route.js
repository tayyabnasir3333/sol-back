const express = require("express");
const {
  getAll,
  getById,
  create,
  deleteData,
  update,
  transactionHistory,
} = require("../controllers/pricing.controller");
const auth = require("../middleware/auth.middleware");
const pricingMiddleware = require("../middleware/pricing.middleware");

const router = express.Router();

router.route("/").post(auth, pricingMiddleware, create);
router.route("/").get(auth, getAll);
router.route("/transaction/:id").get(auth, transactionHistory);
router.route("/:id").get(auth, getById);
router.route("/:id").delete(auth, deleteData);
router.route("/:id").put(auth, update);

module.exports = router;
