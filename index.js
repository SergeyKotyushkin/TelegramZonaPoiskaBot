'use strict'

// Load Default Values
require(__dirname + '/.env');

// Npm modules
const telegram = require('telegram-node-bot');
const isNumeric = require("isnumeric");
const dateFormat = require('dateformat');

// My modules
const db = require(__dirname + '/db.js');

// Telegram initialization
const TelegramBaseController = telegram.TelegramBaseController;
const TelegramBaseInlineController = telegram.TelegramBaseInlineQueryController;
const tg = new telegram.Telegram(process.env.BotToken);


// Controllers
class TestInlineController extends TelegramBaseInlineController {

    handle($) {
        parseQuery($, $.inlineQuery.query, executeQuery);
    }
}

class OtherwiseController extends TelegramBaseController {

    handle() {
        console.log('otherwise');
    }
}


// Routes
tg.router
    .inlineQuery(new TestInlineController())
    .otherwise(new OtherwiseController());

// Data
const parameter_names = ["Секретный код", "ID игры", "ID команды"];


// Methods
function parseQuery($, query, callback) {
    var result = {
        finished: false,
        hasError: false
    };
    if (query.length === 0 || query[query.length - 1] !== '/') {
        return callback($, result);
    }

    result.finished = true;

    var parameters = query.substring(0, query.length - 1).split(',');
    if (parameters.length > 3) {
        result.hasError = true;
        result.errorMessage = "Ожидается не более трёх параметров!";
        return callback($, result);
    }

    for (var i = 0; i < parameters.length; i++) {
        if (!isNumeric(parameters[i])) {
            result.hasError = true;
            result.errorMessage = "Параметр '" + parameter_names[i] + "' должен быть числом!";
            return callback($, result);
        }
    }

    result.parameters = parameters.slice();
    return callback($, result);
}

function executeQuery($, parseResult) {
    if (!parseResult.finished)
        return;

    if (parseResult.hasError) {
        console.error(parseResult.errorMessage);
        $.sendMessage(parseResult.errorMessage);
        return;
    }

    var answer = {
        type: "article",
        id: "0",
        input_message_content: {
            parse_mode: "HTML"
        },
        description: "Показать результаты",
    };

    switch (parseResult.parameters.length) {
        case 1:
            getAllGamesForUser(parseResult.parameters[0], function(result) {
                answer.input_message_content.message_text = result;
                answer.title = "Игры";
                tg.api.answerInlineQuery($.inlineQuery.id, [answer]);
            });
            break;
        case 2:
            getAllTeamsForGame(parseResult.parameters[0], parseResult.parameters[1], function(result) {
                answer.input_message_content.message_text = result;
                answer.title = "Команды";
                tg.api.answerInlineQuery($.inlineQuery.id, [answer]);
            });
            break;
        case 3:
            getTeamAnswersForGame(parseResult.parameters[0], parseResult.parameters[1], parseResult.parameters[2], function(result) {
                answer.input_message_content.message_text = result;
                answer.title = "Ответы команды";
                tg.api.answerInlineQuery($.inlineQuery.id, [answer]);
            });
            break;
    }
}


function getTableWithIdAndName(rows, title, emptyMessage) {
    if (rows != null && rows.length > 0) {
        var output = "---------------------------\n" +
            "<b>" + title + "</b>\n---------\n<b>ID Name</b>\n";
        for (var row of rows) {
            output += row.ID + " " + row.Name + "\n";
        }

        return output + "---------\n";
    }

    return emptyMessage;
}


function getAllGamesForUser(code, callback) {
    var sql = "SELECT `ID`, `Name` FROM `Game` WHERE `CreatorID`=(" +
        "SELECT `ID` FROM `User` WHERE `Code`=?)";
    db.query(sql, code, (rows) =>
        callback(getTableWithIdAndName(rows, "Все игры:", "У данного пользователя пока нет игр.")));
}

function getAllTeamsForGame(code, gameId, callback) {
    var sql = "SELECT `Team`.`ID`, `Team`.`Name` FROM `Team` " +
        "INNER JOIN `TeamGame` ON `Team`.`ID`=`TeamGame`.`TeamID` WHERE `GameID`=? AND " +
        "? in (SELECT `ID` FROM `Game` WHERE `CreatorID`=(" +
        "SELECT `ID` FROM `User` WHERE `Code`=?))";
    db.query(sql, [gameId, gameId, code], (rows) =>
        callback(getTableWithIdAndName(rows, "Все команды:", "Для данной игры пока нет команд.")));
}

function getTeamAnswersForGame(code, gameId, teamId, callback) {
    var sql = "SELECT `Right`, `Time`, `LevelName`, `SectorNumber`, `Answer`, `User`.`UserName`, `Team`.`Name` AS `TeamName` FROM `Answer`" +
        "INNER JOIN `User` ON `Answer`.`UserID`=`User`.`ID`" +
        "INNER JOIN `Team` ON `Answer`.`TeamID`=`Team`.`ID`" +
        "WHERE `TeamId`=? AND `GameID`=? AND ? IN (SELECT `ID` FROM `Game` WHERE `CreatorID`=(" +
        "SELECT `ID` FROM `User` WHERE `Code`=?))" +
        "ORDER BY `Time`";
    db.query(sql, [teamId, gameId, gameId, code], function(rows) {
        if (rows != null && rows.length > 0) {
            var output = "---------------------------\n" +
                "<b>Team's (" + rows[0].TeamName + ") answers:</b>\n---------\n" +
                "<b>Right Time Level Sector Answer UserName</b>\n";
            for (var row of rows) {
                output += (row.Right === 1 ? "<code>" : "") +
                    dateFormat(row.Time, " dd-mm-yyyy HH:MM:ss ") +
                    row.LevelName + " " + row.SectorNumber +
                    "  {" + row.Answer + "} " + row.UserName +
                    (row.Right === 1 ? "</code>" : "") + "\n";
            }

            console.log("> " + output);
            callback(output + "---------\n");
            return;
        }

        callback("Для данной команды в данной игре пока нет ответов.");
    });
}
