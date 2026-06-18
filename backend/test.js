const fs = require("fs");
const csv = require("csv-parser");

const results = [];

fs.createReadStream("./dataset/candidates.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", () => {
    console.log("Total Candidates:", results.length);

    if (results.length > 0) {
      console.log("Columns:");
      console.log(Object.keys(results[0]));
    } else {
      console.log("No data found in CSV");
    }
  })
  .on("error", (err) => {
    console.error(err);
  });
