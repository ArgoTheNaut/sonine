/**
 * Name:            index.js
 *
 * Author:          github.com/argothenaut
 *
 * Date Created:    01/03/2021
 * Date Modified:   12/20/2021
 *
 * Description:
 *      This program uses Discord and a google spreadsheet as endpoints.
 *      Inputs from discord messages are parsed into "queries" and executed on the spreadsheet.
 *
 */

/******************
 *  Dependencies  *
 ******************/

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const discordie = require("discordie");
const request = require("request");


/****************************
 *  spreadsheet row values  *
 ****************************/

const AUTHOR_ROW = 0;
const SONGNAME_ROW = 1;
const ALBUM_ROW = 2;
const MSONGID_ROW = 3;
const GENRE_ROW = 4;
const BPM_ROW = 5;
const ALBUMPOS_ROW = 6;
const LASTLISTENED_ROW = 7;

const PLAYS_ROW = 11;
const SONGID_ROW = 14;


String.prototype.replaceAll = function(search, replacement) {
    return this.replace(new RegExp(search, "g"), replacement);
};


/****************
 *  GOOGLE API  *
 ****************/

let sheets;
let credentials;
let spreadsheetData;
let spreadsheetDataTimeStamp = 0;
let SPREADSHEET_DATA_PUSH_PERIOD_MS = 5000;    //the time interval between checks to push data to the Spreadsheet

//"mutex" indicating that no other function should push/pull the current data in the job batch
let jobBatchMutexIsLocked = false;

//batch of jobs that should be executed regularly whenever the job batch is not empty
let jobBatch = [ ];


// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
let incrementSongByID = function (songID,e){
    //loops prompt if google API not resolved.
    setTimeout(()=>{
        incrementSongByID(songID,e);
        STDOUT("Awaiting to Process "+songID);
    },1000);
};

let STDOUT = function (songID){
    //loops prompt if google API not resolved.
    setTimeout(()=>{
        STDOUT(songID);
        console.log("Awaiting to Output "+songID);
    },1000);
};

let SONG_SPREADSHEET_ID = "1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g";
// Load client secrets from a local file.
fs.readFile('../tokens/googleCredentials.json', (err, content) => {
    if (err) {
        STDOUT('Error loading client secret file:');
        STDOUT(JSON.stringify(err));
        return
    }
    credentials = JSON.parse(content);
    // Authorize a client with credentials, then call the Google Sheets API.
    incrementSongByID = function(audioID,e){
        authorize(credentials,locateSong,audioID,e);
    };
});

let pushScheduler = setInterval(()=>{
    executeBatchUpdate();
}, SPREADSHEET_DATA_PUSH_PERIOD_MS);



/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, audioID,e) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client, audioID,e);
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
    STDOUT(`Authorize this app by visiting this url: ${authUrl}`);
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
                STDOUT(`Token stored to ${TOKEN_PATH}`);
            });
            callback(oAuth2Client);
        });
    });
}


function spreadsheetDataIsFresh(){
    return Date.now() - spreadsheetDataTimeStamp < 5000;
}

let fetchTime = 0;
function fetchFreshSpreadsheetData(auth){
    if(spreadsheetDataIsFresh()) return;
    if(Date.now() - fetchTime < 600){   //avoid multiple fetch requests
        return;
    }
    fetchTime = Date.now();

    if(!sheets) sheets = google.sheets({version: 'v4', auth});     //initialize the global variable the first time through
    sheets.spreadsheets.values.get({
        spreadsheetId: SONG_SPREADSHEET_ID,
        range: 'Wheres!A2:O',
    }, (err, res) => {
        if (err) return STDOUT('The API returned an error: ' + err);
        spreadsheetData = res;
        spreadsheetDataTimeStamp = Date.now();
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param audioID
 * @param e discord event message
 */
function locateSong(auth,audioID,e) {
    fetchFreshSpreadsheetData(auth);
    if (audioID.length < 4) return STDOUT("Error: audio ID length less than 4 characters. Returning.");
    let ret = {val: false};
    if(!spreadsheetDataIsFresh()){
        setTimeout(()=>{locateSong(auth, audioID, e)},100);
        return;
    }
    STDOUT(`> Processing  \`${audioID}\``);
    const rows = spreadsheetData.data.values;

    let content = e.message.content;
    let discord_message_tokens = content.split(" ");
    if (rows.length) {
        let i = 2;

        //adjustment for numerical multiplier
        let INCREMENTBY = 1;
        // console.log("Discord Message Tokens:  ",discord_message_tokens);
        // console.log("Discord Message Token 0: ",discord_message_tokens[0]);
        // console.log("Char at [1]:             ",discord_message_tokens[0][1]);
        if (discord_message_tokens.length > 1) {
            if (discord_message_tokens[0] - 0) {    //act only if first component is a number != 0

                let r = (audioID.toLowerCase().trim() === content.toLowerCase().trim());
                //console.log("r: ",r);

                INCREMENTBY = discord_message_tokens.shift() - 0;
                content = discord_message_tokens.join(" ");
                if (r) audioID = content.toLowerCase().trim();
            }
        }

        //adjustments for FIND and SET inputs.

        let INCREMENT = true;
        let modifier = content.split(" ")[0].toLowerCase(); //first word of content
        let SET_ID = undefined;
        if (modifier === "find" || modifier === "set") {
            INCREMENT = false;

            if (modifier === "set") {
                if (content.split(" ").length !== 3)
                    return STDOUT("Expected SET commands to have 3 word inputs of the form `SET M-0420 oue123j0Epo`.");
                SET_ID = content.split(" ")[1];
                audioID = content.split(" ")[2];
            }

        }

        // Iterate through objects.
        rows.map((row) => {

            //handle find-type messages
            if (modifier === "find") {
                if (row.join(" - ").toLowerCase().includes(content.substring("find ".length))) STDOUT(row);
                return;
            }

            //init song name equality
            let matching = row[SONGNAME_ROW].toLowerCase() === audioID.toLowerCase() || row[MSONGID_ROW] === audioID.toUpperCase();

            //check out a song only if the song has a defined URL or the audio ID input matches the song name
            if (row[SONGID_ROW] || matching || SET_ID) {

                //behavior for when using the SET modifier
                if (SET_ID) {
                    matching = false;
                    if (row[MSONGID_ROW].toLowerCase() === SET_ID.toLowerCase()) {
                        STDOUT("Set Match! Data will not be incremented.");
                        STDOUT(row);

                        //ADD YT ID TO OBJECT
                        audioID = URLtoID(audioID);
                        if (row[SONGID_ROW])
                            audioID = row[SONGID_ROW] + "," + audioID;
                        incrementSong(auth, i, [[row[PLAYS_ROW] - 0]], sheets, audioID);                           //TODO: don't clear old IDs
                        return;
                    }
                } else {
                    //normal case behavior to locate matches
                    if (!matching) {
                        if (row[SONGID_ROW].indexOf(audioID) > -1) matching = true;
                        let bits = row[SONGID_ROW].split(",");
                        for (let j in bits) {
                            if (matching) break;

                            // noinspection JSUnfilteredForInLoop
                            if (audioID.includes(bits[j]) && bits[j].length > 4) {
                                matching = true;
                            }
                        }
                    }
                }

                if (matching) {
                    if (INCREMENT) {
                        STDOUT(`__**Incrementing**__ ${row[AUTHOR_ROW]} - ${row[SONGNAME_ROW]} by ${INCREMENTBY}. New play count: ${row[PLAYS_ROW] - 0 + INCREMENTBY}`);
                        if (!e.message.deleted) e.message.delete();
                        ret.val = true;
                        incrementSong(auth, i, [[((row[PLAYS_ROW] - 0) + INCREMENTBY)]], sheets);
                    } else {
                        STDOUT(row);
                    }
                }
            }
            i++;
        });

        if (!ret.val && INCREMENT) {
            if (content.substring(0, 4) === "find") return STDOUT("Not querying YouTube on `find`");
            STDOUT("Failed to find song with YouTube ID " + audioID + " ...\nRequesting Data from YouTube to continue search.");
            addDatum(auth, audioID, sheets, rows);
        }
    } else {
        STDOUT('Failed on data retrieval for ' + audioID);
    }

    return ret;
}

//TODO handle songs which don't currently have their YT ID registered
function addDatum(auth,audioID,sheets,rows) {
    let params={
        uri: "https://www.youtube.com/watch?v="+audioID,
        timeout: 2000,
        followAllRedirects: true
    };

    request.get(params, function(error,response,body){
        if(error) return STDOUT(error);
        if(response.statusCode !== 200) return STDOUT("STATUS CODE: "+response.statusCode);
        let titleIDX = body.indexOf("<title>")+"<title>".length;
        let targetTitle = body.substring(titleIDX);
        targetTitle = targetTitle.substring(0,targetTitle.indexOf("</title>")).toLowerCase();

        if(targetTitle.length<8)return STDOUT("Failed to find match.  Bad title.");
        STDOUT("Unformatted target Title: `"+targetTitle+"`");

        while(targetTitle.includes("&#39;")){
            targetTitle = targetTitle.replace("&#39;","'");
        }

        let unformattedTitle = targetTitle;



        targetTitle = targetTitle.replace("- youtube","");        //format hypothetical "target" title
        targetTitle = targetTitle.substring(targetTitle.indexOf("-") + 1);            //targetTitle = endLimit(targetTitle,"|");
        if(!targetTitle.includes("(")) {
            let blockStart = body.indexOf("ytd-channel-name");
            let authBlock = body.substring(blockStart);
            authBlock = authBlock.substring(0,authBlock.indexOf("</a>"));
            while(authBlock.includes(">"))
                authBlock=authBlock.substring(1);
        }
        targetTitle = endLimit(targetTitle,"(");
        targetTitle = endLimit(targetTitle,"[");
        targetTitle = targetTitle.trim().toLowerCase();



        let matches = [];

        for(let i in rows){
            if(rows[i][AUTHOR_ROW].length<1)continue;
            let songNameWords = rows[i][SONGNAME_ROW].toLowerCase().split(" ");
            for(let j in songNameWords){
                if(songNameWords[j]==="the" || songNameWords[j]==="in" || songNameWords[j]==="a") continue;

                if(songNameWords[j].length > 2 && unformattedTitle.includes(songNameWords[j])){
                    matches.push(i);
                    break; //should break j loop
                }
            }
        }

        STDOUT(`Formatted:\r\n> author: \`${unformattedTitle}\`\r\n> title: \`${targetTitle}\``);
        STDOUT(`Found ${matches.length} potential matches`);

        if(matches.length>1){
            for(let i in matches){  //fuzzy evaluation of closest match
                let idx = matches[i];
                let songNameWords = rows[idx][SONGNAME_ROW].toLowerCase().split(" ");
                matches[i] = {
                    idx:idx,
                    entryConfidence:0
                };
                for(let j in songNameWords){
                    if(unformattedTitle.includes(songNameWords[j]))
                        matches[i].entryConfidence++;
                }

                if(unformattedTitle.includes(rows[idx][SONGNAME_ROW].toLowerCase())){
                    matches[i].entryConfidence+=20;
                }

                if(unformattedTitle.includes(rows[idx][AUTHOR_ROW].toLowerCase())){
                    matches[i].entryConfidence+=15;
                }

                //Where the album title exists and is in the song title, add heavy weight to such cases
                if(rows[idx][ALBUM_ROW].toLowerCase().length && unformattedTitle.includes(rows[idx][ALBUM_ROW].toLowerCase())){
                    matches[i].entryConfidence+=25;
                }

                //constrain to >1 terms to try to filter output stream quality a little bit
                if(matches[i].entryConfidence > 1)
                    STDOUT(`Similarity score: ${matches[i].entryConfidence}. Similarity at index ${idx} ${JSON.stringify(rows[idx])}.`);

            }

            matches.sort((a,b)=>{return b.entryConfidence - a.entryConfidence;});   //sort by greatest common song name terms, non-increasing order

            STDOUT(`Closest match: ${rows[matches[0].idx][AUTHOR_ROW]} - ${rows[matches[0].idx][SONGNAME_ROW]}`);

            //if the song name term
            if(matches[0].entryConfidence < rows[matches[0].idx][SONGNAME_ROW].split(" ").length/2){
                STDOUT("INSUFFICIENT CONFIDENCE IN ANSWER.  PLEASE USE SET TO MANUALLY ADD THIS DATUM.");
                STDOUT(JSON.stringify(rows[matches[0].idx]));
                return;
            }

            matches = [matches[0].idx]; //reduce evaluated data down to the array index of the best matching entry
        }

        if(matches.length === 1){
            let i = matches[0]-0;
            let audioIDChange;
            STDOUT(`__**Incrementing**__ best match: ${JSON.stringify(rows[i])}.`);
            if(rows[i][SONGID_ROW]===undefined) audioIDChange=audioID;
            else audioIDChange = rows[i][SONGID_ROW]+","+audioID;
            incrementSong(auth, i+2,[[rows[i][PLAYS_ROW]-0+1]],sheets,audioIDChange);
        }

        if(matches.length === 0){
            STDOUT("No matches found");
        }
    });
}

function incrementSong(auth, position, newVal, sheets, audioID) {
    //clean up redundancies in audioID during any audioID changes
    if(audioID !== undefined) {
        STDOUT(`Audio ID field set to: ${audioID}`);
        let audioIDlist = audioID.split(",");
        let uniqueIDs = {};
        for (let i in audioIDlist) {
            uniqueIDs[audioIDlist[i]] = true;
        }
        let keys = Object.keys(uniqueIDs);
        audioID = keys.join(",");
        if (keys.length < audioIDlist.length) STDOUT(`Unique IDs reduced from ${audioIDlist.length} to ${keys.length} IDs.`);
    }


    if(jobBatchMutexIsLocked){
        setTimeout(() => {
            incrementSong(auth, position, newVal, sheets, audioID);
        }, 50);
        return;
    }

    //push new data to job batch
    jobBatchMutexIsLocked = true;
    jobBatch.push({//new play count
        range: 'L' + position,          // The A1 notation of the values to update.
        values: newVal                  // The new 2D array value to be set for the cell.
    });

    jobBatch.push({//new request date
        range: 'H' + position,
        values: [[70 * 365.25 + 1.33330 - 1 / 24 + Date.now() / 1000 / 3600 / 24]]
    });

    if(audioID) {
        jobBatch.push({//new audio ID list
            range: 'O' + position,
            values: [[audioID]]
        });
    }
    jobBatchMutexIsLocked = false;
}

//periodically execute pushes to the spreadsheet
function executeBatchUpdate(){
    if(jobBatchMutexIsLocked) return;

    //pull in data from global batch accumulation array
    jobBatchMutexIsLocked = true;
    let dataSet = jobBatch;
    jobBatch = [ ];
    jobBatchMutexIsLocked = false;

    if(dataSet.length === 0) return;    //nothing to update -> don't bother the API

    //acquire fresh authorization
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH).toString()));


    let batchRequestBody = {
        spreadsheetId: SONG_SPREADSHEET_ID,
        resource: {
            valueInputOption: 'RAW',                // How the input data should be interpreted.
            data: dataSet,
        },
        auth: oAuth2Client,
    };

    const response = sheets.spreadsheets.values.batchUpdate(batchRequestBody).data;

    if(response) STDOUT(`Response: ${response}`);
}




/*************
 *  DISCORD  *
 *************/


const client = new discordie({autoReconnect:true});
const events = discordie.Events;

var discordTokenFilePath = "..\\tokens\\SonineDiscord.txt";
if(!fs.existsSync(discordTokenFilePath)){
    console.error(`Missing discord bot access token.  Please acquire the token at <URL> and save the token under ${discordTokenFilePath}`);
    process.exit(8);
}
const token = fs.readFileSync(discordTokenFilePath).toString();

client.connect({token: token});


let STDOUTQUEUE = [];
client.Dispatcher.on(events.GATEWAY_READY, e => {
    console.log("Connected to Discord as "+client.User.username);
    STDOUT = function (msg) {
        console.log(msg);
        if(typeof(msg)==="object") msg = JSON.stringify(msg);

        if(msg) {
            STDOUTQUEUE.push(msg);
        }else{
            console.log("attempted to output: ", msg);
        }
    };

    setInterval(() => {
        if(STDOUTQUEUE.length){
            let msg = STDOUTQUEUE.shift();
            while(msg.length < 2000 && STDOUTQUEUE.length){
                msg += "\r\n\r\n"+STDOUTQUEUE.shift();
            }

            if(msg.length>2000){
                let remnant = msg.substring(2000);
                while(remnant.length){
                    client.Channels.get("789915834385825802").sendMessage(msg.substring(0,2000));
                    msg = remnant;
                    remnant = msg.substring(2000);
                }
            }
            client.Channels.get("789915834385825802").sendMessage(msg);
        }
    }, 250);
    STDOUT("HELLO THERE");
});



/**
 * State of the code:
 * 51/01/03
 * Basic functionality of increment action upon known URLs implemented
 * Roadmap:  Use `request` to fetch titles of unknown youtube songs to automatically populate spreadsheet with new data.
 */

client.Dispatcher.on(events.MESSAGE_CREATE, e => {
    //console.log("Received message: "+e.message.content);
    let author = e.message.author;
    //use of this bot is for argo only.
    if(author.id !== "162952008712716288" && author.id !=="263474950181093396") return;
    let contents = e.message.content.split("\n");

    for(let i in contents) {
        let content = contents[i];
        //URL parsing
        setTimeout(() => {incrementSongByID(URLtoID(content), e);}, i * 250);
    }
});

function URLtoID(url){
    let content = url;
    content = startLimit(content,"v=");
    content = startLimit(content,".be/");
    content = endLimit(content,"&");
    content = endLimit(content,"?");
    return content;
}

function endLimit(content,tail){
    if(content.includes(tail)){
        return content.substring(0,content.indexOf(tail));
    }
    return content;
}

function startLimit(content,head){
    if(content.includes(head)) {
        return content.substring(content.indexOf(head) + head.length);
    }
    return content;
}