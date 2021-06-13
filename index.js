const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const discordie = require("discordie");
const request = require("request");

//spreadsheet row values
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

//GOOGLE API

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
fs.readFile('../credentials.json', (err, content) => {
    if (err) return STDOUT('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    //authorize(JSON.parse(content), locateSong, "_O3awC4mv4Q");
    incrementSongByID = function(audioID,e){
        authorize(JSON.parse(content),locateSong,audioID,e);
    };
});

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
    STDOUT('Authorize this app by visiting this url:', authUrl);
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
                STDOUT('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param audioID
 * @param e discord event message
 */
function locateSong(auth,audioID,e) {
    STDOUT("SCANNING FOR "+audioID);
    if(audioID.length<4) return STDOUT("Error: audio ID length less than 4 characters. Returning.");
    const sheets = google.sheets({version: 'v4', auth});
    let ret = {val:false};
    sheets.spreadsheets.values.get({
        spreadsheetId: SONG_SPREADSHEET_ID,
        range: 'Wheres!A2:O',
    }, (err, res) => {
        if (err) return STDOUT('The API returned an error: ' + err);
        const rows = res.data.values;

        let content = e.message.content;
        let discord_message_tokens = content.split(" ");
        if (rows.length) {
            let i=2;

            //adjustment for numerical multiplier
            let INCREMENTBY=1;
            // console.log("Discord Message Tokens:  ",discord_message_tokens);
            // console.log("Discord Message Token 0: ",discord_message_tokens[0]);
            // console.log("Char at [1]:             ",discord_message_tokens[0][1]);
            if(discord_message_tokens.length>1){
                if(discord_message_tokens[0]-0){    //act only if first component is a number != 0

                    let r = (audioID.toLowerCase().trim() === content.toLowerCase().trim());
                    //console.log("r: ",r);

                    INCREMENTBY = discord_message_tokens.shift()-0;
                    content = discord_message_tokens.join(" ");
                    if(r) audioID = content.toLowerCase().trim();
                }
            }

            //adjustments for FIND and SET inputs.

            let INCREMENT = true;
            let modifier = content.split(" ")[0].toLowerCase(); //first word of content
            let SET_ID = undefined;
            if(modifier==="find" || modifier==="set"){
                INCREMENT = false;

                if(modifier==="set"){
                    if(content.split(" ").length!==3)
                        return STDOUT("Expected SET commands to have 3 word inputs of the form `SET M-0420 oue123j0Epo`.");
                    SET_ID = content.split(" ")[1];
                    audioID= content.split(" ")[2];
                }

            }

            // Iterate through objects.
            rows.map((row) => {

                //handle find-type messages
                if(modifier==="find"){
                    if(row.join(" - ").toLowerCase().includes(content.substring("find ".length))) STDOUT(row);
                    return;
                }

                //init song name equality
                let matching = row[SONGNAME_ROW].toLowerCase()===audioID.toLowerCase() || row[MSONGID_ROW]===audioID.toUpperCase();

                //check out a song only if the song has a defined URL or the audio ID input matches the song name
                if(row[SONGID_ROW] || matching || SET_ID) {

                    //behavior for when using the SET modifier
                    if(SET_ID){
                        matching=false;
                        if(row[MSONGID_ROW].toLowerCase()===SET_ID.toLowerCase()){
                            STDOUT("Set Match! Data will not be incremented.");
                            STDOUT(row);

                            //ADD YT ID TO OBJECT
                            audioID = URLtoID(audioID);
                            if(row[SONGID_ROW])
                                audioID = row[SONGID_ROW] + ","+audioID;
                            incrementSong(auth, i,[[row[PLAYS_ROW]-0]],sheets, audioID);                           //TODO: don't clear old IDs
                            return;
                        }
                    }else {
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
                            STDOUT(`Incrementing ${row[AUTHOR_ROW]} - ${row[SONGNAME_ROW]} by ${INCREMENTBY}. New play count: ${row[PLAYS_ROW] - 0 + INCREMENTBY}`);
                            if (!e.message.deleted) e.message.delete();
                            ret.val = incrementSong(auth, i, [[((row[PLAYS_ROW] - 0) + INCREMENTBY)]], sheets);
                        }else{
                            STDOUT(row);
                        }
                    }
                }
                i++;
            });

            if(!ret.val && INCREMENT){
                if(content.substring(0,4)==="find") return STDOUT("Not querying YouTube on `find`");
                STDOUT("Failed to find song with YouTube ID "+audioID+" ...\nRequesting Data from YouTube to continue search.");
                addDatum(auth,audioID,sheets,rows);
            }
            //('Failed to find '+audioID);
        } else {
            STDOUT('Failed on '+audioID);
        }
    });
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
        //console.log(body);
        let titleIDX = body.indexOf("<title>")+"<title>".length;
        let targetTitle = body.substring(titleIDX);

        targetTitle = targetTitle.substring(0,targetTitle.indexOf("</title>")).toLowerCase();
        //STDOUT("Found <title> at "+titleIDX);

        if(targetTitle.length<8)return STDOUT("Failed to find match.  Bad title.");
        STDOUT("Unformatted target Title: `"+targetTitle+"`");

        while(targetTitle.includes("&#39;")){
            targetTitle = targetTitle.replace("&#39;","'");
        }

        let unformattedTitle = targetTitle;



        //format hypothetical "target" title
        targetTitle = targetTitle.replace("- youtube","");
        //targetTitle = endLimit(targetTitle,"|");
        targetTitle = targetTitle.substring(targetTitle.indexOf("-") + 1);
        if(targetTitle.includes("(")) {
            //author = targetTitle.substring(targetTitle.indexOf("-")).trim();
        }else{
            let blockStart = body.indexOf("ytd-channel-name");
            let authBlock = body.substring(blockStart);
            authBlock = authBlock.substring(0,authBlock.indexOf("</a>"));
            while(authBlock.includes(">"))
                authBlock=authBlock.substring(1);
            //author = authBlock.replaceAll(" - Topic","").trim();
        }
        targetTitle = endLimit(targetTitle,"(");
        targetTitle = endLimit(targetTitle,"[");
        targetTitle = targetTitle.trim().toLowerCase();



        let matches = [];

        for(let i in rows){
            if(rows[i][AUTHOR_ROW].length<1)continue;
            // noinspection JSUnfilteredForInLoop
            let songNameWords = rows[i][SONGNAME_ROW].toLowerCase().split(" ");
            for(let j in songNameWords){
                if(songNameWords[j]==="the"
                || songNameWords[j]==="a"
                || songNameWords[j]==="in"
                )continue;
                console.log(`Testing ${unformattedTitle} for ${songNameWords[j]}`);
                if(songNameWords[j].length > 2 && unformattedTitle.includes(songNameWords[j])){
                    matches.push(i);
                    break; //should break j loop
                }
            }
        }

        STDOUT("Formatted:\r\n author: `"+unformattedTitle+"`\r\ntitle: `"+targetTitle+"`");
        STDOUT(`Found ${matches.length} potential matches`);

        if(matches.length>1){
            for(let i in matches){  //fuzzy evaluation of closest match
                let idx = matches[i];
                let songNameWords = rows[matches[i]][SONGNAME_ROW].toLowerCase().split(" ");
                matches[i] = {idx:idx};
                matches[i].commonSongNameTerms = 0;
                for(let j in songNameWords){
                    if(unformattedTitle.includes(songNameWords[j]))
                        matches[i].commonSongNameTerms++;
                }

                if(unformattedTitle.includes(rows[idx][SONGNAME_ROW].toLowerCase())){
                    matches[i].commonSongNameTerms+=20;
                }
                if(unformattedTitle.includes(rows[idx][AUTHOR_ROW].toLowerCase())){
                    matches[i].commonSongNameTerms+=15;
                }else{
                    //STDOUT(`${author} does not contain ${rows[idx][AUTHOR_ROW]}`);
                }
                //Where the album title exists and is in the song title, add heavy weight to such cases
                if(rows[idx][ALBUM_ROW].toLowerCase().length && unformattedTitle.includes(rows[idx][ALBUM_ROW].toLowerCase())){
                    matches[i].commonSongNameTerms+=25;
                }

                //constrain to >1 terms to try to filter output stream quality a little bit
                if(matches[i].commonSongNameTerms > 1)
                    STDOUT(`Similarity score: ${matches[i].commonSongNameTerms}. Similarity at index ${idx} ${JSON.stringify(rows[idx])}.`);

            }

            matches.sort((a,b)=>{   //todo: improve method of determining closest match
                console.log(`Comparing ${rows[b.idx][SONGNAME_ROW]}(${b.commonSongNameTerms}) vs ${rows[a.idx][SONGNAME_ROW]}(${a.commonSongNameTerms})`);
                return b.commonSongNameTerms - a.commonSongNameTerms;// + ((rows[b][AUTHOR_ROW].toLowerCase()===author.toLowerCase()) ? 69:0);
            });
            STDOUT(`Closest match: ${rows[matches[0].idx][AUTHOR_ROW]} - ${rows[matches[0].idx][SONGNAME_ROW]}`);

            if(matches[0].commonSongNameTerms < rows[matches[0].idx][SONGNAME_ROW].split(" ").length/2){
                STDOUT("INSUFFICIENT CONFIDENCE IN ANSWER.  PLEASE USE SET TO MANUALLY ADD THIS DATUM.");
                STDOUT(JSON.stringify(rows[matches[0].idx]));
                return;
            }

            matches = [matches[0].idx];
        }

        if(matches.length === 1){
            let i = matches[0]-0;
            let audioIDChange;
            STDOUT(`Incrementing best match: ${JSON.stringify(rows[i])}.`);
            if(rows[i][SONGID_ROW]===undefined) audioIDChange=audioID;
            else audioIDChange = rows[i][SONGID_ROW]+","+audioID;
            incrementSong(auth, i+2,[[rows[i][PLAYS_ROW]-0+1]],sheets,audioIDChange);
        }

        if(matches.length === 0){
            STDOUT("No matches found");
        }
    });
}

function incrementSong(auth, position,newVal,sheets,audioID) {

    //clean up redundancies in audioID during any audioID changes
    if(audioID) {
        let audioIDlist = audioID.split(",");
        let uniqueIDs = {};
        for (let i in audioIDlist) {
            uniqueIDs[audioIDlist[i]] = true;
        }
        let keys = Object.keys(uniqueIDs);
        audioID = keys.join(",");
        if (keys.length < audioIDlist.length) STDOUT(`Unique IDs reduced from ${audioIDlist.length} to ${keys.length} IDs.`);
    }

    const request = {
        // The ID of the spreadsheet to update.
        spreadsheetId: SONG_SPREADSHEET_ID,

        // The A1 notation of the values to update.
        range: 'L' + position,

        // How the input data should be interpreted.
        valueInputOption: 'RAW',

        resource: {
            values: newVal,
            // will be replaced.
        },

        auth: auth,
    };
    const requestDate = {
        // The ID of the spreadsheet to update.
        spreadsheetId: SONG_SPREADSHEET_ID,

        // The A1 notation of the values to update.
        range: 'H' + position,

        // How the input data should be interpreted.
        valueInputOption: 'RAW',

        resource: {
            values: [[70*365.25+1.33330-1/24+Date.now()/1000/3600/24]],
            // will be replaced.
        },

        auth: auth,
    };
    const requestAudio = {
        // The ID of the spreadsheet to update.
        spreadsheetId: SONG_SPREADSHEET_ID,

        // The A1 notation of the values to update.
        range: 'O' + position,

        // How the input data should be interpreted.
        valueInputOption: 'RAW',

        resource: {
            // will be replaced.
            values: [[audioID]],
        },

        auth: auth,
    };

    try {
        //STDOUT("SENDING REQUEST: "+JSON.stringify(request));
        const response = sheets.spreadsheets.values.update(request).data;
        const responseDate = sheets.spreadsheets.values.update(requestDate).data;
        if(audioID){
            sheets.spreadsheets.values.update(requestAudio);
            STDOUT("ADDED SONG ID");
        }
        // TODO: Change code below to process the `response` object:
        //STDOUT(JSON.stringify(response));
        return true;
    } catch (err) {
        STDOUT("ERROR:\T"+JSON.stringify(err));
    }

}



//DISCORD


const client = new discordie({autoReconnect:true});
const events = discordie.Events;

var target = "..\\SonineDiscord.txt";
const token = fs.readFileSync(target).toString();

client.connect({token: token});


let STDOUTQUEUE = [];
client.Dispatcher.on(events.GATEWAY_READY, e => {
    console.log("Connected to Discord as "+client.User.username);
    STDOUT = function (msg) {
        console.log(msg);
        if(typeof(msg)==="object") msg = JSON.stringify(msg);
        STDOUTQUEUE.push(msg);
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
    let auth = e.message.author;
    //console.log(e.message.author.id);
    //use of this bot is for argo only.
    if(auth.id !== "162952008712716288" && auth.id !=="263474950181093396")return;
    //STDOUT("Made it through.");
    let content = e.message.content;



    //URL parsing

    return incrementSongByID(URLtoID(content),e);
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