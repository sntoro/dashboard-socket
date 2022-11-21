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

    new sql.Request().query(
      "EXEC zsp_get_jig_need_preventive",
      (err, result) => {

        let jig_data = null;
        for (let index = 0; index < result.recordset.length; ++index) {
          const element = result.recordset[index];

          if(element.stat == 1){
            var color = '#403E10';
            var background = '#FFF842';
          }else{
            var color = '#FFFFFF';
            var background = '#FF1E1E';
          }

          jig_data += "<tr style='font-weight: 600'>" +
            "<td style='background:"+ background +";color:"+ color +"'>"+element.work_center+"</td>" +
            "<td>"+element.code+"</td>" +
            "<td>"+element.name+"</td>" +
            "<td>"+element.model+"</td>" +
            "<td>"+element.stroke+"</td>" +
            "</tr>";
        }
        io.emit("TORO/TEST3", jig_data);

        if (err) {
          console.log(err);
          return;
        }

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
