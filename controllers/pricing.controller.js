const Pricing = require("../models/pricing.model");
const transactionModel = require("../models/transaction.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res, next) => {
  const { publications, price, discount, status } = req.body;

  const pricing = await Pricing.create({
    createdBy: req.user._id,
    publications,
    price,
    discount,
    status,
  });

  return res
    .status(201)
    .json(new ApiResponse(200, pricing, "Pricing created successfully"));
});

const getAll = asyncHandler(async (req, res, next) => {
  const result = await Pricing.find().populate("createdBy");
  return res.status(201).json(new ApiResponse(200, result, "Pricing list"));
});

const getById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await Pricing.findById(id);
  if (!result) {
    return res.status(409).json(new ApiError(409, "Pricing does not exists"));
  }
  return res.status(201).json(new ApiResponse(200, result, "Pricing by id"));
});

const update = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { price, isPaused, status, publications } = req.body;
  const result = await Pricing.findById(id);
  if (!result) {
    return res.status(409).json(new ApiError(409, "Pricing does not exists"));
  }
  await Pricing.findOneAndUpdate(
    { _id: id },
    { price, isPaused, status, publications },
  );

  return res
    .status(201)
    .json(new ApiResponse(200, result, "Pricing updated successfully"));
});

const deleteData = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await Pricing.findById(id);
  if (!result) {
    return res.status(409).json(new ApiError(409, "Pricing does not exists"));
  }
  await Pricing.findByIdAndDelete({ _id: id });

  return res
    .status(201)
    .json(new ApiResponse(200, result, "Pricing delete successfully"));
});

const transactionHistory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await await transactionModel
    .find({ advertisementId: id })
    .populate(["userId", "walletId", "advertisementId"])
    .sort({ date: -1 });
  return res
    .status(201)
    .json(
      new ApiResponse(200, result, "Transaction history shown successfully"),
    );
});
module.exports = {
  create,
  getAll,
  getById,
  update,
  deleteData,
  transactionHistory,
};
