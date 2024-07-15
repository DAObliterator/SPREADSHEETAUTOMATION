const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const express = require("express");
const process = require("process");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const PDFDocument = require("pdfkit");
const cors = require("cors");

const app = express();

app.use(express.json());

app.use(cors({
   origin: process.env.NODE_ENV === "development" ? process.env.CLIENT_URL_DEV : process.env.CLIENT_URL_PROD,
   credentials: true,
   methods: "GET,POST,PUT,DELETE"
}))


// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */

app.get("/", (req, res) => {
  res.send("<h1>Welcome</h1>");
});

app.get("/responses", (req, res) => {
   
});

app.get("/getPdf", async (req, response) => {
  console.log("get request received to /getPdf endpoint ... ");

  let rowsArray = [];
  let formResponseTemplate = {};
  let formResponsesArray = [];

  async function listMajors(auth) {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: "1n_0_QI6q3LJK55psczLRlc_my8ecztkm15bXb49hdW4",
      range: "O1:O21",
    });

    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: "1n_0_QI6q3LJK55psczLRlc_my8ecztkm15bXb49hdW4",
      range: "A1:BQ1",
    });

    const rows = res.data.values;
    const rows2 = res2.data.values;
    if (!rows || rows.length === 0) {
      console.log("No data found.");
      return;
    }

    rows.forEach((row, index) => {
      if (row[0] === "REPORT OF ACCIDENT OF DANGEROUS OCCURRENCE_FORM XII") {
        console.log(`${row[0]} , ${index}`);

        rowsArray.push(index + 1);
      }
    });

    //create an array of Objects in which the key is question and the value the answer for now an empty string

    //console.log(`${rows2[0]}  --- used to make formResponseTemplate`)


    rows2[0].forEach((item, index) => {

     

      if (Object.keys(formResponseTemplate).includes(item)) {

        let copyOne = `${item}-1`
        formResponseTemplate[copyOne] = "";

      } else {
        formResponseTemplate[item] = "";
      }

      



      
    });

    Object.keys(formResponseTemplate).forEach((item , index) => {
      console.log(`Q${index}.  ${item} \n`)
    })

    // formResponseTemplate --- this is to be used while generating the form filled with responses , this will be the question

    await Promise.all(
      rowsArray.map(async (item , index_ ) => {
        const curr_res = await sheets.spreadsheets.values.get({
          spreadsheetId: "1n_0_QI6q3LJK55psczLRlc_my8ecztkm15bXb49hdW4",
          range: `${"A" + item.toString() + ":" + "BQ" + item.toString()}`,
        });

        let curr_row = curr_res.data.values;
        let currForm = {};

        if ( index_ === 0 ) {
          //console.log(curr_row[0] , " ---curr_row[0] \n");
          //console.log(formResponseTemplate , " ---formResponseTemplate \n")
        }

        

        Object.keys(formResponseTemplate).forEach((question, index) => {


         
          
          /*if (
            curr_row[0][index] === ""
          ) {
            currForm[question] = "NO ENTRY";
          } else {
            currForm[question] = curr_row[0][index];
          }*/

            /*if ( index_ === 0) {
              console.log(
                `Q${index}. ${question} ${typeof curr_row[0][index]}  ANS --- ${
                  curr_row[0][index]
                } \n`
              );
            }*/

              currForm[question] = curr_row[0][index];

            
          
          

          
            
          
          
        });

        formResponsesArray.push(currForm);

        const doc = new PDFDocument;

        formResponsesArray.forEach((formResponse , index) => {

          doc.addPage({ size: "A4"});

          doc.addPage({
            margin: 50,
          });

          doc.text(`RESPONSE ${index}`, {
            height: "100",
            width: "465",
          });

          Object.keys((formResponse)).forEach((question , index ) => {

            
            
            if (
              formResponse[question] !== undefined &&
              formResponse[question] !== ""
            ) {
              doc.text(`Q${index}. ${question}`, {
                width: "420",
                align: "center",
                underline: true,
              });

              doc.moveDown();

              doc.text(`Ans. ${formResponse[question]}`, {
                width: "410",
                align: "center",
              });

              doc.moveDown();
            }
            

          })

        })

         doc.pipe(fsSync.createWriteStream("./output.pdf"));

         doc.end()


      })
    );

    //console.log(formResponsesArray, " formResponsesArray Inside listMajors function ");
    

    
  };

   console.log(
     formResponsesArray,
     " formResponsesArray outside listMajors function "
   );
  

  
  authorize()
    .then(listMajors)
    .catch((error) => {
      console.error("Error in processing:", error);
      response.status(500).json({ error: "Internal Server Error" });
    });
  
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`app listening on ${PORT}`);
});
