angular.module('storelitedb')
.service('Database', ['$q', 'DBConfig', 'DBUtil', 'Log', 'Loading', function($q, DBConfig, DBUtil, Log, Loading)
    {
        var db = STORELITE_DB_CONNECTION;
        var $this = this;
        var queryString = '';
        var prepareArray = [];
        var migrationSchema = {
            tableName: "migrations",
            columns: {
                id: "INTEGER PRIMARY KEY AUTOINCREMENT",
                path: "TEXT NOT NULL",
                status: "INT NOT NULL", // 0 pending, 1 runned
                created: "INT NOT NULL"
            }
        };
        /**
         * The default configurations of the database(eg: name,size)
         * @var {object} config
         * @var {string} [config.dbName=custom.db] The name of the database
         * @var {int} [config.dbSize=(5*1024*1024)] The size of the database
         * @var {bool} [config.showLogs=true] The enable disable the logs of the command sql
         * @var {string} [config.storageType=sqlite] the storage type(only sqlite implemented here)
         */
        var config = DBConfig;

        /**
         * Set the custom configuration for the databse
         * @param {Object} value The object with db config
         * @param {string} value.dbName The name of the database
         * @param {int} value.dbSize The size of the database
        */
        this.setConnectionOptions = function (value) {
            config = angular.extend(DBConfig, ( value || {} ));
        };

        /**
         * Start the connection in the databse(WebSql or Sqlite)
         * @return Promise
         */
        this.connect = function()
        {
            var defer = $q.defer();
            if( db == null )
            {
                if( window.sqlitePlugin ){
                    window.sqlitePlugin.openDatabase({ name: config.dbName, location: 'default' }, function (instance) {
                        db = instance;
                        STORELITE_DB_CONNECTION = instance;
                        Log.info('sqlite.connection', db, config.showLogs);
                        defer.resolve($this);
                    }, function (e) {
                        Log.DBException(e, '', null, config.showLog);
                        defer.reject("it was not possible to stablish connection with local database");
                    });
                } else{
                    db = window.openDatabase(config.dbName, "1.0", "Test Web SQL Database", config.dbSize);
                    STORELITE_DB_CONNECTION = db;
                    Log.info('WebSql.connection', db, config.showLogs);
                    defer.resolve($this);
                }
            }
            else{
                Log.info('cache.connection', db, config.showLogs);
                defer.resolve($this);
            }
            return defer.promise;
        };

        /**
         * execute the query command sent in first argument
         * @param {string} sql the string with the query to be executed
         * @param {array} attributes the array of argument to be prepare and replaced in '?' character of the sql
         */
        this.query = function (sql, attributes) {
            attributes = (attributes || []);
            return $q(function (resolve, reject) {
                $this.connect().then(function () {
                    db.transaction(function (t) {
                        t.executeSql(sql, attributes, function (tx, r) {
                            Log.success('Query: ' + sql, [r, attributes], config.showLogs);
                            return resolve(r);
                        }, function (tx, e) {
                            if (window.cordova) {
                                window.plugins.toast.show("The query had an error", 'long', 'top');
                            }
                            Log.DBException(e, sql, attributes, config.showLogs);
                            reject(e);
                        });
                    });
                }, reject);
            });
        };

        /**
         * @example Database.initialize({tableName:'dbz', columns: {id: 'INTEGER PRIMARY KEY AUTOINCREMENT'}});
         * @param {object} schema the data of the table to be create
         */
        this.initialize = function(schema)
        {
            var defer = $q.defer();

            $this.connect().then(function() {
                var pMigration = (config.enableMigrations ? $this.findOrCreate(migrationSchema) : $q.resolve(null));

                pMigration.then(function () {
                    $this.findOrCreate(schema).then(defer.resolve, defer.reject);
                }, defer.reject);
            }, defer.reject);
            
            return defer.promise;
        };

        /**
         * Verify if the table of the schema already exists in the local DB
         * if no exists creates the schema in the local DB
         * @param {object} schema the schema to create or check
         * @param {string} schema.tableName the name of table to be create
         * @param {object} schema.columns the list of columns of the schema
         */
        this.findOrCreate = function(schema) {
            var defer = $q.defer();
            var sql = "SELECT sql FROM sqlite_master WHERE tbl_name = '" + schema.tableName + "' AND type = 'table'";

            $this.query(sql).then(function (r) {
                if (r.rows.length == 0) {
                    Log.info('creating.db', schema, config.showLogs);
                    $this.create(schema.tableName, schema.columns).then(function () {
                        return defer.resolve($this);
                    }, function (e) {
                        Log.DBException(e, sql, schema, config.showLog);
                        defer.reject("it was not possible create the " + schema.tableName);
                    });
                } else {
                    Log.info('loading.db', schema, config.showLogs);
                    return defer.resolve($this);
                }
            }, function (e) {
                Log.DBException(e, sql, schema, config.showLog);
                defer.reject("it was not possible find the schema " + schema.tableName);
            });

            return defer.promise;
        };

        /**
         * Create a table in local database
         * @example db.create('dbz', {personagem: 'TEXT'});
         * @param {string} tableName the name of the table to be create
         * @param {object} fields the object with the field of the table
         * @param {boolean} notExists set rule in create sql
         * @return Promise
         */
        this.create = function(tableName, fields, notExists){
            notExists = (angular.isUndefined(notExists) ? 'IF NOT EXISTS' : '');
            
            var fieldList = DBUtil.prepareFields(fields, 'create');
            var sql = "CREATE TABLE {notExist} {tableName} ({fields});"
                    .replace('{tableName}', tableName)
                    .replace('{notExist}', notExists)
                    .replace('{fields}', fieldList.field);

            return $this.query(sql, []);
        };

        /**
         * @param {string} tableName the name of the table
         * @param {boolean} notExists with exists rule
         */
        this.drop = function(tableName, notExists){
            notExists = (angular.isUndefined(notExists) ? 'IF EXISTS ' : '');
            return $this.query("DROP TABLE "+notExists+tableName, []);
        };

        /**
         * Insert a record in the specific table in local database
         * @example db.insert('dbz', {personagem: 'Kakaroto'});
         * @param {string} tableName the name of the table to be create
         * @param {object} fields the object with the field of the table
         * @return Promise
         */
        this.insert = function(tableName, fields){
            var fieldList = DBUtil.prepareFields(fields, 'insert');
            var sql = "INSERT INTO {tableName} ({fields}) values({values})";
            
            sql = sql.replace('{tableName}', tableName)
                    .replace('{fields}', fieldList.field.join(','))
                    .replace('{values}', fieldList.field.map(function(row){ return '?'}) );
            
            return $this.query(sql, fieldList.values);
        };

        /**
         * Update the data of a specific table in local database
         * @example db.update('dbz', {personagem: 'Son Goku'}, {id:1});
         * @param {string} tableName the name of the table to be create
         * @param {object} values the fields to be updated
         * @param {object} condition the rules of the update a data
         * @return Promise
         */
        this.update = function(tableName, values, condition){
            var fieldList = DBUtil.prepareFields(values, 'update');
            var conditions = DBUtil.prepareConditions(condition);
            var sql = "UPDATE {tableName} SET {fields} WHERE {condition};";
            
            sql = sql.replace('{tableName}', tableName)
                    .replace('{fields}', fieldList.field.join(','))
                    .replace('{condition}', conditions.rules.join(" AND ") );
            
            return $this.query(sql, fieldList.values.concat(conditions.values));
        };

        /**
         * Update the data of a specific table in local database
         * @example db.delete('dbz', {id:1});
         * @param {string} tableName the name of the table to be create
         * @param {object} condition the rules of the update a data
         * @return Promise
         */
        this.remove = function(tableName, condition){
            var fieldList = DBUtil.prepareConditions(condition);
            var sql = "DELETE FROM "+tableName;
            if( angular.isDefined(condition) ){
                sql += " WHERE "+(fieldList.rules.join(" AND "))+";";
            }
            return $this.query(sql, fieldList.values);
        };
        
        /**
         * add the 'select' command in the query to be executed
         * @param {object} fields the list of the fields to be return in query
         * @return Database
         */
        this.select = function(fields){
            queryString = "SELECT "+fields.join(', ');
            return this;
        };
        
        /**
         * add the 'from' command in the query to be executed
         * @param {string} tableName the name of the table
         * @return Database
         */
        this.from = function(tableName){
            queryString += " FROM "+tableName;
            return this;
        };

        /**
         * add the 'where' command in the query to be executed
         * @param {object} condition the rules to be add in the query
         * @return Database
         */
        this.where = function(condition){
            var fieldList = DBUtil.prepareConditions(condition);
            queryString += (" WHERE "+fieldList.rules.join(" AND "));
            prepareArray = fieldList.values;

            return this;
        };

        /**
         * return all result of the query stored in 'queryString'
         * @return Promise
         */
        this.all = function(){
            return $q(function(resolve, reject){
                if(queryString == ''){
                    return reject('no query found');
                }
                
                $this.query(queryString, prepareArray).then(function(r){
                    queryString = null;
                    prepareArray = [];
                    var data = [];
                    for (var i = 0; i < r.rows.length; i++){
                        data.push(r.rows.item(i));
                    }
                    resolve(data);
                }, function(e){
                    reject(e);
                });
            });
        };

        /**
         * return one result of the query stored in 'queryString'
         * @return Promise
         */
        this.one = function(){
            return $q(function(resolve, reject){
                if(queryString == ''){
                    return reject('no query found');
                }
                $this.query(queryString+" LIMIT 1", prepareArray).then(function(r){
                    queryString = null;
                    prepareArray = [];
                    if( r.rows.length == 0 )
                        reject('no result found');
                    else
                        resolve(r.rows.item(0));
                }, function(e){
                    reject(e);
                });
            });
        };
    }])