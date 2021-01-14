const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const discordie = require("discordie");
const request = require("request");

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

let STDOUT = function (MSG){
    //loops prompt if google API not resolved.
    setTimeout(()=>{
        STDOUT(songID);
        console.log("Awaiting to Output "+songID);
    },1000);
};

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
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
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
        spreadsheetId: '1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g',
        range: 'Wheres!A2:O',
    }, (err, res) => {
        if (err) return STDOUT('The API returned an error: ' + err);
        const rows = res.data.values;

        if (rows.length) {
            let i=2;


            //adjustments for FIND and SET inputs.
            let INCREMENT = true;
            let cont = e.message.content;
            let modifier = cont.split(" ")[0].toLowerCase();
            let ID = undefined;
            if(modifier==="find" || modifier==="set"){
                INCREMENT = false;
                if(modifier==="set"){
                    //STDOUT("INVOKED SET");
                    if(cont.split(" ").length!==3)
                        return STDOUT("Expected SET commands to have 3 word inputs of the form `SET M-0420 oue123j0Epo`.");
                    ID = cont.split(" ")[1];
                    audioID=cont.split(" ")[2];
                }
            }else{
                STDOUT(`No modifier: "${modifier}"`);
            }

            // Iterate through objects.
            rows.map((row) => {

                //handle find-type messages
                if(modifier==="find"){
                    if(row.join(" - ").toLowerCase().includes(cont.substring("find ".length))) STDOUT(row);
                    return;
                }


                //check out a song only if the song has a defined URL or the audio ID input matches the song name
                if(row[14] || (row[1].toLowerCase()===audioID.toLowerCase() && row[1].length > 4) || ID) {
                    //init song name equality, then proceed to compare against possible id's
                    let matching = row[1].toLowerCase()===audioID.toLowerCase();

                    //behavior for when using the SET modifier
                    if(ID){
                        matching=false;
                        if(row[3].toLowerCase()===ID.toLowerCase()){
                            STDOUT("Set Match! Data will not be incremented.");
                            STDOUT(row);

                            //ADD YT ID TO OBJECT
                            incrementSong(auth, i,[[row[11]-0]],sheets,audioID);
                            return;
                        }
                    }else {
                        //normal case behavior to locate matches
                        if (!matching) {
                            if (row[14].indexOf(audioID) > -1) matching = true;
                            let bits = row[14].split(",");
                            for (let j in bits) {
                                if (matching) break;

                                if (audioID.includes(bits[j]) && bits[j].length > 4) {
                                    matching = true;
                                }
                            }
                        }
                    }
                    if (matching) {
                        if (INCREMENT) {
                            STDOUT(`Incrementing ${row[0]} - ${row[1]}. New play count: ${row[11] - 0 + 1}`);
                            if (!e.message.deleted) e.message.delete();
                            ret.val = incrementSong(auth, i, [[((row[11] - 0) + 1)]], sheets);
                        }else{
                            STDOUT(row);
                        }
                    }

                }
                i++;
            });

            if(!ret.val && INCREMENT){
                if(cont.substring(0,4)==="find") return STDOUT("Not querying YouTube on `find`");
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
        targetTitle = targetTitle.substring(0,targetTitle.indexOf("</title>"));
        //STDOUT("Found <title> at "+titleIDX);
        if(targetTitle.length<8)return STDOUT("Failed to find match.  Bad title.");
        STDOUT("Unformatted target Title: `"+targetTitle+"`");

        let author;
        targetTitle = targetTitle.replace("- YouTube","");
        targetTitle = endLimit(targetTitle,"|");
        targetTitle = targetTitle.substring(targetTitle.indexOf("-") + 1);
        if(targetTitle.includes("(")) {
            author = targetTitle.substring(targetTitle.indexOf("-")).trim();
        }else{
            let blockStart = body.indexOf("ytd-channel-name");
            let authBlock = body.substring(blockStart);
            authBlock = authBlock.substring(0,authBlock.indexOf("</a>"));
            while(authBlock.includes(">"))
                authBlock=authBlock.substring(1);
            author = authBlock.replaceAll(" - Topic","").trim();
        }
        targetTitle = endLimit(targetTitle,"(");
        targetTitle = endLimit(targetTitle,"[");
        targetTitle = targetTitle.trim();

        let matches = [];
        for(let i in rows){
            if(rows[i][0].length<1)continue;
            if(targetTitle.toLowerCase().indexOf(rows[i][1].toLowerCase()) === 0){
                matches.push(i);
                STDOUT("Match at index "+i+JSON.stringify(rows[i]));
            }
        }

        STDOUT("Formatted target title: `"+targetTitle+"`");

        if(matches.length>1){
            matches.sort((a,b)=>{
                return rows[b][1].length - rows[a][1].length + rows[b][0].toLowerCase()===author.toLowerCase();
            });
            STDOUT(`Closest match: ${rows[matches[0]][0]} - ${rows[matches[0]][1]}`);
            matches = [matches[0]];
        }

        if(matches.length === 1){
            let i = matches[0]-0;
            let audioIDChange;
            if(rows[i][14]===undefined) audioIDChange=audioID;
            else audioIDChange = rows[i][14]+","+audioID;
            incrementSong(auth, i+2,[[rows[i][11]-0+1]],sheets,audioIDChange);
        }
    });
}

function incrementSong(auth, position,newVal,sheets,audioID) {

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
    const requestAudio = {
        // The ID of the spreadsheet to update.
        spreadsheetId: '1BFpRiSj_AS1qmwJHGODsWHeDJ-6kLQ3Sp51Uh2I9i3g',  // TODO: Update placeholder value.

        // The A1 notation of the values to update.
        range: 'O' + position,  // TODO: Update placeholder value.

        // How the input data should be interpreted.
        valueInputOption: 'RAW',  // TODO: Update placeholder value.

        resource: {
            values: [[audioID]],
            // TODO: Add desired properties to the request body. All existing properties
            // will be replaced.
        },

        auth: auth,
    };

    try {
        //STDOUT("SENDING REQUEST: "+JSON.stringify(request));
        const response = (sheets.spreadsheets.values.update(request)).data;
        const responseDate = (sheets.spreadsheets.values.update(requestDate)).data;
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



client.Dispatcher.on(events.GATEWAY_READY, e => {
    console.log("Connected to Discord as "+client.User.username);
    STDOUT = function (msg) {
        console.log(msg);
        if(typeof(msg)==="object")msg = JSON.stringify(msg);
        client.Channels.get("789915834385825802").sendMessage(msg);
    }
});

function endLimit(content,tail){
    if(content.includes(tail)){
        return content.substring(0,content.indexOf(tail));
    }
    return content;
}

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
    if(content.includes("v=")) {
        content = content.substring(content.indexOf("v=") + 2);
        content = endLimit(content,"&");
        content = endLimit(content,"?");
        try {
            return incrementSongByID(content,e);
        } catch (e) {
            STDOUT("error:\t" + JSON.stringify(e));
        }
    }
    if(content.includes(".be/")){
        content = content.substring(content.indexOf(".be/")+4);
        content = endLimit(content,"&");
        content = endLimit(content,"?");
        return incrementSongByID(content,e);
    }


    return incrementSongByID(content,e);
});