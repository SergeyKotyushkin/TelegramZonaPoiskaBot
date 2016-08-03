'use strict'

// Load Default Values
require(__dirname + '/.env');

var tg = require('telegram-node-bot')(process.env.BotToken);
var isNumeric = require("isnumeric");
var dateFormat = require('dateformat');

var db = require(__dirname + '/db.js');

var controllers = {
    allGamesForUser: {
        command: 'get_all_games_for_user',
        controller: 'AllGamesForUserController'
    },
    allTeamsForGame: {
        command: 'get_all_teams_for_game',
        controller: 'AllTeamsForGameController'
    },
    teamAnswersForGame: {
        command: 'get_team_answers_for_game',
        controller: 'TeamAnswersForGameController'
    }
};

// Routes
tg.router.when([controllers.allGamesForUser.command], controllers.allGamesForUser.controller);
tg.router.when([controllers.allTeamsForGame.command], controllers.allTeamsForGame.controller);
tg.router.when([controllers.teamAnswersForGame.command], controllers.teamAnswersForGame.controller);

// Controllers
tg.controller(controllers.allGamesForUser.controller, ($) => {
    tg.for(controllers.allGamesForUser.command, () => {
        $.runForm(allGamesForUserForm, (result) => {
            getAllGamesForUser(result.code, function(result) {
                $.sendMessage(result);
            });
        });
    })
});

tg.controller(controllers.allTeamsForGame.controller, ($) => {
    tg.for(controllers.allTeamsForGame.command, () => {
        $.runForm(allTeamsForGameForm, (result) => {
            getAllTeamsForGame(result.code, result.gameId, function(result) {
                $.sendMessage(result);
            });
        });
    })
});

tg.controller(controllers.teamAnswersForGame.controller, ($) => {
    tg.for(controllers.teamAnswersForGame.command, () => {
        $.runForm(teamAnswersForGameForm, (result) => {
            getTeamAnswersForGame(result.code, result.gameId, result.teamId, function(result) {
                $.sendMessage(result);
            });
        });
    })
});

// Forms
var allGamesForUserForm = {
    code: {
        q: 'Пришли-ка мне сначала твой секретный код',
        error: 'Некорректный код',
        validator: (input, callback) => callback(isNumeric(input['text']))
    }
}

var allTeamsForGameForm = {
    code: Object.assign({}, allGamesForUserForm.code),
    gameId: {
        q: 'Теперь мне нужен id игры (можно узнать командой /' + controllers.allGamesForUser.command + ')',
        error: 'Некорректный id игры',
        validator: (input, callback) => callback(isNumeric(input['text']))
    }
}

var teamAnswersForGameForm = {
    code: Object.assign({}, allGamesForUserForm.code),
    gameId: Object.assign({}, allTeamsForGameForm.gameId),
    teamId: {
        q: 'Сейчас еще пришли мне id команды (можно узнать командой /' + controllers.allTeamsForGame.command + ')',
        error: 'Некорректный id команды',
        validator: (input, callback) => callback(isNumeric(input['text']))
    }
}


// Controller's methods
function getAllGamesForUser(code, callback) {
    var sql = "SELECT `ID`, `Name` FROM `Game` WHERE `CreatorID`=(" +
        "SELECT `ID` FROM `User` WHERE `Code`=?)";
    db.query(sql, code, function(rows) {
        if (rows != null && rows.length > 0) {
            var output = "All Games:\n---------\nID Name\n";
            for (var row of rows) {
                output += row.ID + " " + row.Name + "\n";
            }

            callback(output + "---------\n");
            return;
        }

        callback("У данного пользователя пока нет игр.");
    });
}

function getAllTeamsForGame(code, gameId, callback) {
    var sql = "SELECT `Team`.`ID`, `Team`.`Name` FROM `Team` " +
        "INNER JOIN `TeamGame` ON `Team`.`ID`=`TeamGame`.`TeamID` WHERE `GameID`=? AND " +
        "? in (SELECT `ID` FROM `Game` WHERE `CreatorID`=(" +
        "SELECT `ID` FROM `User` WHERE `Code`=?))";
    db.query(sql, [gameId, gameId, code], function(rows) {
        if (rows != null && rows.length > 0) {
            var output = "All Teams:\n---------\nID Name\n";
            for (var row of rows) {
                output += row.ID + " " + row.Name + "\n";
            }

            callback(output + "---------\n");
            return;
        }

        callback("Для данной игры пока нет команд.");
    });
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
            var output = "Team's (" + rows[0].TeamName + ") answers:\n---------\nRight Time Level Sector Answer UserName\n";
            for (var row of rows) {
                output += (row.Right === 1 ? "[  ]" : "[ + ]") + " " +
                    dateFormat(row.Time, "dd-mm-yyyy HH:MM:ss") + " " + row.LevelName + " " + row.SectorNumber + "  {" +
                    row.Answer + "}  " + row.UserName + "\n";
            }

            callback(output + "---------\n");
            return;
        }

        callback("Для данной команды в данной игре пока нет ответов.");
    });
}
