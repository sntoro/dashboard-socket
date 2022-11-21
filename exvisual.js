require("dotenv").config();
const http = require("http");
const express = require("express");
const sql = require("mssql");
const app = (module.exports.app = express());
const server = http.createServer(app);
const io = require("socket.io")(server);
app.use(express.static("public"));

app.get("/exvisual", function (req, res) {
  res.sendFile("dashboard-exp-visualization.html", { root: __dirname });
});

const db_config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  server: process.env.DB_HOST,
  connectionLimit: 10,
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

async function connectDB() {
  const pool = new sql.ConnectionPool(db_config);
  try {
    await pool.connect();
    // console.log("Connected to database");
    return pool;
  } catch (err) {
    console.log("Database connection failed!", err);
    return err;
  }
}

async function execute() {
  const connection = await connectDB();
  let period = "202211";
  let customer = "OGAWA JAPAN";
  let customer_ae = "OGAWA AE";

  try {
    //OGAWA JAPAN
    let detail_export = await connection.request()
      .query(`SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
    (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) ACTUAL FROM  \n\
    (SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}' GROUP BY CHR_PART_NO) AS D) AS DD \n\
    JOIN \n\
    (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) REMAIN FROM  \n\
    ( SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}'  GROUP BY CHR_PART_NO) AS A) AS AA \n\
    ON AA.[DESC] = DD.[DESC] \n\
    UNION \n\
    SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
    (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) ACTUAL FROM  \n\
    ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}' GROUP BY CHR_NOPO_CUST) AS D) AS DD \n\
    JOIN  \n\
    (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) REMAIN FROM  \n\
    ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}'  GROUP BY CHR_NOPO_CUST) AS A) AS AA \n\
    ON AA.[DESC] = DD.[DESC] \n\
    UNION \n\
    SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
    (SELECT 'QTY' AS [DESC], SUM(INT_QTY) ACTUAL FROM  \n\
    ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}') AS D) AS DD \n\
    JOIN  \n\
    (SELECT 'QTY' AS [DESC], SUM(INT_QTY) REMAIN FROM  \n\
    ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer}') AS A) AS AA \n\
    ON AA.[DESC] = DD.[DESC]`);

        //OGAWA AE
    let detail_export_ae = await connection.request()
        .query(`SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) ACTUAL FROM  \n\
      (SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}' GROUP BY CHR_PART_NO) AS D) AS DD \n\
      JOIN \n\
      (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) REMAIN FROM  \n\
      ( SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}'  GROUP BY CHR_PART_NO) AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC] \n\
      UNION \n\
      SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) ACTUAL FROM  \n\
      ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}' GROUP BY CHR_NOPO_CUST) AS D) AS DD \n\
      JOIN  \n\
      (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) REMAIN FROM  \n\
      ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}'  GROUP BY CHR_NOPO_CUST) AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC] \n\
      UNION \n\
      SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'QTY' AS [DESC], SUM(INT_QTY) ACTUAL FROM  \n\
      ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}') AS D) AS DD \n\
      JOIN  \n\
      (SELECT 'QTY' AS [DESC], SUM(INT_QTY) REMAIN FROM  \n\
      ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '${period}' AND CHR_CUST_NAME_ALIAS = '${customer_ae}') AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC]`);

    let detail_preparation = await connection.request()
      .execute("zsp_get_preparation_detail_export_delivery_ogawa");

    let detail_readiness = await connection
      .request()
      .execute("zsp_get_readiness_detail_export_delivery_ogawa");

    let detail_delivered = await connection.request()
      .execute("zsp_get_delivered_detail_export_delivery_ogawa");

    let summary = await connection
      .request()
      .execute("zsp_get_progress_export_delivery_ogawa");

    io.emit("PPIC/DETAIL/EXPORT/TABLE/JAPAN", detail_export.recordset);
    io.emit("PPIC/DETAIL/EXPORT/TABLE/AE", detail_export_ae.recordset);

    io.emit("PPIC/DETAIL/EXPORT/PREPARATION/OGAWA",detail_preparation.recordset);
    io.emit("PPIC/DETAIL/EXPORT/READY/OGAWA", detail_readiness.recordset);
    io.emit("PPIC/DETAIL/EXPORT/DELIVERED/OGAWA", detail_delivered.recordset);

    io.emit("PPIC/SUMMARY/EXPORT/OGAWA", summary.recordset);
  } catch (err) {
    console.log("Error querying database", err);
    return err;
  } finally {
    connection.close();
  }
}

setInterval(function () {
  execute();
}, 10000);

io.on("connection", (client) => {});

server.listen(process.env.PORT_EXVISUAL, function () {
  console.log(
    "running on: " + process.env.URL + ":" + process.env.PORT_EXVISUAL
  );
});
