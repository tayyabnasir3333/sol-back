const express = require("express");
const {
  getAll,
  getById,
  deleteData,
  update,
  getByIdTokenInfo,
  alwaysApprove,
  getAdvertInfoByUser,
} = require("../controllers/advertisement.controller");
const auth = require("../middleware/auth.middleware");

const router = express.Router();

router.route("/always-approve").put(auth, alwaysApprove);
router.route("/getAll/:status").get(auth, getAll);
router.route("/:id").get(auth, getById);
router.route("/:id").delete(auth, deleteData);
router.route("/:id").put(auth, update);
router.route("/getByIdTokenInfo/:id").get(getByIdTokenInfo);
router.route("/getAdvertInfoByUser/:id").get(getAdvertInfoByUser);


module.exports = router;
