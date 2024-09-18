const getFullName = (ctx) => {
  const { first_name, last_name } = ctx.from;
  return first_name + " " + last_name;
};
const getUserName = (ctx) => {
  const { username } = ctx.from;
  return username;
};

module.exports = { getFullName, getUserName };
