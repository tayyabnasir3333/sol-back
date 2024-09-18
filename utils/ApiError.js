class ApiError {
  constructor(statusCode, message) {
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.error = true;
  }
}

module.exports = ApiError;
