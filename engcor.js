require("dotenv").config();
const http = require("http");
const express = require("express");
const sql = require("mssql");
const app = (module.exports.app = express());
const server = http.createServer(app);
const io = require("socket.io")(server);
app.use(express.static("public"));

app.get("/engcor", function (req, res) {
  res.sendFile("dashboard-eng-corner.html", { root: __dirname });
});

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  server: process.env.DB_HOST,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs
  },
};

setInterval(function () {
  sql.connect(sqlConfig, (err) => {
    if (err) {
      console.log(err);
      return;
    }

    new sql.Request().query(
      "EXEC zsp_get_engineering_corner_summary",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("TORO/TEST2", result.recordset);
      }
    );
  });

  sql.on("error", (err) => {
    console.error(err);
  });
}, 10000);

io.on("connection", (client) => {});

server.listen(process.env.PORT_ENGCOR, function () {
  console.log("running on: " + process.env.URL + ":" + process.env.PORT_ENGCOR);
});
