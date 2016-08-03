var mysql = require('mysql');

function query(sql, parameters, callback) {
    var connection = mysql.createConnection({
        host: process.env.MySql_Host,
        database: process.env.MySql_Database,
        user: process.env.MySql_UserName,
        password: process.env.MySql_Password
    });

    connection.connect(function(err) {
        if (err) {
            console.log('Error connecting to Db.\n' + err.stack);
            callback(null);
        }
    });

    connection.query(sql, parameters, function(err, rows) {
        if (err) {
            console.error('Query execution\'s error.\n' + err.stack);
        }

        callback(err ? null : rows.slice());
    });

    connection.end();
}

module.exports.query = (sql, parameters, callback) => {
    query(sql, parameters, callback)
};
