
db = db.getSiblingDB("telegram-bot");
db.createUser({
  user: "root",
  pwd: "root",
  roles: [{ role: 'readWrite', db: "telegram-bot" }],
});