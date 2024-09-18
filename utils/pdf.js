const fs = require("fs");

const PDFDocument = require("pdfkit");
function generatePDF(fileName, message) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(fileName));

  doc.fontSize(12).text(message, {
    align: "left",
  });

  doc.end();
}

module.exports = { generatePDF };
