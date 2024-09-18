const express = require("express");
const {
  create,
  getAll,
  getById,
  deleteData,
  update,
  updateCommission,
} = require("../controllers/commission.controller");
const auth = require("../middleware/auth.middleware");
const commissionMiddleware = require("../middleware/commission.middleware");

const router = express.Router();

router.route("/").post(auth, commissionMiddleware, create);
router.route("/").get(auth, getAll);
router.route("/:id").get(auth, getById);
router.route("/:id").delete(auth, deleteData);
router.route("/:id").put(auth, update);
router.route("/paid-commission/:userId/:earningId").get(auth, updateCommission);

module.exports = router;
