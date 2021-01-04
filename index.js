const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

//GOOGLE API UNDERBELLY.
//Use function incrementSongByID(audioID) to run.

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
let incrementSongByID = function (songID){
    //loops prompt if google API not resolved.
    setTimeout(()=>{
        incrementSongByID(songID);
        console.log("Awaiting to Process "+songID);
    },1000);
};

// Load client secrets from a local file.
fs.readFile('../credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    //authorize(JSON.parse(content), locateSong, "_O3awC4mv4Q");
    incrementSongByID = function(audioID){
        authorize(JSON.parse(content),locateSong,audioID);
    };
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, audioID) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client, audioID);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function locateSong(auth,audioID) {
    const sheets = google.sheets({version: 'v4', auth});
    //console.log("\nANYTHING\n"+JSON.stringify(sheets));
    sheets.spreadsheets.values.get({
        spreadsheetId: '1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g',
        range: 'Wheres!A2:O',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
            //console.log('Author - Song,\tID:');
            // Print columns                A and E, which correspond to indices 0 and 4.
            let i=2;
            rows.map((row) => {
                //console.log(`${row[0]} - ${row[1]},\t${row[14]}`);
                if(row[14] && row[14].indexOf(audioID) > -1){
                    console.log(`Incrementing ${row[0]} - ${row[1]}`);
                    return incrementSong(auth,i,[[((row[11]-0)+1)]],sheets);
                }
                i++;
            });
            //console.log('Failed to find '+audioID);
        } else {
            console.log('Failed on '+audioID);
        }
    });
}

function incrementSong(auth, position,newVal,sheets) {

    const request = {
        // The ID of the spreadsheet to update.
        spreadsheetId: '1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g',  // TODO: Update placeholder value.

        // The A1 notation of the values to update.
        range: 'L' + position,  // TODO: Update placeholder value.

        // How the input data should be interpreted.
        valueInputOption: 'RAW',  // TODO: Update placeholder value.

        resource: {
            values: newVal,
            // TODO: Add desired properties to the request body. All existing properties
            // will be replaced.
        },

        auth: auth,
    };
    const requestDate = {
        // The ID of the spreadsheet to update.
        spreadsheetId: '1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g',  // TODO: Update placeholder value.

        // The A1 notation of the values to update.
        range: 'H' + position,  // TODO: Update placeholder value.

        // How the input data should be interpreted.
        valueInputOption: 'RAW',  // TODO: Update placeholder value.

        resource: {
            values: [[70*365.25+1.33330-1/24+Date.now()/1000/3600/24]],
            // TODO: Add desired properties to the request body. All existing properties
            // will be replaced.
        },

        auth: auth,
    };

    try {
        const response = (sheets.spreadsheets.values.update(request)).data;
        const responseDate = (sheets.spreadsheets.values.update(requestDate)).data;
        // TODO: Change code below to process the `response` object:
        console.log(JSON.stringify(response, null, 2));
    } catch (err) {
        console.error(err);
    }

}












incrementSongByID("ntG_EEfpasM");


