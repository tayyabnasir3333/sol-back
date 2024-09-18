const Joi = require("joi");
const ApiError = require("../utils/ApiError");
module.exports = function (req, res, next) {
  const schema = Joi.object({
    commission: Joi.string().required(),
    level: Joi.number().integer().min(1).required(),
    status: Joi.boolean(),
  });

  const { error } = schema.validate(req.body);

  function removeTags(input) {
    return input.replace(/"[^>]*"/g, error.details[0].context.key);
  }
  if (error) {
    return res
      .status(400)
      .json(new ApiError(400, removeTags(error.details[0].message)));
  }
  next();
};
