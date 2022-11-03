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
      "SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) ACTUAL FROM  \n\
      ( SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' GROUP BY CHR_PART_NO) AS D) AS DD \n\
      JOIN  \n\
      (SELECT 'P/N' AS [DESC], COUNT(CHR_PART_NO) REMAIN FROM  \n\
      ( SELECT CHR_PART_NO FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN'  GROUP BY CHR_PART_NO) AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC] \n\
      UNION \n\
      SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) ACTUAL FROM  \n\
      ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' GROUP BY CHR_NOPO_CUST) AS D) AS DD \n\
      JOIN  \n\
      (SELECT 'PO' AS [DESC], COUNT(CHR_NOPO_CUST) REMAIN FROM  \n\
      ( SELECT CHR_NOPO_CUST FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN'  GROUP BY CHR_NOPO_CUST) AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC] \n\
      UNION \n\
      SELECT AA.[DESC], ACTUAL + REMAIN AS [PLAN], ACTUAL, REMAIN FROM \n\
      (SELECT 'QTY' AS [DESC], SUM(INT_QTY) ACTUAL FROM  \n\
      ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 1 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN') AS D) AS DD \n\
      JOIN  \n\
      (SELECT 'QTY' AS [DESC], SUM(INT_QTY) REMAIN FROM  \n\
      ( SELECT SUM(INT_QTY) AS INT_QTY FROM TT_PO_FAMILY_UPLOAD WHERE CHR_STATUS = 0 AND CHR_MONTH = '202211' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN') AS A) AS AA \n\
      ON AA.[DESC] = DD.[DESC] \n\
      ",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/DETAIL/EXPORT/TABLE", result.recordset);
      }
    );

    new sql.Request().query(
      "SELECT CHR_CONTAINER_CODE , MAX(INT_NOPALLET) ACT, INT_QTY_CONTAINER_MAX PLN, ROUND(CONVERT(FLOAT,MAX(INT_NOPALLET)) / CONVERT(FLOAT,INT_QTY_CONTAINER_MAX) * 100,1) PERC  FROM TT_CONTAINER_SIZE CON LEFT JOIN TT_PACKING_UPLOAD UP \n\
      ON CON.CHR_CONTAINER_CODE = CHR_ADD_CODE AND CON.CHR_NOPO_FAMILY = UP.CHR_NOPO_FAMILY \n\
      WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' AND CHR_PREPARE_STATUS = 1 \n\
      GROUP BY INT_QTY_CONTAINER_MAX, CON.CHR_CONTAINER_CODE  \n\
      ORDER BY CHR_CONTAINER_CODE",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/DETAIL/EXPORT/PREPARATION", result.recordset);
      }
    );

    new sql.Request().query(
      "SELECT A.CHR_ADD_CODE CHR_CONTAINER_CODE, COUNT(INT_NOPALLET) AS ACT, ISNULL(C.PALL, 0) AS PLN, \n\
      ROUND((CAST(ISNULL(C.PALL, 0) AS FLOAT) / CAST(COUNT(INT_NOPALLET) AS FLOAT))*100,1) AS PERC \n\
      FROM TT_PACKING_UPLOAD A \n\
      LEFT JOIN (SELECT COUNT(INT_NOPALLET) AS PALL, CHR_ADD_CODE  \n\
      FROM TT_PACKING_UPLOAD \n\
      WHERE CHR_STAT = '1' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
      GROUP BY CHR_ADD_CODE) C ON A.CHR_ADD_CODE = C.CHR_ADD_CODE \n\
      WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
      GROUP BY A.CHR_ADD_CODE, C.PALL \n\
      ORDER BY A.CHR_ADD_CODE",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/DETAIL/EXPORT/READY", result.recordset);
      }
    );

    new sql.Request().query(
      ";WITH CTE ( CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT_PALLET, CHR_CUST_NAME_ALIAS)  AS ( \n\
        SELECT CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT(INT_NOPALLET) AS PALL, CHR_CUST_NAME_ALIAS FROM TT_PACKING_UPLOAD \n\
        WHERE CHR_STAT = '1' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN'  \n\
        AND CHR_IDPALLET IN ( \n\
          SELECT RTRIM(CHR_BARCODE) FROM TT_HISTORY_SCAN_PALLET X \n\
          LEFT JOIN TT_DELIVERY Y ON X.CHR_DEL_NO = Y.CHR_DEL_NO \n\
          WHERE Y.CHR_GI_DEL = 'C' \n\
          AND X.CHR_BARCODE IN ( \n\
            SELECT RTRIM(CHR_IDPALLET)  \n\
            FROM TT_PACKING_UPLOAD WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
            GROUP BY RTRIM(CHR_IDPALLET)  \n\
            ) \n\
          GROUP BY RTRIM(CHR_BARCODE) \n\
        ) GROUP BY CHR_ADD_CODE, CHR_CUST_NAME_ALIAS, CHR_NOPO_FAMILY \n\
      ),  \n\
      CTE_PACKING_UPLOAD ( CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT_PALLET, CHR_CUST_NAME_ALIAS ) AS ( \n\
        SELECT CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT(INT_NOPALLET), CHR_CUST_NAME_ALIAS \n\
        FROM TT_PACKING_UPLOAD \n\
        WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
        GROUP BY CHR_NOPO_FAMILY, CHR_ADD_CODE, CHR_CUST_NAME_ALIAS \n\
      ) \n\
      SELECT A.CHR_ADD_CODE AS CHR_CONTAINER_CODE, SUM(A.COUNT_PALLET) AS ACT, SUM(ISNULL(C.COUNT_PALLET,0)) AS PLN,  \n\
      ROUND((CAST(SUM(ISNULL(C.COUNT_PALLET,0)) AS FLOAT)/CAST(SUM(A.COUNT_PALLET) AS FLOAT))*100,2) AS PERC  \n\
      FROM CTE_PACKING_UPLOAD A LEFT JOIN CTE C  \n\
      ON A.CHR_CUST_NAME_ALIAS = C.CHR_CUST_NAME_ALIAS AND A.CHR_NOPO_FAMILY = C.CHR_NOPO_FAMILY AND A.CHR_ADD_CODE = C.CHR_ADD_CODE \n\
      GROUP BY A.CHR_ADD_CODE ORDER BY A.CHR_ADD_CODE",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/DETAIL/EXPORT/DELIVERED", result.recordset);
      }
    );
    
    new sql.Request().query(
      "SELECT ROUND(CONVERT(FLOAT,SUM(UPL.INT_QTY)) / CONVERT(FLOAT,SUM(FAM.INT_QTY)) * 100,2) AS PREP_EXP FROM TT_PO_FAMILY_UPLOAD FAM LEFT JOIN TT_PACKING_UPLOAD UPL \n\
      ON FAM.CHR_NOPO_FAMILY = UPL.CHR_NOPO_FAMILY AND FAM.CHR_CUST_NAME_ALIAS = UPL.CHR_CUST_NAME_ALIAS \n\
      WHERE FAM.CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' AND CHR_PREPARE_STATUS = 1\n\
      GROUP BY FAM.CHR_CUST_NAME_ALIAS",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/SUMMARY/EXPORT/PREPARATION", result.recordset);
      }
    );

    new sql.Request().query(
      "SELECT ROUND((CAST(ISNULL(C.PALL, 0) AS FLOAT) / CAST(COUNT(INT_NOPALLET) AS FLOAT))*100,2) AS PREP_EXP \n\
      FROM TT_PACKING_UPLOAD A LEFT JOIN  \n\
      (SELECT CHR_CUST_NAME_ALIAS, COUNT(INT_NOPALLET) AS PALL FROM TT_PACKING_UPLOAD \n\
      WHERE CHR_STAT = '1' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' GROUP BY CHR_CUST_NAME_ALIAS) C  \n\
      ON A.CHR_CUST_NAME_ALIAS = C.CHR_CUST_NAME_ALIAS \n\
      WHERE A.CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' GROUP BY C.PALL",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/SUMMARY/EXPORT/READY", result.recordset);
      }
    );

    new sql.Request().query(
      ";WITH CTE ( CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT_PALLET, CHR_CUST_NAME_ALIAS)  AS ( \n\
        SELECT CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT(INT_NOPALLET) AS PALL, CHR_CUST_NAME_ALIAS FROM TT_PACKING_UPLOAD \n\
        WHERE CHR_STAT = '1' AND CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN'  \n\
        AND CHR_IDPALLET IN ( \n\
          SELECT RTRIM(CHR_BARCODE) FROM TT_HISTORY_SCAN_PALLET X \n\
          LEFT JOIN TT_DELIVERY Y ON X.CHR_DEL_NO = Y.CHR_DEL_NO \n\
          WHERE Y.CHR_GI_DEL = 'C' \n\
          AND X.CHR_BARCODE IN ( \n\
            SELECT RTRIM(CHR_IDPALLET)  \n\
            FROM TT_PACKING_UPLOAD WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
            GROUP BY RTRIM(CHR_IDPALLET)  \n\
            ) \n\
          GROUP BY RTRIM(CHR_BARCODE) \n\
        ) GROUP BY CHR_ADD_CODE, CHR_CUST_NAME_ALIAS, CHR_NOPO_FAMILY \n\
      ),  \n\
      CTE_PACKING_UPLOAD ( CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT_PALLET, CHR_CUST_NAME_ALIAS ) AS ( \n\
        SELECT CHR_NOPO_FAMILY, CHR_ADD_CODE, COUNT(INT_NOPALLET), CHR_CUST_NAME_ALIAS \n\
        FROM TT_PACKING_UPLOAD \n\
        WHERE CHR_CUST_NAME_ALIAS = 'OGAWA JAPAN' \n\
        GROUP BY CHR_NOPO_FAMILY, CHR_ADD_CODE, CHR_CUST_NAME_ALIAS \n\
      ) \n\
      SELECT ROUND((CAST(SUM(ISNULL(C.COUNT_PALLET,0)) AS FLOAT)/CAST(SUM(A.COUNT_PALLET) AS FLOAT))*100,2) AS PREP_EXP \n\
      FROM CTE_PACKING_UPLOAD A LEFT JOIN CTE C  \n\
      ON A.CHR_CUST_NAME_ALIAS = C.CHR_CUST_NAME_ALIAS AND A.CHR_NOPO_FAMILY = C.CHR_NOPO_FAMILY AND A.CHR_ADD_CODE = C.CHR_ADD_CODE",
      (err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        io.emit("PPIC/SUMMARY/EXPORT/DELIVERED", result.recordset);
      }
    );


  });
  sql.on("error", (err) => {
    console.error(err);
  });
}, 10000);

io.on("connection", (client) => {});

server.listen(process.env.PORT_EXVISUAL, function () {
  console.log("running on: " + process.env.URL + ":" + process.env.PORT_EXVISUAL);
});
